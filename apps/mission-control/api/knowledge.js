import { emitEvent } from './events.js';

export const KNOWLEDGE_MODEL = {
  document_table: 'knowledge_documents_v2',
  chunk_table: 'knowledge_chunks_v2',
  traceability: 'knowledge_documents_v2.artifact_id (required) and knowledge_chunks_v2.document_id (required)',
};

/**
 * Minimal chunking (Phase 5): split text into ~maxLen character chunks.
 * No optimization; deterministic and retrieval-ready.
 */
export function chunkText(text, { maxLen = 1200 } = {}) {
  const t = String(text || '');
  const cleaned = t.replace(/\r\n/g, '\n');
  if (!cleaned.trim()) return [];

  const parts = [];
  let i = 0;
  while (i < cleaned.length) {
    parts.push(cleaned.slice(i, i + maxLen));
    i += maxLen;
  }
  return parts;
}

export async function createKnowledgeDocument(pool, {
  artifact_id,
  title = null,
  scope = 'personal_context',
  summary = null,
  tags = {},
  actor = 'system',
}) {
  if (!artifact_id) throw new Error('artifact_id is required');
  if (tags == null || typeof tags !== 'object') throw new Error('tags must be a JSON object');

  const r = await pool.query(
    `insert into knowledge_documents_v2(artifact_id, title, scope, summary, tags)
     values ($1,$2,$3,$4,$5::jsonb)
     returning id`,
    [artifact_id, title, scope, summary, JSON.stringify(tags)]
  );

  const id = r.rows[0].id;

  // Locked Phase 5 requirement: emit artifact.processed (ingestion) when knowledge layer is created
  try {
    await emitEvent(pool, {
      event_level: 'ingestion',
      event_type: 'artifact.processed',
      actor,
      artifact_id,
      payload: { knowledge_document_id: id },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  return id;
}

export async function createKnowledgeChunks(pool, {
  document_id,
  chunks,
  tags = {},
  actor = 'system',
}) {
  if (!document_id) throw new Error('document_id is required');
  if (!Array.isArray(chunks)) throw new Error('chunks must be an array');
  if (tags == null || typeof tags !== 'object') throw new Error('tags must be a JSON object');

  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const text = String(chunks[i] || '').trim();
    if (!text) continue;
    await pool.query(
      `insert into knowledge_chunks_v2(document_id, chunk_index, text, tags)
       values ($1,$2,$3,$4::jsonb)`,
      [document_id, i, text, JSON.stringify(tags)]
    );
    inserted++;
  }

  // Optional event for chunk creation (system). Not required by Phase 5.
  try {
    await emitEvent(pool, {
      event_level: 'system',
      event_type: 'knowledge.chunks_created',
      actor,
      payload: { document_id, inserted },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  return inserted;
}
