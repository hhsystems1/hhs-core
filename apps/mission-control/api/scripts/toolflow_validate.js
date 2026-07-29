import fs from 'fs';
import pg from 'pg';
import { createArtifact, addPrimaryAnchor } from '../artifacts.js';
import { emitEvent } from '../events.js';

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
  // root run (user request)
  const root = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, root_run_id, sequence_index, initiated_by
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       'success', gen_random_uuid(), 0, 'user'
     ) returning run_id, root_run_id`,
    [
      'orchestrator:mission_control',
      'Simulated user request: create test artifact',
      'demo_flow',
      JSON.stringify({ prompt: 'create an artifact and log event' }),
      JSON.stringify({}),
    ]
  );

  const root_run_id = root.rows[0].root_run_id;
  const root_run_row_id = root.rows[0].run_id;

  // orchestrator routing run
  const orch = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, parent_run_id, root_run_id, sequence_index, initiated_by
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       'success', $6, $7, 1, 'orchestrator'
     ) returning run_id`,
    [
      'orchestrator:mission_control',
      'Orchestrator routed to general_worker',
      'route',
      JSON.stringify({ root_run_id }),
      JSON.stringify({ delegated_to: 'ollama:qwen3.5:9b' }),
      root_run_row_id,
      root_run_id,
    ]
  );

  // worker run
  const worker = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, parent_run_id, root_run_id, sequence_index, initiated_by
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       'success', $6, $7, 2, 'orchestrator'
     ) returning run_id`,
    [
      'ollama:qwen3.5:9b',
      'Worker created artifact draft',
      'write_artifact',
      JSON.stringify({ root_run_id }),
      JSON.stringify({}),
      orch.rows[0].run_id,
      root_run_id,
    ]
  );

  // produce an output artifact + event
  const artifact_id = await createArtifact(pool, {
    source: 'system_test',
    source_ref: 'toolflow_' + Date.now(),
    title: 'Tool flow test artifact',
    artifact_type: 'note',
    actor: 'system',
  });

  const ws = await pool.query(
    "insert into entities(entity_type, display_name, attributes) values ('workspace','Tool Flow Workspace','{}'::jsonb) returning id"
  );
  const workspace_id = ws.rows[0].id;

  await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: workspace_id, anchor_type: 'workspace', actor: 'system' });

  await emitEvent(pool, {
    event_level: 'system',
    event_type: 'system.toolflow_test',
    actor: 'system',
    artifact_id,
    workspace_id,
    payload: { root_run_id },
  });

  // update worker run output_reference + counts
  await pool.query(
    `update tool_run_log
     set output_reference=$2::jsonb,
         artifacts_created=1,
         events_created=1
     where run_id=$1`,
    [worker.rows[0].run_id, JSON.stringify({ artifact_id, workspace_id })]
  );

  console.log(JSON.stringify({ root_run_id, artifact_id, workspace_id }, null, 2));
}

main().then(() => pool.end());
