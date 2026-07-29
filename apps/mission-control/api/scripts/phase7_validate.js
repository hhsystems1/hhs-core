import fs from 'fs';
import pg from 'pg';
import { createEntity } from '../entities.js';
import { ingestTheVitalItem } from '../ingest_the_vital.js';

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

loadEnv('/Users/turtleclaw/.openclaw/workspace/mission-control/api/.env');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'hhs',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'hhs',
});

async function counts() {
  const [a, d, c, e, rq] = await Promise.all([
    pool.query('select count(*)::int as n from artifacts'),
    pool.query('select count(*)::int as n from knowledge_documents_v2'),
    pool.query('select count(*)::int as n from knowledge_chunks_v2'),
    pool.query('select count(*)::int as n from events_v2'),
    pool.query('select count(*)::int as n from review_queue'),
  ]);
  return { artifacts: a.rows[0].n, docs: d.rows[0].n, chunks: c.rows[0].n, events: e.rows[0].n, review_queue: rq.rows[0].n };
}

async function eventsFor(artifact_id) {
  const r = await pool.query(
    `select event_level, event_type
     from events_v2
     where artifact_id=$1
     order by occurred_at asc`,
    [artifact_id]
  );
  return r.rows;
}

async function main() {
  const before = await counts();

  const wsId = await createEntity(pool, { entity_type: 'workspace', display_name: 'PHASE7 Workspace', actor: 'system' });
  const personId = await createEntity(pool, { entity_type: 'person', display_name: 'PHASE7 Person', actor: 'system' });

  // A) Complete ingestion (anchor + knowledge + review)
  const sourceRefA = 'phase7_complete_' + Date.now();
  const a = await ingestTheVitalItem(pool, {
    source_ref: sourceRefA,
    title: 'Phase7 complete item',
    artifact_type: 'note',
    text: 'Phase 7 complete ingestion item. '.repeat(80),
    anchors: { workspace_id: wsId },
    queue_review: [{ review_type: 'promotion', notes: 'test promotion' }],
  });

  // Idempotency check: ingest same item again should not create a new artifact
  const a2 = await ingestTheVitalItem(pool, {
    source_ref: sourceRefA,
    title: 'Phase7 complete item DUP',
    artifact_type: 'note',
    text: 'ignored',
    anchors: { workspace_id: wsId },
  });

  // B) Partial ingestion (no anchor, no knowledge)
  const b = await ingestTheVitalItem(pool, {
    source_ref: 'phase7_partial_' + Date.now(),
    title: 'Phase7 partial item',
    artifact_type: 'file',
    // no text
    // no anchors
    queue_review: [{ review_type: 'classification', notes: 'needs anchor + classification' }],
  });

  // C) Partial ingestion (person anchor only, no knowledge)
  const c = await ingestTheVitalItem(pool, {
    source_ref: 'phase7_partial_person_' + Date.now(),
    title: 'Phase7 partial person anchored',
    artifact_type: 'screenshot',
    anchors: { person_id: personId },
  });

  const after = await counts();

  const out = {
    counts: { before, after },
    complete: {
      first: a,
      second: a2,
      same_artifact_id: a.artifact_id === a2.artifact_id,
      events: await eventsFor(a.artifact_id),
    },
    partial_missing_anchor: {
      result: b,
      events: await eventsFor(b.artifact_id),
    },
    partial_person_anchor: {
      result: c,
      events: await eventsFor(c.artifact_id),
    },
  };

  console.log(JSON.stringify(out, null, 2));
}

main().then(() => pool.end());
