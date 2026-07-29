import { emitEvent } from './events.js';

const ENTITY_TYPES = new Set(['person', 'organization', 'workspace']);

// Relationship type convention: <from_type>.<verb>.<to_type>
// Examples:
// - person.belongs_to.organization
// - workspace.has.organization
// - person.assigned_to.workspace
function validateRelationshipType(rel) {
  if (typeof rel !== 'string' || !rel.trim()) throw new Error('relationship_type must be a non-empty string');
  const t = rel.trim();
  if (t !== t.toLowerCase()) throw new Error('relationship_type must be lowercase');
  if (!t.includes('.')) throw new Error('relationship_type must include dots');
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(t)) {
    throw new Error('relationship_type must match pattern: lowercase segments separated by dots');
  }
  return t;
}

export const ENTITY_MODEL = {
  types: Array.from(ENTITY_TYPES),
  relationship_type_convention: '<from_type>.<verb>.<to_type> (lowercase dot-delimited)',
  examples: [
    'person.belongs_to.organization',
    'workspace.has.organization',
    'person.assigned_to.workspace',
  ],
};

export async function createEntity(pool, {
  entity_type,
  display_name,
  attributes = {},
  actor = 'system',
}) {
  const type = String(entity_type);
  if (!ENTITY_TYPES.has(type)) throw new Error(`entity_type must be one of: ${Array.from(ENTITY_TYPES).join(', ')}`);
  if (typeof display_name !== 'string' || !display_name.trim()) throw new Error('display_name must be a non-empty string');
  if (attributes == null || typeof attributes !== 'object') throw new Error('attributes must be a JSON object');

  const r = await pool.query(
    `insert into entities(entity_type, display_name, attributes)
     values ($1,$2,$3::jsonb)
     returning id`,
    [type, display_name.trim(), JSON.stringify(attributes)]
  );

  const id = r.rows[0].id;

  // log event (Phase 3): entity.created
  try {
    await emitEvent(pool, {
      event_level: 'system',
      event_type: 'entity.created',
      actor,
      payload: { entity_type: type, entity_id: id, display_name: display_name.trim() },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  return id;
}

export async function linkEntities(pool, {
  from_entity_id,
  to_entity_id,
  relationship_type,
  attributes = {},
  actor = 'system',
}) {
  if (!from_entity_id) throw new Error('from_entity_id is required');
  if (!to_entity_id) throw new Error('to_entity_id is required');
  const rel = validateRelationshipType(relationship_type);
  if (attributes == null || typeof attributes !== 'object') throw new Error('attributes must be a JSON object');

  const r = await pool.query(
    `insert into entity_links(from_entity_id, to_entity_id, relationship_type, attributes)
     values ($1,$2,$3,$4::jsonb)
     returning id`,
    [from_entity_id, to_entity_id, rel, JSON.stringify(attributes)]
  );

  const id = r.rows[0].id;

  // log event (Phase 3): entity.link_created
  try {
    await emitEvent(pool, {
      event_level: 'system',
      event_type: 'entity.link_created',
      actor,
      payload: { link_id: id, from_entity_id, to_entity_id, relationship_type: rel },
    });
  } catch (e) {
    console.error('event_emit_failed', String(e));
  }

  return id;
}
