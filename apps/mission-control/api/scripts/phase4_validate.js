import fs from 'fs';
import pg from 'pg';
import { createArtifact, addPrimaryAnchor, requirePrimaryAnchorForPromotion } from '../artifacts.js';

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

async function main() {
  // Create a workspace entity to anchor to
  const ws = await pool.query(
    "insert into entities(entity_type, display_name) values ('workspace','PHASE4 Workspace') returning id"
  );
  const wsId = ws.rows[0].id;

  // 1) Anchored artifact flow
  const a1 = await createArtifact(pool, {
    source: 'the_vital',
    source_ref: 'phase4_anchor_ok_' + Date.now(),
    title: 'Phase4 anchored artifact',
    artifact_type: 'file',
    actor: 'system',
  });
  await addPrimaryAnchor(pool, { artifact_id: a1, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });
  const ok = await requirePrimaryAnchorForPromotion(pool, { artifact_id: a1, actor: 'system', context: { test: 'anchored' } });

  // 2) Missing-anchor blocked flow
  const a2 = await createArtifact(pool, {
    source: 'the_vital',
    source_ref: 'phase4_anchor_missing_' + Date.now(),
    title: 'Phase4 missing-anchor artifact',
    artifact_type: 'note',
    actor: 'system',
  });
  const blocked = await requirePrimaryAnchorForPromotion(pool, { artifact_id: a2, actor: 'system', context: { test: 'missing_anchor' } });

  console.log(JSON.stringify({ anchored: { artifact_id: a1, result: ok }, missing_anchor: { artifact_id: a2, result: blocked } }, null, 2));

  // show last emitted events for these artifacts
  const ev = await pool.query(
    `select event_level, event_type, artifact_id, occurred_at
     from events_v2
     where artifact_id = $1 or artifact_id = $2
     order by occurred_at desc
     limit 10`,
    [a1, a2]
  );
  console.log('events:', ev.rows);
}

main().then(() => pool.end());
