import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { emitEvent } from './events.js';
import { assignReview, decideReview } from './review.js';
import { createKnowledgeDocument, createKnowledgeChunks, chunkText } from './knowledge.js';

const MARKDOWN_LINK_RE = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const BARE_URL_RE = /(?:^|\s)(https?:\/\/[^\s)]+)/g;

function extractLinks(content) {
  const links = new Set();
  const text = String(content || '');
  for (const m of text.matchAll(MARKDOWN_LINK_RE)) links.add(m[1].replace(/[.,;:]+$/, ''));
  for (const m of text.matchAll(BARE_URL_RE)) links.add(m[1].replace(/[.,;:]+$/, ''));
  return Array.from(links).slice(0, 100);
}

function safeString(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function probeCli(cmd, args, { timeoutMs = 4000 } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const code = err.code;
        const detail = String(stderr || err.message || '').trim().slice(0, 400);
        return resolve({ ok: false, code: code || 'error', detail: detail || 'command failed' });
      }
      resolve({ ok: true, detail: String(stdout || stderr || '').trim().slice(0, 1200) });
    });
  });
}

async function probeHttp(url, { timeoutMs = 4000 } = {}) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: r.ok, code: `http_${r.status}`, detail: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, code: 'unreachable', detail: String(e?.message || e).slice(0, 200) };
  }
}

function probeConnection({ name, url, cli, args }) {
  return async () => {
    if (url) {
      const r = await probeHttp(url);
      return { name, url, mode: 'http', connected: r.ok, detail: r.detail, code: r.code };
    }
    const r = await probeCli(cli, args);
    return { name, cli: `${cli} ${args.join(' ')}`, mode: 'cli', connected: r.ok, detail: r.detail, code: r.code };
  };
}

