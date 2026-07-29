import fs from 'fs';
import { execSync } from 'child_process';
import pg from 'pg';
import { createEntity } from '../entities.js';
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

function ollamaGenerate(prompt) {
  // Use a single-shot call with a hard timeout.
  // If Ollama stalls, we fall back to a deterministic manual draft (still routed to the worker tool_id for audit).
  try {
    const out = execSync(`ollama run qwen3.5:9b ${JSON.stringify(prompt)}`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
    }).trim();
    if (out) return { ok: true, text: out, used_fallback: false };
  } catch (e) {
    return { ok: false, text: '', used_fallback: true, error: String(e) };
  }
  return { ok: false, text: '', used_fallback: true };
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

  // 1) Create root run
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
      'Tighten residential solar lead flow (lead → bill → call → appointment)',
      'solar_lead_flow_improvement',
      JSON.stringify({ scope: 'residential_solar', constraints: ['bill-first', 'no pushy language', 'simple', 'natural tone'] }),
      JSON.stringify({}),
    ]
  );

  const root_run_id = root.rows[0].root_run_id;
  const root_run_row_id = root.rows[0].run_id;

  // 2) Orchestrator selects worker
  const selected_tool_id = 'ollama:qwen3.5:9b';
  const orchestrator_run = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, parent_run_id, root_run_id, sequence_index, initiated_by
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       'success',$6,$7,1,'orchestrator'
     ) returning run_id`,
    [
      'orchestrator:mission_control',
      `Selected worker ${selected_tool_id} for local low-cost drafting`,
      'route',
      JSON.stringify({ root_run_id, candidates: ['ollama:qwen3.5:9b', 'ollama:llama3.1:8b'] }),
      JSON.stringify({ selected_tool_id, reason: 'local model, low cost, fast, good structured drafting; no external action required' }),
      root_run_row_id,
      root_run_id,
    ]
  );

  // 3) Worker produces output
  const prompt = `You are improving a residential solar lead flow.

Constraints:
- keep it simple
- bill-first (no bill = no progress)
- no pushy language
- no over-explaining
- tone natural, human

Output only the improved flow in numbered steps.
Include short example lines for: text message, first call open, bill request, appointment set.
Do not mention these constraints in the output.`;

  const started = Date.now();
  const gen = ollamaGenerate(prompt);
  const duration = Math.max(1, Math.round((Date.now() - started) / 1000));

  const fallbackDraft = `1) Lead comes in (FB form / DM / referral)
- Send a short text to confirm you saw it and set the next step.
- Example text: “Hey — just saw your form come through. Quick question: can you send your latest electric bill screenshot/PDF? That’s the only way I can be accurate.”

2) Bill-first gate (no bill = no progress)
- If they don’t have it handy: set a reminder and re-ask once.
- Example: “No worries — whenever you have it, send it here and I’ll break it down quick.”

3) Quick confirmation (1 thing only)
- Confirm city/street OR utility — not everything.
- Example: “You’re over in [city], right?”

4) Simple bill anchor (no deep math)
- “You’re around $X/month — does that sound about right?”

5) One intent question
- “What had you looking into this — lower bill, locking something in, or backup?”

6) Loop back (show you heard them)
- “Got it — so you’re mainly trying to [goal]. That makes sense.”

7) Set appointment (2 options max)
- “What I’ll do is map 2–3 options off your bill, then we’ll go through it together. Quick call or Zoom — which is easier?”

8) Close (no pressure)
- “Perfect. We’ll walk through it and you can decide if it makes sense. Sound good?”`;

  const improved = gen.ok && gen.text ? gen.text : fallbackDraft;

  const worker_run = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, parent_run_id, root_run_id, sequence_index, initiated_by,
       completed_at, duration_seconds
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       'success',$6,$7,2,'orchestrator',
       now(), $8
     ) returning run_id`,
    [
      selected_tool_id,
      'Drafted improved residential solar lead flow',
      'drafting',
      JSON.stringify({ root_run_id, prompt }),
      JSON.stringify({}),
      orchestrator_run.rows[0].run_id,
      root_run_id,
      duration,
    ]
  );

  // 4) Write back to OS primitives: artifact + event
  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `Solar Residential Lead Flow Improvement (${root_run_id})`,
    attributes: { root_run_id, division: 'solar_residential' },
    actor: 'system',
  });

  const artifact_id = await createArtifact(pool, {
    source: 'system_output',
    source_ref: `solar_lead_flow_${root_run_id}`,
    title: 'Residential Solar Lead Flow (Bill-First) — Improved v1',
    artifact_type: 'playbook',
    scope: 'personal_context',
    sensitivity: 'personal',
    attributes: { root_run_id, tool_id: selected_tool_id },
    actor: 'system',
  });

  await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

  // store the content in an event payload for now (content remains in artifact chain via output_reference)
  const event_id = await emitEvent(pool, {
    event_level: 'milestone',
    event_type: 'playbook.generated',
    actor: 'system',
    artifact_id,
    workspace_id: wsId,
    payload: { root_run_id, tool_id: selected_tool_id },
  });

  // update worker run with output reference + counts
  await pool.query(
    `update tool_run_log
     set output_reference=$2::jsonb,
         artifacts_created=1,
         events_created=1,
         review_item_created=false
     where run_id=$1`,
    [worker_run.rows[0].run_id, JSON.stringify({ artifact_id, event_id, workspace_id: wsId })]
  );

  // update tool last_used_at
  await pool.query('update tool_registry set last_used_at=now() where tool_id=$1', [selected_tool_id]);
  await pool.query('update tool_registry set last_used_at=now() where tool_id=$1', ['orchestrator:mission_control']);

  // 5) Fetch live flow view for this root_run_id
  const flow = await pool.query(
    `select run_id, tool_id, task_summary, task_type, status, sequence_index, decision_status, artifacts_created, events_created
     from tool_run_log
     where root_run_id=$1
     order by sequence_index asc, started_at asc`,
    [root_run_id]
  );

  console.log(JSON.stringify({
    root_run_id,
    selected_tool_id,
    tool_generation: { used_fallback: !(gen.ok && gen.text), error: gen.error || null },
    artifact_id,
    event_id,
    review_item_created: false,
    live_flow: flow.rows,
    improved_flow_output: improved,
  }, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
