import { emitEvent } from './events.js';
import { createArtifact, addPrimaryAnchor } from './artifacts.js';
import { chunkText, createKnowledgeDocument, createKnowledgeChunks } from './knowledge.js';
import { requestReview } from './review.js';

/**
 * Phase 7: THE_VITAL ingestion adapter (integration only; no redesign).
 *
 * Input contract (minimal):
 * {
 *   source_ref: string (stable id),
 *   title?: string,
 *   artifact_type: string,
 *   text?: string (optional usable content),
 *   anchors?: { person_id?: uuid, workspace_id?: uuid },
 *   queue_review?: Array<{ review_type: 'promotion'|'scope_change'|'classification', notes?: string }>
 * }
 */

function isUniqueViolation(err) {
  return String(err?.code) === '23505' || /unique/i.test(String(err));
}

async function getArtifactIdBySourceRef(pool, { source, source_ref }) {
  const r = await pool.query(
    `select id from artifacts where source=$1 and source_ref=$2 limit 1`,
    [source, source_ref]
  );
  return r.rows[0]?.id || null;
}

export async function ingestTheVitalItem(pool, item, { actor = 'system' } = {}) {
  const source = 'the_vital';
  const source_ref = String(item?.source_ref || '').trim();
  const artifact_type = String(item?.artifact_type || '').trim();
  const title = item?.title ?? null;

  if (!source_ref) throw new Error('source_ref is required');
  if (!artifact_type) throw new Error('artifact_type is required');

  // 1) Idempotent artifact creation
  let artifact_id = null;
  let created = false;
  try {
    artifact_id = await createArtifact(pool, {
      source,
      source_ref,
      title,
      artifact_type,
      actor,
    });
    created = true;
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    artifact_id = await getArtifactIdBySourceRef(pool, { source, source_ref });
    created = false;
  }

  if (!artifact_id) throw new Error('failed to resolve artifact_id');

  // If artifact already existed, we do not emit artifact.captured again (keeps idempotency clean).
  // createArtifact emits artifact.captured on the creation path only.

  // 2) Anchors: assign primary anchor if known; else flag missing anchor
  const person_id = item?.anchors?.person_id || null;
  const workspace_id = item?.anchors?.workspace_id || null;

  // If artifact already existed, avoid emitting duplicate anchor_set unless we are adding an anchor that doesn't exist yet.
  const existingAnchor = await pool.query(
    `select 1 from artifact_anchors where artifact_id=$1 limit 1`,
    [artifact_id]
  );
  const hasAnyAnchor = existingAnchor.rowCount > 0;

  if (person_id && (!hasAnyAnchor || created)) {
    await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: person_id, anchor_type: 'person', actor });
  } else if (workspace_id && (!hasAnyAnchor || created)) {
    await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: workspace_id, anchor_type: 'workspace', actor });
  } else if (!hasAnyAnchor) {
    // Phase 7 requirement: if anchor missing, emit artifact.primary_anchor_missing (error)
    await emitEvent(pool, {
      event_level: 'error',
      event_type: 'artifact.primary_anchor_missing',
      actor,
      artifact_id,
      payload: { source_ref },
    });
  }

  // 3) Knowledge layer if usable content exists
  const text = (item?.text ?? '').toString();
  let knowledge_document_id = null;
  let chunks_inserted = 0;

  // Idempotent knowledge: do not create duplicate knowledge documents for the same artifact.
  const existingDoc = await pool.query(
    `select id from knowledge_documents_v2 where artifact_id=$1 order by created_at desc limit 1`,
    [artifact_id]
  );
  const hasDoc = existingDoc.rowCount > 0;

  if (text.trim() && !hasDoc) {
    knowledge_document_id = await createKnowledgeDocument(pool, {
      artifact_id,
      title: title || null,
      scope: 'personal_context',
      tags: { source: 'the_vital' },
      actor,
    });

    const chunks = chunkText(text, { maxLen: 1200 });
    chunks_inserted = await createKnowledgeChunks(pool, {
      document_id: knowledge_document_id,
      chunks,
      tags: { source: 'the_vital' },
      actor,
    });
    // createKnowledgeDocument emits artifact.processed (ingestion)
  } else if (hasDoc) {
    knowledge_document_id = existingDoc.rows[0].id;
  }

  // 4) Queue review items if requested
  const queued = [];
  const reqs = Array.isArray(item?.queue_review) ? item.queue_review : [];
  for (const r of reqs) {
    const review_type = String(r?.review_type || '').trim();
    if (!['promotion', 'scope_change', 'classification'].includes(review_type)) {
      throw new Error('invalid review_type for queue_review');
    }
    const review_id = await requestReview(pool, {
      artifact_id,
      requested_by: 'system',
      reviewer: 'stephen',
      review_type,
      notes: r?.notes ?? null,
      actor,
    });
    queued.push({ review_type, review_id });
    // requestReview emits review.requested
  }

  return {
    ok: true,
    artifact_id,
    created,
    knowledge_document_id,
    chunks_inserted,
    queued,
  };
}
