import fs from 'fs';
import pg from 'pg';
import { createEntity } from '../entities.js';
import { createArtifact, addPrimaryAnchor } from '../artifacts.js';
import { requestReview, assignReview, decideReview, promoteApproved } from '../review.js';

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

async function eventsFor(artifact_id) {
  const r = await pool.query(
    `select event_level, event_type, occurred_at
     from events_v2
     where artifact_id=$1
     order by occurred_at asc`,
    [artifact_id]
  );
  return r.rows;
}

async function main() {
  // Prepare workspace entity
  const wsId = await createEntity(pool, { entity_type: 'workspace', display_name: 'PHASE6 Workspace', actor: 'system' });

  // A) Successful flow (anchored)
  const a1 = await createArtifact(pool, {
    source: 'the_vital',
    source_ref: 'phase6_ok_' + Date.now(),
    title: 'Phase6 OK artifact',
    artifact_type: 'file',
    actor: 'system',
  });
  await addPrimaryAnchor(pool, { artifact_id: a1, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

  const r1 = await requestReview(pool, { artifact_id: a1, actor: 'system' });
  await assignReview(pool, { review_id: r1, actor: 'system' });
  await decideReview(pool, {
    review_id: r1,
    decision: 'approved',
    promotion_target: 'workspace',
    target_workspace_id: wsId,
    actor: 'stephen',
  });
  const p1 = await promoteApproved(pool, { review_id: r1, actor: 'system' });

  // B) Blocked flow (missing anchor)
  const a2 = await createArtifact(pool, {
    source: 'the_vital',
    source_ref: 'phase6_block_' + Date.now(),
    title: 'Phase6 blocked artifact',
    artifact_type: 'note',
    actor: 'system',
  });

  const r2 = await requestReview(pool, { artifact_id: a2, actor: 'system' });
  await assignReview(pool, { review_id: r2, actor: 'system' });
  await decideReview(pool, {
    review_id: r2,
    decision: 'approved',
    promotion_target: 'business_core',
    actor: 'stephen',
  });
  const p2 = await promoteApproved(pool, { review_id: r2, actor: 'system' });

  const out = {
    success_flow: { artifact_id: a1, review_id: r1, promote_result: p1, events: await eventsFor(a1) },
    blocked_flow: { artifact_id: a2, review_id: r2, promote_result: p2, events: await eventsFor(a2) },
  };
  console.log(JSON.stringify(out, null, 2));
}

main().then(() => pool.end());
