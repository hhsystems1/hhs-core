import { emitEvent } from './events.js';

const ANCHOR_TYPES = new Set(['person', 'workspace']);

export const ARTIFACT_MODEL = {
  idempotency_key: ['source', 'source_ref'],
  default_scope: 'personal_context',
  primary_anchor_rule: 'Every artifact must have >=1 primary anchor: person OR workspace',
};

export async function createArtifact(pool, {
  source,
  source_ref,
  title = null,
  artifact_type,
  scope = 'personal_context',
  sensitivity = 'personal',
  attributes = {},
  actor = 'system',
}) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('source is required');
  if (typeof source_ref !== 'string' || !source_ref.trim()) throw new Error('source_ref is required');
  if (typeof artifact_type !== 'string' || !artifact_type.trim()) throw new Error('artifact_type is required');
  if (attributes == null || typeof attributes !== 'object') throw new Error('attributes must be a JSON object');

  const r = await pool.query(
    `insert into artifacts(source, source_ref, title, artifact_type, scope, sensitivity, attributes)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     returning id`,
    [
      source.trim(),
      source_ref.trim(),
      title,
      artifact_type.trim(),
      scope,
      sensitivity,
      JSON.stringify(attributes),
    ]
  );

  const id = r.rows[0].id;

  // Locked: log ingestion event
  try {
    await emitEvent(pool, {
      event_level: 'ingestion',
      event_type: 'artifact.captured',
      actor,
      artifact_id: id,
      payload: { source: source.trim(), source_ref: source_ref.trim(), artifact_type: artifact_type.trim() },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  return id;
}

export async function addPrimaryAnchor(pool, {
  artifact_id,
  anchor_entity_id,
  anchor_type,
  actor = 'system',
}) {
  if (!artifact_id) throw new Error('artifact_id is required');
  if (!anchor_entity_id) throw new Error('anchor_entity_id is required');
  const t = String(anchor_type);
  if (!ANCHOR_TYPES.has(t)) throw new Error('anchor_type must be person or workspace');

  await pool.query(
    `insert into artifact_anchors(artifact_id, anchor_entity_id, anchor_type, is_primary)
     values ($1,$2,$3,true)
     on conflict (artifact_id, anchor_entity_id) do update set is_primary=true`,
    [artifact_id, anchor_entity_id, t]
  );

  try {
    await emitEvent(pool, {
      event_level: 'ingestion',
      event_type: 'artifact.anchor_set',
      actor,
      artifact_id,
      payload: { anchor_entity_id, anchor_type: t },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }
}

export async function hasPrimaryAnchor(pool, artifact_id) {
  const r = await pool.query(
    `select 1
     from artifact_anchors
     where artifact_id=$1 and is_primary=true and anchor_type in ('person','workspace')
     limit 1`,
    [artifact_id]
  );
  return r.rowCount > 0;
}

/**
 * Locked enforcement behavior:
 * - if no primary anchor exists:
 *   - emit artifact.primary_anchor_missing (error)
 *   - emit promotion.blocked_missing_anchor (review)
 *   - return { ok:false, blocked:true }
 */
export async function requirePrimaryAnchorForPromotion(pool, {
  artifact_id,
  actor = 'system',
  context = {},
}) {
  const ok = await hasPrimaryAnchor(pool, artifact_id);
  if (ok) return { ok: true, blocked: false };

  // Locked: emit both events
  try {
    await emitEvent(pool, {
      event_level: 'error',
      event_type: 'artifact.primary_anchor_missing',
      actor,
      artifact_id,
      payload: { ...context },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  try {
    await emitEvent(pool, {
      event_level: 'review',
      event_type: 'promotion.blocked_missing_anchor',
      actor,
      artifact_id,
      payload: { ...context },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  return { ok: false, blocked: true };
}