export function registerSystemRoutes(app, pool, { upload }) {
  // --- Connection status: which agents/runtimes are live and connected ---
  app.get('/api/connections/status', async (req, res) => {
    const probes = [
      probeConnection({
        name: 'OpenClaw',
        url: process.env.OPENCLAW_URL,
        cli: 'openclaw',
        args: ['status', '--all'],
      }),
      probeConnection({
        name: 'Hermes',
        url: process.env.HERMES_URL,
        cli: process.env.HERMES_BINARY || 'hermes',
        args: ['--version'],
      }),
      probeConnection({
        name: 'Codex',
        url: process.env.CODEX_URL,
        cli: 'codex',
        args: ['--version'],
      }),
    ];

    const results = await Promise.all(probes.map((p) => p()));

    let dbOk = true;
    try {
      await pool.query('select 1');
    } catch (e) {
      dbOk = false;
    }

    res.json({
      ok: true,
      checked_at: new Date().toISOString(),
      gateway: { name: 'Mission Control API', connected: true, detail: dbOk ? 'API + database live' : 'API live, database unreachable' },
      connections: results,
    });
  });

  // --- Review: move a queued review into review
  app.post('/api/review/:reviewId/assign', async (req, res) => {
    try {
      const reviewId = req.params.reviewId;
      const actor = req.session?.email || req.user?.email || 'stephen';
      await assignReview(pool, { review_id: reviewId, actor });
      res.json({ ok: true, review_id: reviewId, status: 'in_review' });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e) });
    }
  });

  // --- Review: approve / reject / changes_requested (auto-assigns if queued) ---
  app.post('/api/review/:reviewId/decision', async (req, res) => {
    try {
      const reviewId = req.params.reviewId;
      const { decision } = req.body || {};
      const actor = req.session?.email || req.user?.email || 'stephen';

      if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
        return res.status(400).json({ ok: false, error: 'invalid decision' });
      }

      const current = await pool.query('select status from review_queue where id=$1', [reviewId]);
      if (!current.rows[0]) return res.status(404).json({ ok: false, error: 'review not found' });

      if (current.rows[0].status === 'queued') {
        await assignReview(pool, { review_id: reviewId, actor });
      }

      const promotionTarget = String(req.body?.promotion_target || 'business_core');
      const status = await decideReview(pool, {
        review_id: reviewId,
        decision,
        promotion_target: promotionTarget,
        target_workspace_id: req.body?.target_workspace_id || null,
        actor,
      });

      res.json({ ok: true, review_id: reviewId, decision, status });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e) });
    }
  });

  // --- Context documents: uploaded .md reference material for agents ---
  app.get('/api/context/documents', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      const result = await pool.query(
        `select id, title, filename, content, links, source, uploaded_by, artifact_id, knowledge_document_id, created_at, updated_at
         from context_documents
         where tenant_id = $1 or tenant_id is null
         order by created_at desc
         limit 200`,
        [tenantId]
      );

      const docs = result.rows.map((row) => ({
        ...row,
        links: row.links || [],
        content_preview: String(row.content || '').slice(0, 600),
      }));

      res.json({ ok: true, documents: docs });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_documents_list_failed' });
    }
  });

  app.post('/api/context/documents', upload.single('file'), async (req, res) => {
    let tempPath = null;
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'file is required (multipart field: file)' });
      }
      tempPath = req.file.path;

      const ext = path.extname(req.file.originalname || '').toLowerCase();
      if (!['.md', '.markdown', '.txt'].includes(ext)) {
        return res.status(400).json({ ok: false, error: 'only .md / .markdown / .txt files are supported' });
      }

      const content = fs.readFileSync(tempPath, 'utf8').slice(0, 200000);
      const title = safeString(req.body?.title, 300) || path.basename(req.file.originalname, path.extname(req.file.originalname || '')) || 'Untitled';
      const links = extractLinks(content);
      const tenantId = req.tenant?.id || null;
      const actor = req.session?.email || req.user?.email || 'stephen';

      const artifactRef = randomUUID();
      const artifact = await pool.query(
        `insert into artifacts(source, source_ref, title, artifact_type, scope, sensitivity, attributes)
         values ('mission-control', $1, $2, 'context_document', 'personal_context', 'internal', $3::jsonb)
         returning id`,
        [artifactRef, title, JSON.stringify({ links, kind: 'context-document' })]
      );
      const artifactId = artifact.rows[0].id;

      const docId = await createKnowledgeDocument(pool, {
        artifact_id: artifactId,
        title,
        scope: 'personal_context',
        summary: `Uploaded context document (${links.length} links)`,
        tags: { source: 'context-upload', links },
        actor,
      });

      const chunks = chunkText(content, { maxLen: 1200 });
      const chunksInserted = await createKnowledgeChunks(pool, {
        document_id: docId,
        chunks,
        tags: { source: 'context-upload' },
        actor,
      });

      const inserted = await pool.query(
        `insert into context_documents(tenant_id, title, filename, content, links, source, uploaded_by, artifact_id, knowledge_document_id)
         values ($1, $2, $3, $4, $5::jsonb, 'upload', $6, $7, $8)
         returning id, title, filename, content, links, source, uploaded_by, artifact_id, knowledge_document_id, created_at, updated_at`,
        [tenantId, title, req.file.originalname, content, JSON.stringify(links), actor, artifactId, docId]
      );

      try {
        await emitEvent(pool, {
          event_level: 'ingestion',
          event_type: 'context.document_uploaded',
          actor,
          artifact_id: artifactId,
          payload: { document_id: inserted.rows[0].id, title, chunks: chunksInserted, links: links.length },
        });
      } catch (e) {
        console.error('event_emit_failed', String(e));
      }

      const row = inserted.rows[0];
      res.status(201).json({
        ok: true,
        document: { ...row, links: row.links || [], content_preview: String(row.content || '').slice(0, 600) },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_document_upload_failed' });
    } finally {
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
    }
  });

  app.delete('/api/context/documents/:id', async (req, res) => {
    try {
      const tenantId = req.tenant?.id || null;
      const result = await pool.query(
        `select artifact_id, knowledge_document_id from context_documents
         where id = $1 and (tenant_id = $2 or tenant_id is null)`,
        [req.params.id, tenantId]
      );
      if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'document not found' });

      const { artifact_id, knowledge_document_id } = result.rows[0];

      await pool.query('delete from context_documents where id=$1', [req.params.id]);
      if (knowledge_document_id) {
        await pool.query('delete from knowledge_documents_v2 where id=$1', [knowledge_document_id]);
      }
      if (artifact_id) {
        await pool.query('delete from artifacts where id=$1', [artifact_id]);
      }

      res.json({ ok: true, deleted: req.params.id });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e), code: 'context_document_delete_failed' });
    }
  });
}
