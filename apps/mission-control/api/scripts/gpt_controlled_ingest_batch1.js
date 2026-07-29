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

function extractMessages(conv) {
  const out = [];
  if (conv?.mapping && typeof conv.mapping === 'object') {
    for (const n of Object.values(conv.mapping)) {
      const m = n?.message;
      if (!m) continue;
      const role = m?.author?.role || 'unknown';
      const content = m?.content;
      const content_type = content?.content_type || 'unknown';
      const parts = Array.isArray(content?.parts) ? content.parts : [];
      const text = parts.map(p => safeString(p)).join('\n').trim();
      out.push({ role, content_type, text });
    }
    return out;
  }
  if (Array.isArray(conv?.messages)) {
    for (const m of conv.messages) {
      out.push({ role: m?.role || 'unknown', content_type: m?.content_type || 'text', text: safeString(m?.content || '').trim() });
    }
  }
  return out;
}

function flattenConversation(conv) {
  const msgs = extractMessages(conv)
    .filter(m => m.text)
    .map(m => `[${m.role}] ${m.text}`);
  return msgs.join('\n\n');
}

function hasImages(conv) {
  const msgs = extractMessages(conv);
  for (const m of msgs) {
    if (m.content_type && m.content_type !== 'text') return true;
    if (/\b(image|png|jpg|jpeg|screenshot)\b/i.test(m.text || '')) return true;
  }
  // also check for known export fields
  if (conv?.attachments && Array.isArray(conv.attachments) && conv.attachments.length) return true;
  return false;
}

function scoreConv(conv) {
  return flattenConversation(conv).length;
}

function makeSummary(text) {
  const cleaned = safeString(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 280);
}

function detectSignals(text) {
  const t = safeString(text);
  const doSignals = [];
  const dontSignals = [];

  const doRe = [
    /\bdo\b[^\n\.]*/gi,
    /\bmust\b[^\n\.]*/gi,
    /\bshould\b[^\n\.]*/gi,
  ];
  const dontRe = [
    /\bdon't\b[^\n\.]*/gi,
    /\bdo not\b[^\n\.]*/gi,
    /\bnever\b[^\n\.]*/gi,
  ];

  for (const re of doRe) {
    const m = t.match(re);
    if (m) doSignals.push(...m.slice(0, 5));
  }
  for (const re of dontRe) {
    const m = t.match(re);
    if (m) dontSignals.push(...m.slice(0, 5));
  }

  return {
    possible_dos: Array.from(new Set(doSignals.map(s => s.trim()))).slice(0, 8),
    possible_donts: Array.from(new Set(dontSignals.map(s => s.trim()))).slice(0, 8),
  };
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

  const batchId = `gpt_batch1_${Date.now()}`;

  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `GPT Controlled Ingestion — Batch 1 (${batchId})`,
    attributes: { batchId, batch: 1, purpose: 'controlled_ingestion' },
    actor: 'system',
  });

  const data = JSON.parse(fs.readFileSync('/tmp/conversations.json', 'utf8'));
  const convos = Array.isArray(data) ? data : (Array.isArray(data?.conversations) ? data.conversations : []);

  // Exclude already ingested chatgpt artifacts (idempotency by source/source_ref)
  const existing = await pool.query("select source_ref from artifacts where source='chatgpt'");
  const existingSet = new Set(existing.rows.map(r => r.source_ref));

  const ranked = convos
    .map((c, idx) => ({ idx, c, score: scoreConv(c) }))
    .filter(x => {
      const source_ref = safeString(x.c?.id || x.c?.conversation_id || x.c?.uuid || `idx_${x.idx}`);
      return !existingSet.has(source_ref);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const results = [];
  const topics = new Map();
  let imagesCount = 0;

  for (const r of ranked) {
    const conv = r.c;
    const source_ref = safeString(conv?.id || conv?.conversation_id || conv?.uuid || `idx_${r.idx}`);
    const title = safeString(conv?.title || conv?.name || 'Untitled GPT conversation') || 'Untitled GPT conversation';
    const text = flattenConversation(conv);

    const images_present = hasImages(conv);
    if (images_present) imagesCount++;

    // crude topic signals (raw)
    const low = (title + ' ' + text.slice(0, 2000)).toLowerCase();
    for (const k of ['solar','web','crm','pipeline','sop','marketing','ads','prompt','automation','voice','discord','calendar','proposal','finance','grant']) {
      if (low.includes(k)) topics.set(k, (topics.get(k) || 0) + 1);
    }

    const artifactId = await createArtifact(pool, {
      source: 'chatgpt',
      source_ref,
      title,
      artifact_type: 'conversation',
      scope: 'personal_context',
      sensitivity: 'personal',
      attributes: { batchId, score: r.score, images_present },
      actor: 'system',
    });

    await addPrimaryAnchor(pool, { artifact_id: artifactId, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

    let docId = null;
    let chunksInserted = 0;
    let summary = null;
    if (text.trim()) {
      summary = makeSummary(text);
      docId = await createKnowledgeDocument(pool, {
        artifact_id: artifactId,
        title,
        scope: 'personal_context',
        summary,
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

    const signals = detectSignals(text);

    results.push({ title, source_ref, artifactId, docId, chunksInserted, summary, images_present, signals });
  }

  const totals = await pool.query(
    `select
       (select count(*)::int from artifacts where source='chatgpt' and attributes->>'batchId'=$1) as artifacts,
       (select count(*)::int from knowledge_documents_v2 where tags->>'batchId'=$1) as documents,
       (select count(*)::int from knowledge_chunks_v2 where document_id in (select id from knowledge_documents_v2 where tags->>'batchId'=$1)) as chunks,
       (select count(*)::int from events_v2 where artifact_id in (select id from artifacts where attributes->>'batchId'=$1)) as events`,
    [batchId]
  );

  const weakKnowledge = results
    .filter(x => !x.docId || x.chunksInserted < 2)
    .map(x => ({ title: x.title, source_ref: x.source_ref, chunksInserted: x.chunksInserted }));

  const out = {
    batchId,
    totals: totals.rows[0],
    samples: {
      artifacts: results.slice(0, 5).map(x => ({ title: x.title, source_ref: x.source_ref })),
      summaries: results.filter(x => x.summary).slice(0, 3).map(x => ({ title: x.title, summary: x.summary })),
    },
    issues: {
      missing_anchors: [],
      weak_knowledge: weakKnowledge,
    },
    raw_signals: {
      images_present_count: imagesCount,
      possible_dos: results.flatMap(x => x.signals.possible_dos).slice(0, 15),
      possible_donts: results.flatMap(x => x.signals.possible_donts).slice(0, 15),
    },
    insights: {
      repeated_topics: Array.from(topics.entries()).sort((a,b) => b[1]-a[1]).slice(0, 12).map(([k,v]) => ({ topic: k, count: v })),
    },
  };

  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}

main();
