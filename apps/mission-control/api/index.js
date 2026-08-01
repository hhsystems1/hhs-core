import 'dotenv/config';
import express from 'express';
import http from 'http';
import crypto from 'node:crypto';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Pool } from 'pg';
import { emitEvent } from './events.js';
import { registerCrmRoutes } from './crmRoutes.js';
import { registerContextRoutes } from './contextRoutes.js';
import { getDefaultTenant, requireTenantContext } from './tenantContext.js';
import { initWebSocket, getIO } from './ws.js';
import twilio from 'twilio';
import { registerCommandRoutes } from './commandRoutes.js'; // <-- NEW IMPORT

const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('./uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const upload = multer({ dest: UPLOAD_DIR });

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// --- Auth ---
const sessions = new Map();

function getBearerSessionId(req) {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const sessionId = auth.slice(7).trim();
  return sessionId || null;
}

app.post('/api/auth/register', async (req, res) => {
  if (process.env.ALLOW_OPEN_REGISTRATION !== 'true') {
    return res.status(403).json({ ok: false, error: 'registration disabled' });
  }

  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      await client.query('rollback');
      return res.status(400).json({ ok: false, error: 'email already exists' });
    }

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.default.hash(password, 10);
    const result = await client.query(
      'INSERT INTO users (full_name, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, full_name, email',
      [name || email.split('@')[0], email, hash]
    );
    const tenant = await getDefaultTenant(pool);
    if (tenant) {
      await client.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
         VALUES ($1, $2, 'viewer', 'active')
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [tenant.id, result.rows[0].id]
      );
    }
    await client.query('commit');
    res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    await client.query('rollback');
    res.status(500).json({ ok: false, error: String(e) });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.password_hash
       FROM users u
       WHERE u.email = $1 AND u.status = 'active'`,
      [email]
    );
    if (!result.rows.length) return res.status(401).json({ ok: false, error: 'invalid credentials' });

    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.default.compare(password, result.rows[0].password_hash || '');
    if (!valid) return res.status(401).json({ ok: false, error: 'invalid credentials' });

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { userId: result.rows[0].id, email: result.rows[0].email });
    res.json({ ok: true, session: sessionId, user: { id: result.rows[0].id, name: result.rows[0].full_name, email: result.rows[0].email } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const sessionId = getBearerSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'no session' });
  const session = sessions.get(sessionId);
  if (!session) return res.status(401).json({ ok: false, error: 'invalid session' });
  res.json({ ok: true, user: { id: session.userId, email: session.email } });
});

app.post('/api/auth/logout', async (req, res) => {
  const sessionId = getBearerSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  res.json({ ok: true });
});

// --- Health ---
app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('select 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Protect API routes (except explicit auth endpoints above)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/twilio/')) return next();
  const sessionId = getBearerSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'auth required' });

  const session = sessions.get(sessionId);
  if (!session) return res.status(401).json({ ok: false, error: 'invalid session' });

  req.session = session;
  req.sessionId = sessionId;
  next();
});

app.use('/api/v1', requireTenantContext(pool));
app.use('/api/solar', requireTenantContext(pool));
app.use('/api/context', requireTenantContext(pool));
registerCrmRoutes(app, pool);
registerContextRoutes(app, pool);

app.get('/api/openclaw/status', async (req, res) => {
  try {
    const { execFile } = await import('node:child_process');
    execFile('openclaw', ['status', '--all'], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ ok: false, error: String(error), stderr, stdout });
        return;
      }
      res.json({ ok: true, text: stdout });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/openclaw/config', async (req, res) => {
  try {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile('/Users/turtleclaw/.openclaw/openclaw.json', 'utf8');
    const json = JSON.parse(raw);
      res.json({
        ok: true,
        agents: {
          defaults: {
            model: json?.agents?.defaults?.model || null,
            subagents: json?.agents?.defaults?.subagents || null,
            heartbeat: json?.agents?.defaults?.heartbeat || null,
            models: json?.agents?.defaults?.models || null,
          },
          list: Array.isArray(json?.agents?.list)
            ? json.agents.list.map((agent) => ({
                id: agent?.id || null,
                name: agent?.name || agent?.id || null,
                workspace: agent?.workspace || null,
                model: agent?.model || null,
                embeddedHarness: agent?.embeddedHarness || null,
              }))
            : [],
        },
        dreaming: json?.plugins?.entries?.memory-core?.config?.dreaming || null,
      });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const docs = await pool.query('select count(*)::int as count from knowledge_documents');
    const chunks = await pool.query('select count(*)::int as count from knowledge_chunks');
    res.json({ ok: true, documents: docs.rows[0].count, chunks: chunks.rows[0].count });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --- Phase 8+: Mission Control Lite (read-only visibility layer)

// 1) Activity Feed (events_v2)
app.get('/api/activity', async (req, res) => {
  try {
    const hours = Math.max(1, Math.min(168, Number(req.query.hours || 24))); // 1h..168h
    const level = req.query.level ? String(req.query.level) : null;
    const type = req.query.type ? String(req.query.type) : null;

    const params = [hours];
    let where = `where occurred_at >= now() - ($1::int * interval '1 hour')`;

    if (level) {
      params.push(level);
      where += ` and event_level = $${params.length}`;
    }
    if (type) {
      params.push(type);
      where += ` and event_type = $${params.length}`;
    }

    const q = `
      select
        e.id,
        e.event_level,
        e.event_type,
        e.occurred_at,
        e.actor,
        e.artifact_id,
        e.workspace_id,
        e.person_id
      from events_v2 e
      ${where}
      order by e.occurred_at desc
      limit 200
    `;

    const r = await pool.query(q, params);
    res.json({ ok: true, hours, filter: { level, type }, events: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// 2) Review Queue View (review_queue join artifacts + anchors)
app.get('/api/review-queue', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `where rq.status = $1`;
    }

    const q = `
      select
        rq.id as review_id,
        rq.review_type,
        rq.status,
        rq.reviewer,
        rq.requested_at,
        rq.decided_at,
        rq.decision,
        rq.promotion_target,
        rq.target_workspace_id,
        a.id as artifact_id,
        a.title as artifact_title,
        null::text as artifact_type,
        null::text as scope,
        exists(
          select 1 from artifact_anchors aa
          where aa.artifact_id = a.id
          limit 1
        ) as has_primary_anchor
      from review_queue rq
      join artifacts a on a.id = rq.artifact_id
      ${where}
      order by rq.requested_at desc
      limit 200
    `;

    const r = await pool.query(q, params);
    res.json({ ok: true, filter: { status }, items: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// 3) System Status View (counts + timestamps)
app.get('/api/system-status', async (req, res) => {
  try {
    const [
      artifacts,
      docs,
      chunks,
      events,
      reviews,
      byLevel,
      byReviewStatus,
      lastEvent,
    ] = await Promise.all([
      pool.query('select count(*)::int as n from artifacts_v1'),
      pool.query('select count(*)::int as n from knowledge_documents_v2'),
      pool.query('select count(*)::int as n from knowledge_chunks_v2'),
      pool.query('select count(*)::int as n from events_v2'),
      pool.query('select count(*)::int as n from review_queue'),
      pool.query('select event_level, count(*)::int as n from events_v2 group by 1 order by 1'),
      pool.query('select status, count(*)::int as n from review_queue group by 1 order by 1'),
      pool.query('select max(occurred_at) as ts from events_v2'),
    ]);

    const lastTs = lastEvent.rows[0]?.ts || null;

    // basic ingestion activity indicator: any ingestion events in last 24h?
    const ing = await pool.query(
      "select count(*)::int as n from events_v2 where event_level='ingestion' and occurred_at >= now() - interval '24 hours'"
    );

    res.json({
      ok: true,
      totals: {
        artifacts: artifacts.rows[0].n,
        knowledge_documents_v2: docs.rows[0].n,
        knowledge_chunks_v2: chunks.rows[0].n,
        events_v2: events.rows[0].n,
        review_queue: reviews.rows[0].n,
      },
      counts_by: {
        event_level: byLevel.rows,
        review_status: byReviewStatus.rows,
      },
      last_event_at: lastTs,
      ingestion_activity_24h: { has_activity: ing.rows[0].n > 0, count: ing.rows[0].n },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --- Tool registry + run tracking (V1.2) read-only views

app.get('/api/tools', async (req, res) => {
  try {
    const q = `
      with last_runs as (
        select distinct on (tool_id)
          tool_id,
          id,
          status,
          completed_at,
          started_at,
          error
        from tool_run_log
        order by tool_id, started_at desc nulls last
      )
      select
        t.id as tool_id,
        t.display_name,
        t.category,
        null::text as role,
        case when t.enabled then 'active' else 'disabled' end as status,
        null::text as runtime_model,
        null::int as routing_priority,
        null::boolean as auto_select,
        null::text as cost_profile,
        null::text as latency_profile,
        null::timestamptz as last_used_at,
        null::jsonb as review_requirements,
        null::text as tuning_notes,
        lr.id as last_run_id,
        null::text as last_task_summary,
        lr.status as last_status,
        lr.completed_at as last_completed_at,
        null::text as last_decision_status,
        null::boolean as last_promotion_applied,
        null::boolean as last_external_action_taken,
        lr.error as last_error
      from tool_registry t
      left join last_runs lr on lr.tool_id = t.tool_id
      order by t.enabled desc, t.display_name asc
    `;
    const r = await pool.query(q);
    res.json({ ok: true, tools: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Run View: recent runs + filters
app.get('/api/runs', async (req, res) => {
  try {
    const tool_id = req.query.tool_id ? String(req.query.tool_id) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));

    const params = [];
    const wh = [];
    if (tool_id) { params.push(tool_id); wh.push(`tool_id=$${params.length}`); }
    if (status) { params.push(status); wh.push(`status=$${params.length}`); }

    params.push(limit);

    const q = `
      select
        id as run_id,
        tool_id,
        null::text as task_summary,
        null::text as task_type,
        started_at,
        completed_at,
        null::numeric as duration_seconds,
        status,
        null::int as artifacts_created,
        null::int as events_created,
        null::boolean as review_item_created,
        null::int as parent_run_id,
        id as root_run_id,
        null::int as sequence_index,
        null::text as initiated_by,
        null::text as decision_status,
        null::boolean as promotion_applied,
        null::boolean as external_action_taken,
        error as failure_reason
      from tool_run_log
      ${wh.length ? 'where ' + wh.join(' and ') : ''}
      order by started_at desc nulls last, id desc
      limit $${params.length}
    `;

    const r = await pool.query(q, params);
    res.json({ ok: true, filter: { tool_id, status, task_type: null, decision_status: null }, runs: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Live Flow View: group related runs by root_run_id
app.get('/api/flows', async (req, res) => {
  try {
    const root_run_id = req.query.root_run_id ? String(req.query.root_run_id) : null;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 25)));

    if (root_run_id) {
      const q = `
        select
          id as run_id,
          tool_id,
          null::text as task_summary,
          null::text as task_type,
          started_at,
          completed_at,
          status,
          null::int as artifacts_created,
          null::int as events_created,
          null::boolean as review_item_created,
          null::int as parent_run_id,
          id as root_run_id,
          null::int as sequence_index,
          null::text as initiated_by,
          null::text as decision_status,
          null::boolean as promotion_applied,
          null::boolean as external_action_taken,
          error
        from tool_run_log
        where id::text = $1
        order by sequence_index asc nulls last, started_at asc nulls last, id asc
      `;
      const r = await pool.query(q, [root_run_id]);
      res.json({ ok: true, root_run_id, flow: r.rows });
      return;
    }

    const q = `
      with normalized as (
        select
          id,
          tool_id,
          started_at,
          completed_at,
          status,
          error,
          id as root_run_id,
          null::int as sequence_index
        from tool_run_log
      ), roots as (
        select distinct on (root_run_id)
          root_run_id,
          started_at as root_started_at,
          error,
          status
        from normalized
        order by root_run_id, started_at desc nulls last, id desc
      ), agg as (
        select
          root_run_id,
          count(*)::int as runs,
          bool_or(status='failed') as any_failed,
          bool_or(status='partial') as any_partial
        from normalized
        group by 1
      )
      select
        r.root_run_id,
        null::text as root_task_summary,
        r.root_started_at,
        a.runs,
        null::int as artifacts_created,
        null::int as events_created,
        a.any_failed,
        a.any_partial,
        false as any_pending_review,
        false as any_external_action,
        r.error
      from roots r
      join agg a on a.root_run_id=r.root_run_id
      order by r.root_started_at desc nulls last
      limit $1
    `;

    const r = await pool.query(q, [limit]);
    res.json({ ok: true, flows: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  // v1: store file and create knowledge_document row; no transcription yet
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'file is required (multipart field: file)' });
    }

    const { originalname, mimetype, filename, path: filePath, size } = req.file;
    const title = originalname;

    const result = await pool.query(
      `insert into knowledge_documents (source, source_id, title) values ($1,$2,$3) returning id`,
      ['upload', filename, title]
    );
    const docId = result.rows[0].id;

    // store a reference event row (optional)
    await pool.query(
      `insert into events(event_type, source_channel, source_link_id, payload_json)
       values ($1,$2,$3,$4::jsonb)`,
      ['file_uploaded', 'mission-control', 'upload', JSON.stringify({ docId, filename, originalname, mimetype, size, filePath })]
    );

    res.json({ ok: true, docId, filename, originalname, mimetype, size });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

function chunkText(text, maxChars = 2000) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if ((cur.length + p.length + 2) <= maxChars) {
      cur = (cur + '\n\n' + p).trim();
    } else {
      if (cur) chunks.push(cur);
      cur = p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function convoToText(convo) {
  const mapping = convo.mapping || {};
  const nodes = [];
  for (const node of Object.values(mapping)) {
    if (!node || typeof node !== 'object') continue;
    const msg = node.message;
    if (!msg) continue;
    const role = msg.author?.role;
    const ct = msg.create_time || 0;
    const parts = msg.content?.parts || [];
    const txt = parts.filter(p => typeof p === 'string').join('\n').trim();
    if (!txt) continue;
    nodes.push([ct, role, txt]);
  }
  nodes.sort((a,b) => (a[0]||0) - (b[0]||0));
  return nodes.map(([,role,txt]) => `[${role}] ${txt}`).join('\n\n');
}

app.post('/api/ingest/chatgpt/top30', async (req, res) => {
  // v1: take /tmp/conversations.json, select top 30% by length, ingest first N docs as chunks
  try {
    const limitDocs = Number(req.body?.limitDocs || 80);
    const file = req.body?.path || '/tmp/conversations.json';
    const raw = fs.readFileSync(file, 'utf-8');
    const convos = JSON.parse(raw);

    const scored = convos.map(c => {
      const t = convoToText(c);
      return { len: t.length, convo: c, text: t };
    }).sort((a,b) => b.len - a.len);

    const cut = Math.floor(scored.length * 0.30);
    const sel = scored.slice(0, cut).slice(0, limitDocs);

    let docsInserted = 0;
    let chunksInserted = 0;

    for (const item of sel) {
      const c = item.convo;
      const cid = c.id || c.conversation_id;
      const title = (c.title || cid || 'chatgpt').slice(0, 255);
      if (!item.text) continue;

      const existing = await pool.query('select id from knowledge_documents where source=$1 and source_id=$2', ['chatgpt', cid]);
      let docId;
      if (existing.rows.length) {
        docId = existing.rows[0].id;
        await pool.query('delete from knowledge_chunks where document_id=$1', [docId]);
      } else {
        const ins = await pool.query(
          'insert into knowledge_documents(source, source_id, title) values ($1,$2,$3) returning id',
          ['chatgpt', cid, title]
        );
        docId = ins.rows[0].id;
        docsInserted++;
      }

      const chunks = chunkText(item.text);
      for (let i=0;i<chunks.length;i++) {
        await pool.query(
          'insert into knowledge_chunks(document_id, chunk_index, text, tags, sensitivity) values ($1,$2,$3,$4::jsonb,$5)',
          [docId, i, chunks[i], JSON.stringify({ source: 'chatgpt', stage: 'raw' }), 'internal']
        );
        chunksInserted++;
      }
    }

    res.json({ ok: true, totalConvos: convos.length, selectedTop30: Math.floor(scored.length*0.30), processed: sel.length, docsInserted, chunksInserted });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/api/search', async (req, res) => {
  // placeholder (vector search comes after embeddings)
  const q = String(req.body?.q || '').trim();
  if (!q) return res.json({ ok: true, results: [] });
  const r = await pool.query(
    `select kd.title, kc.chunk_index, substring(kc.text,1,400) as snippet
     from knowledge_chunks kc
     join knowledge_documents kd on kd.id=kc.document_id
     where kc.text ilike $1
     order by kd.updated_at desc
     limit 10`,
    ['%' + q + '%']
  );

  // LOCKED: knowledge.queried must always be event_level=system
  try {
    await emitEvent(pool, {
      event_level: 'system',
      event_type: 'knowledge.queried',
      actor: 'system',
      payload: { q, result_count: r.rows.length, mode: 'keyword', route: 'POST /api/search' },
    });
  } catch (e) {
    // never block search on event logging
    console.error('event_emit_failed', String(e));
  }

  res.json({ ok: true, mode: 'keyword', results: r.rows });
});


app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, results: [] });
    const r = await pool.query(
      `select kd.title, kc.chunk_index, substring(kc.text,1,400) as snippet
       from knowledge_chunks kc
       join knowledge_documents kd on kd.id=kc.document_id
       where kc.text ilike $1
       order by kd.updated_at desc
       limit 10`,
      ['%' + q + '%']
    );

    // LOCKED: knowledge.queried must always be event_level=system
    try {
      await emitEvent(pool, {
        event_level: 'system',
        event_type: 'knowledge.queried',
        actor: 'system',
        payload: { q, result_count: r.rows.length, mode: 'keyword', route: 'GET /api/search' },
      });
    } catch (e) {
      console.error('event_emit_failed', String(e));
    }

    res.json({ ok: true, mode: 'keyword', results: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});


// Subagent configurations for Mission Control
const SUBAGENT_MODELS = {
  coding: {
    name: 'Coding Agent',
    model: 'ollama/glm-5:cloud',
    fallbacks: ['ollama/kimi-k2.5:cloud', 'ollama/minimax-m2.5:cloud'],
    description: 'Code generation, review, and refactoring'
  },
  research: {
    name: 'Research Agent',
    model: 'ollama/kimi-k2.5:cloud',
    fallbacks: ['ollama/glm-5:cloud', 'ollama/minimax-m2.5:cloud'],
    description: 'Web search, analysis, and information gathering'
  },
  writing: {
    name: 'Writing Agent',
    model: 'ollama/minimax-m2.5:cloud',
    fallbacks: ['ollama/kimi-k2.5:cloud', 'ollama/glm-5:cloud'],
    description: 'Content creation, summarization, and drafting'
  }
};

// --- Subagent Control ---
app.get('/api/subagents', async (req, res) => {
  try {
    res.json({ ok: true, agents: SUBAGENT_MODELS });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});


app.post('/api/subagents/spawn', async (req, res) => {
  const { type, task } = req.body;
  const agentConfig = SUBAGENT_MODELS[type];
  
  if (!agentConfig) {
    return res.status(400).json({ ok: false, error: 'Invalid agent type. Use: coding, research, writing' });
  }
  if (!task) {
    return res.status(400).json({ ok: false, error: 'Task is required' });
  }
  
  try {
    const { execFile } = await import('child_process');
    const sessionId = 'mc-subagent-' + Date.now();
    execFile('openclaw', ['agent', '--session-id', sessionId, '-m', task, '--timeout', '300'], { timeout: 300000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        res.status(500).json({ ok: false, error: stderr || err.message });
      } else {
        res.json({ ok: true, type, model: agentConfig.model, task, response: stdout || stderr, sessionId });
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/subagents/list', async (req, res) => {
  try {
    const { spawn } = await import('child_process');
    
    const proc = spawn('openclaw', ['sessions', '--json'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });
    
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const sessions = JSON.parse(stdout);
          res.json({ ok: true, sessions });
        } catch(e) {
          res.json({ ok: true, sessions: [], raw: stdout });
        }
      } else {
        res.status(500).json({ ok: false, error: stderr || 'Failed to list sessions' });
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Kill a subagent session
app.post('/api/subagents/:sessionId/kill', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'sessionId required' });
  }
  
  try {
    const { execFile } = await import('child_process');
    
    execFile('openclaw', ['subagents', 'kill', sessionId], (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ ok: false, error: stderr || error.message });
      } else {
        res.json({ ok: true, sessionId, killed: true, output: stdout || stderr });
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Send message to a subagent
app.post('/api/subagents/:sessionId/message', async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  
  if (!sessionId || !message) {
    return res.status(400).json({ ok: false, error: 'sessionId and message required' });
  }
  
  try {
    const { execFile } = await import('child_process');
    
    execFile('openclaw', ['subagents', 'message', sessionId, message], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ ok: false, error: stderr || error.message });
      } else {
        res.json({ ok: true, sessionId, sent: message, response: stdout || stderr });
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --- Model Management ---

// List available models from config
app.get('/api/models', async (req, res) => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const data = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(data);
    
    const models = [];
    const providers = config.models?.providers || {};
    
    for (const [provider, info] of Object.entries(providers)) {
      for (const m of info.models || []) {
        models.push({
          id: `${provider}/${m.id}`,
          name: m.name || m.id,
          provider,
          contextWindow: m.contextWindow,
          cost: m.cost,
          reasoning: m.reasoning || false
        });
      }
    }
    
    res.json({ ok: true, models });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Get current agent configuration
app.get('/api/agents/config', async (req, res) => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const data = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(data);
    
    const defaults = config.agents?.defaults;
    const agents = config.agents?.list || [];
    
    res.json({
      ok: true,
      main: {
        model: defaults?.model?.primary,
        fallbacks: defaults?.model?.fallbacks || []
      },
      subagents: {
        model: defaults?.subagents?.model?.primary,
        fallbacks: defaults?.subagents?.model?.fallbacks || []
      },
      agents: agents.map(a => ({
        id: a.id,
        name: a.identity?.name,
        model: a.model?.primary,
        fallbacks: a.model?.fallbacks || []
      })),
      subagentTypes: SUBAGENT_MODELS
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Update agent model (requires restart to take full effect)
app.post('/api/agents/:agentType/model', async (req, res) => {
  const { agentType } = req.params;
  const { model, fallbacks } = req.body;
  
  if (!agentType || !model) {
    return res.status(400).json({ ok: false, error: 'agentType and model required' });
  }
  
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const data = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(data);
    
    // Update in-memory SUBAGENT_MODELS
    if (SUBAGENT_MODELS[agentType]) {
      SUBAGENT_MODELS[agentType].model = model;
      if (fallbacks) SUBAGENT_MODELS[agentType].fallbacks = fallbacks;
    }
    
    // Also update config file for persistence
    const agentInConfig = config.agents?.list?.find(a => a.id === agentType);
    if (agentInConfig) {
      agentInConfig.model.primary = model;
      if (fallbacks) agentInConfig.model.fallbacks = fallbacks;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    
    res.json({ ok: true, agentType, model, fallbacks, note: 'Config updated. Restart may be needed for some changes.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/twilio/status', async (req, res) => {
  res.json({
    ok: true,
    configured: Boolean(twilioClient && TWILIO_PHONE_NUMBER),
    phoneNumber: TWILIO_PHONE_NUMBER || null,
    accountSidSet: Boolean(TWILIO_ACCOUNT_SID),
  });
});

app.post('/api/twilio/sms', async (req, res) => {
  res.status(403).json({
    ok: false,
    error: 'direct SMS sending is disabled; create a CRM draft task for review instead',
    code: 'customer_facing_action_requires_review',
  });
});

app.post('/api/twilio/voice', async (req, res) => {
  try {
    const { message } = req.body;
    const say = message || 'Hello from Mission Control.';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${say.replace(/[<&>]/g, '')}</Say></Response>`;
    res.type('text/xml').send(twiml);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/api/twilio/incoming', async (req, res) => {
  try {
    const from = String(req.body.From || '').replace(/[^\d+]/g, '');
    const body = String(req.body.Body || '').trim();
    const messageSid = String(req.body.MessageSid || '');
    if (!from || !body) return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);

    const tenantResult = await pool.query('select id from workspaces where name = $1 limit 1', ['default']);
    if (!tenantResult.rows.length) return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    const tenantId = tenantResult.rows[0].id;

    let contactResult = await pool.query(
      `select id, full_name, source_person_id from crm_contacts where tenant_id = $1 and (primary_phone = $2 or primary_phone like $3) limit 1`,
      [tenantId, from, `%${from.replace(/^\+?1?/, '')}`]
    );

    let contactId;
    let contactName;
    if (contactResult.rows.length) {
      contactId = contactResult.rows[0].id;
      contactName = contactResult.rows[0].full_name;
    } else {
      contactResult = await pool.query(
        `insert into crm_contacts (tenant_id, full_name, primary_phone, lifecycle_stage, status)
         values ($1, $2, $3, 'lead', 'active') returning id`,
        [tenantId, `Lead ${from.slice(-4)}`, from]
      );
      contactId = contactResult.rows[0].id;
      contactName = null;
    }

    await pool.query(
      `insert into crm_timeline_events (tenant_id, contact_id, event_type, event_level, source_channel, source_link_id, title, description, payload_json)
       values ($1, $2, 'message.sms.received', 'customer_communication', 'twilio_sms', $3, 'SMS received from customer', $4, $5::jsonb)`,
      [tenantId, contactId, messageSid, body, JSON.stringify({ sid: messageSid, from, body, direction: 'inbound' })]
    );

    await pool.query(
      `update crm_contacts set metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb, updated_at = now()
       where tenant_id = $1 and id = $2`,
      [tenantId, contactId, JSON.stringify({ last_inbound_sms_sid: messageSid, last_inbound_sms_at: new Date().toISOString(), last_inbound_sms_from: from })]
    );

    const io = getIO();
    if (io) io.emit('message:sent', { channel: 'twilio_sms', contact_id: contactId, contact_name: contactName, event_type: 'message.sms.received', direction: 'inbound' });

    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  } catch (e) {
    console.error('Inbound SMS error:', e);
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }
});

const httpServer = http.createServer(app);
initWebSocket(httpServer);

// SPA fallback (avoid path patterns; Express v5 + path-to-regexp is strict)
// Serve Mission Control UI (built from dashboard)
const distDir = path.resolve('../dashboard/dist');
app.use(express.static(distDir));

app.use((req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`mission-control-api listening on ${PORT} (0.0.0.0)`);
});
