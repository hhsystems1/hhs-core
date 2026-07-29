const EVENT_LEVELS = new Set([
  'system',
  'ingestion',
  'review',
  'decision',
  'deployment',
  'error',
  'milestone',
]);

/**
 * Event naming convention (locked for Phase 2):
 * - Lowercase
 * - Dot-delimited namespace: <domain>.<action>
 *   Examples: artifact.captured, review.requested, promotion.executed, knowledge.queried
 */
function validateEventType(eventType) {
  if (typeof eventType !== 'string' || !eventType.trim()) {
    throw new Error('event_type must be a non-empty string');
  }
  const t = eventType.trim();
  if (t !== t.toLowerCase()) throw new Error('event_type must be lowercase');
  if (!t.includes('.')) throw new Error('event_type must include a dot namespace (e.g., domain.action)');
  if (!/^[a-z0-9]+(\.[a-z0-9_]+)+$/.test(t)) {
    throw new Error('event_type must match pattern: lowercase words separated by dots (letters/numbers/underscore)');
  }
  return t;
}

function validateLevel(level, eventType) {
  if (eventType === 'knowledge.queried') {
    // Locked requirement: always system
    if (level !== 'system') throw new Error('knowledge.queried must have event_level=system');
    return;
  }
  if (!EVENT_LEVELS.has(level)) {
    throw new Error(`event_level must be one of: ${Array.from(EVENT_LEVELS).join(', ')}`);
  }
}

/**
 * emitEvent(pool, {...})
 * Minimal event emitter for events_v2.
 */
export async function emitEvent(pool, {
  event_level,
  event_type,
  actor,
  artifact_id = null,
  workspace_id = null,
  person_id = null,
  payload = {},
  occurred_at = null,
}) {
  const type = validateEventType(event_type);
  const level = String(event_level);
  validateLevel(level, type);

  if (typeof actor !== 'string' || !actor.trim()) throw new Error('actor must be a non-empty string');
  if (payload == null || typeof payload !== 'object') throw new Error('payload must be a JSON object');

  const q = `
    insert into events_v2 (
      event_type,
      event_level,
      occurred_at,
      actor,
      artifact_id,
      workspace_id,
      person_id,
      payload_json
    ) values (
      $1,
      $2,
      coalesce($3, now()),
      $4,
      $5,
      $6,
      $7,
      $8::jsonb
    )
    returning id
  `;

  const enrichedPayload = {
    ...payload,
  };

  const r = await pool.query(q, [
    type,
    level,
    occurred_at,
    actor.trim(),
    artifact_id,
    workspace_id,
    person_id,
    JSON.stringify(enrichedPayload),
  ]);

  return r.rows[0].id;
}

export const EVENT_MODEL = {
  levels: Array.from(EVENT_LEVELS),
  naming: 'lowercase dot-delimited: <domain>.<action>',
  locked: {
    'knowledge.queried': { event_level: 'system' },
  },
};
