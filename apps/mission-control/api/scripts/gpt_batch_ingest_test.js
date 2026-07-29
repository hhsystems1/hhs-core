import fs from 'fs';
import pg from 'pg';
import { createEntity } from '../entities.js';
import { createArtifact, addPrimaryAnchor } from '../artifacts.js';
import { chunkText, createKnowledgeDocument, createKnowledgeChunks } from '../knowledge.js';

const { Pool } = pg;

function loadEnv(envPath) {
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    process.env[l.slice(0, i)] = l.slice(i + 1);
  }
}

function safeString(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return String(x);
}

function flattenConversation(conv) {
  // Handle common ChatGPT export shapes.
  // Prefer mapping-based exports: conv.mapping[nodeId].message.content.parts
  if (conv?.mapping && typeof conv.mapping === 'object') {
    const nodes = Object.values(conv.mapping);
    const msgs = [];
    for (const n of nodes) {
      const m = n?.message;
      if (!m) continue;
      const role = m?.author?.role || 'unknown';
      const parts = m?.content?.parts;
      if (Array.isArray(parts) && parts.length) {
        const text = parts.map(p => safeString(p)).join('\n');
        if (text.trim()) msgs.push(`[${role}] ${text.trim()}`);
      }
    }
    // Keep deterministic order by created_time when available
    msgs.sort((a, b) => {
      const ta = a.match(/\{created:(\d+)\}/)?.[1];
      const tb = b.match(/\{created:(\d+)\}/)?.[1];
      return (ta ? Number(ta) : 0) - (tb ? Number(tb) : 0);
    });
    return msgs.join('\n\n');
  }

  // Fallback: conv.messages array
  if (Array.isArray(conv?.messages)) {
    return conv.messages
      .map(m => {
        const role = m?.role || 'unknown';
        const content = m?.content || '';
        return `[${role}] ${safeString(content).trim()}`;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  // Last resort
  return safeString(conv?.text || conv?.content || '');
}

function scoreConv(conv) {
  const t = flattenConversation(conv);
  return t.length;
}

function makeSummary(text) {
  const cleaned = safeString(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 280);
}

async function main() {
  loadEnv('/Users/turtleclaw/.openclaw/workspace/mission-control/api/.env');

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'hhs',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'hhs',
  });

  const batchId = `gpt_batch_test_${Date.now()}`;

  // Create a workspace anchor for the batch (primary lens = workspace)
  const workspaceId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `GPT Batch Test (${batchId})`,
    attributes: { batchId, purpose: 'first_ingestion_test' },
    actor: 'system',
  });

  const raw = fs.readFileSync('/tmp/conversations.json', 'utf8');
  const data = JSON.parse(raw);
  const convos = Array.isArray(data) ? data : (Array.isArray(data?.conversations) ? data.conversations : []);
  if (!convos.length) throw new Error('No conversations found in export');

  // Pick 8 longest conversations (small batch) deterministically
  const ranked = convos
    .map((c, idx) => ({ idx, c, score: scoreConv(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const results = [];

  for (const r of ranked) {
    const conv = r.c;
    const source_ref = safeString(conv?.id || conv?.conversation_id || conv?.uuid || `idx_${r.idx}`);
    const title = safeString(conv?.title || conv?.name || 'Untitled GPT conversation') || 'Untitled GPT conversation';
    const text = flattenConversation(conv);

    // artifact
    const artifactId = await createArtifact(pool, {
      source: 'chatgpt',
      source_ref,
      title,
      artifact_type: 'conversation',
      scope: 'personal_context',
      sensitivity: 'personal',
      attributes: { batchId, score: r.score },
      actor: 'system',
    });

    // anchor to batch workspace
    await addPrimaryAnchor(pool, {
      artifact_id: artifactId,
      anchor_entity_id: workspaceId,
      anchor_type: 'workspace',
      actor: 'system',
    });

    // knowledge
    let docId = null;
    let chunksInserted = 0;
    if (text.trim()) {
      docId = await createKnowledgeDocument(pool, {
        artifact_id: artifactId,
        title,
        scope: 'personal_context',
        summary: makeSummary(text),
        tags: { source: 'chatgpt', batchId },
        actor: 'system',
      });
      const chunks = chunkText(text, { maxLen: 1200 });
      chunksInserted = await createKnowledgeChunks(pool, {
        document_id: docId,
        chunks,
        tags: { source: 'chatgpt', batchId },
        actor: 'system',
      });
    }

    results.push({ title, source_ref, artifactId, docId, chunksInserted });
  }

  // Summaries for report
  const docs = await pool.query(
    `select title, summary
     from knowledge_documents_v2
     where tags->>'batchId' = $1
     order by created_at asc`,
    [batchId]
  );

  const events = await pool.query(
    `select event_level, event_type, occurred_at, actor, artifact_id
     from events_v2
     where artifact_id in (
       select id from artifacts where attributes->>'batchId' = $1
     )
     and event_level='ingestion'
     order by occurred_at desc
     limit 50`,
    [batchId]
  );

  const totals = await pool.query(
    `select
       (select count(*)::int from artifacts where attributes->>'batchId'=$1) as artifacts,
       (select count(*)::int from knowledge_documents_v2 where tags->>'batchId'=$1) as documents,
       (select count(*)::int from knowledge_chunks_v2 where document_id in (select id from knowledge_documents_v2 where tags->>'batchId'=$1)) as chunks`,
    [batchId]
  );

  const out = {
    batchId,
    workspaceId,
    totals: totals.rows[0],
    artifacts_sample: results.slice(0, 5).map(x => ({ title: x.title, source_ref: x.source_ref })),
    summaries_sample: docs.rows.slice(0, 3),
    ingestion_events_recent: events.rows,
    missing_anchor_items: [],
    items_without_knowledge: results.filter(x => !x.docId).map(x => ({ title: x.title, source_ref: x.source_ref })),
  };

  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}

main();
