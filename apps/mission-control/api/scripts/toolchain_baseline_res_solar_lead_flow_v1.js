import fs from 'fs';
import { execSync } from 'child_process';
import pg from 'pg';
import { createEntity } from '../entities.js';
import { createArtifact, addPrimaryAnchor } from '../artifacts.js';
import { emitEvent } from '../events.js';
import { requestReview } from '../review.js';
import { chunkText, createKnowledgeDocument, createKnowledgeChunks } from '../knowledge.js';

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

function ollamaRun(model, prompt) {
  // two constraints: bounded time + bounded output buffer
  const cmd = `ollama run ${model} ${JSON.stringify(prompt)}`;
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 60_000 }).trim();
}

async function ensureTool(pool, tool_id, defaults) {
  const r = await pool.query('select tool_id from tool_registry where tool_id=$1', [tool_id]);
  if (r.rowCount) return;
  await pool.query(
    `insert into tool_registry(
      tool_id, display_name, category, role, capabilities,
      preferred_task_types, preferred_input_format, preferred_output_format,
      strengths, weaknesses, review_requirements, runtime_model, status,
      routing_priority, auto_select, fallback_order, cost_profile, latency_profile
    ) values (
      $1,$2,$3,$4,$5::jsonb,
      $6::jsonb,$7,$8,
      $9::jsonb,$10::jsonb,$11::jsonb,$12,$13,
      $14,$15,$16::jsonb,$17,$18
    )`,
    [
      tool_id,
      defaults.display_name,
      defaults.category,
      defaults.role,
      JSON.stringify(defaults.capabilities || []),
      JSON.stringify(defaults.preferred_task_types || []),
      defaults.preferred_input_format || null,
      defaults.preferred_output_format || null,
      JSON.stringify(defaults.strengths || []),
      JSON.stringify(defaults.weaknesses || []),
      JSON.stringify(defaults.review_requirements || {}),
      defaults.runtime_model || null,
      defaults.status || 'active',
      defaults.routing_priority ?? 10,
      defaults.auto_select ?? false,
      JSON.stringify(defaults.fallback_order || []),
      defaults.cost_profile || 'low',
      defaults.latency_profile || 'fast',
    ]
  );
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

  // Tool selection baseline
  const primaryTool = 'ollama:qwen3.5:9b';
  const primaryModel = 'qwen3.5:9b';

  // pull fallback_order from tool_registry (locked routing field)
  const tr = await pool.query('select fallback_order from tool_registry where tool_id=$1', [primaryTool]);
  const fallbackOrder = tr.rowCount ? (tr.rows[0].fallback_order || []) : [];

  // Normalize fallback order to include only model tool_ids we can run
  // Accept tool ids like "ollama:llama3.1:8b" and map to model "llama3.1:8b"
  const candidates = [primaryTool, ...fallbackOrder];

  // 1) root run
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
      'Create residential solar lead flow v1 (lead capture → bill → instant follow-up → call objective → appointment handoff)',
      'solar_lead_flow_create_v1',
      JSON.stringify({
        scope: 'solar_residential',
        rules: ['bill required', 'instant follow-up', 'simple', 'non-pushy', 'conversational', 'no generic quotes', 'no over-explaining'],
      }),
      JSON.stringify({}),
    ]
  );

  const root_run_id = root.rows[0].root_run_id;
  const root_run_row_id = root.rows[0].run_id;

  // 2) orchestrator selects worker
  const selected_tool_id = primaryTool;
  const orch = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, parent_run_id, root_run_id, sequence_index, initiated_by
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       'success',$6,$7,1,'orchestrator'
     ) returning run_id`,
    [
      'orchestrator:mission_control',
      `Selected worker ${selected_tool_id} (local, low cost, fast)`,
      'route',
      JSON.stringify({ root_run_id, candidates }),
      JSON.stringify({ selected_tool_id, reason: 'local model; low cost_profile; fast latency_profile; no external action required' }),
      root_run_row_id,
      root_run_id,
    ]
  );

  // 3) worker attempts with fallback behavior
  const prompt = `Create the first version of a residential solar lead flow.

Scope must include:
- lead capture
- bill required (no bill = no progress)
- instant follow-up
- call objective
- appointment handoff

Tone rules:
- simple
- non-pushy
- conversational
- no generic quotes
- no over-explaining

Output ONLY:
1) Flow steps (numbered)
2) Example lines (short) for: instant follow-up text, first call open, bill request, appointment handoff
`;

  const attempts = [];
  let usedTool = null;
  let outputText = '';
  let success = false;

  // max 2 attempts on primary; then move to next tool(s)
  const orderedTools = [primaryTool, ...fallbackOrder];

  for (let i = 0; i < orderedTools.length; i++) {
    const toolId = orderedTools[i];
    const isPrimary = toolId === primaryTool;
    const maxAttempts = isPrimary ? 2 : 1;

    // ensure fallback tools exist in registry if needed for logging
    if (toolId.startsWith('ollama:')) {
      await ensureTool(pool, toolId, {
        display_name: `${toolId.replace('ollama:', '')} (Local Fallback)`,
        category: 'local_model',
        role: 'general_worker',
        capabilities: ['summarize', 'classify', 'draft_scripts', 'draft_playbooks'],
        preferred_task_types: ['drafting'],
        preferred_input_format: 'plain_text|doc_bundle',
        preferred_output_format: 'markdown_doc',
        strengths: ['fallback'],
        weaknesses: [],
        review_requirements: { required: true, gate: 'review_queue', when: ['promotion', 'external_actions'] },
        runtime_model: toolId,
        status: 'active',
        routing_priority: 30,
        auto_select: false,
        fallback_order: [],
        cost_profile: 'low',
        latency_profile: 'fast',
      });
    }

    // map toolId -> ollama model name
    let model = null;
    if (toolId === 'ollama:qwen3.5:9b') model = 'qwen3.5:9b';
    else if (toolId.startsWith('ollama:')) model = toolId.replace('ollama:', '');
    else model = null;

    for (let a = 1; a <= maxAttempts; a++) {
      const started = Date.now();
      try {
        const out = ollamaRun(model, prompt);
        const dur = Math.max(1, Math.round((Date.now() - started) / 1000));
        attempts.push({ toolId, attempt: a, ok: true, duration_seconds: dur });
        usedTool = toolId;
        outputText = out;
        success = Boolean(out && out.trim());
        break;
      } catch (e) {
        const dur = Math.max(1, Math.round((Date.now() - started) / 1000));
        attempts.push({ toolId, attempt: a, ok: false, duration_seconds: dur, error: String(e) });
      }
    }

    if (success) break;
  }

  // log worker run
  const workerToolForLog = usedTool || selected_tool_id;
  const worker = await pool.query(
    `insert into tool_run_log(
       tool_id, task_summary, task_type, input_reference, output_reference,
       status, parent_run_id, root_run_id, sequence_index, initiated_by,
       completed_at, duration_seconds,
       notes, failure_reason
     ) values (
       $1,$2,$3,$4::jsonb,$5::jsonb,
       $6,$7,$8,2,'orchestrator',
       now(), $9,
       $10, $11
     ) returning run_id`,
    [
      workerToolForLog,
      'Generate residential solar lead flow v1',
      'drafting',
      JSON.stringify({ root_run_id, prompt, attempts }),
      JSON.stringify({}),
      success ? 'success' : 'failed',
      orch.rows[0].run_id,
      root_run_id,
      Math.max(1, attempts.reduce((s, x) => s + (x.duration_seconds || 0), 0)),
      success ? `used ${workerToolForLog}` : 'all tools failed',
      success ? null : (attempts.at(-1)?.error || 'unknown'),
    ]
  );

  // 4) outputs: artifact + event (and on total failure: failure report artifact + event + review item)
  let artifact_id = null;
  let event_ids = [];
  let review_id = null;

  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `Solar Residential Lead Flow v1 (${root_run_id})`,
    attributes: { root_run_id, division: 'solar_residential' },
    actor: 'system',
  });

  if (success) {
    artifact_id = await createArtifact(pool, {
      source: 'system_output',
      source_ref: `solar_res_lead_flow_v1_${root_run_id}`,
      title: 'Residential Solar Lead Flow v1 (Bill-First)',
      artifact_type: 'playbook',
      scope: 'personal_context',
      sensitivity: 'personal',
      attributes: { root_run_id, tool_id: workerToolForLog },
      actor: 'system',
    });

    await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

    // store content as knowledge for retrieval (traceable to artifact)
    const docId = await createKnowledgeDocument(pool, {
      artifact_id,
      title: 'Residential Solar Lead Flow v1 (Bill-First)',
      scope: 'personal_context',
      summary: outputText.replace(/\s+/g, ' ').trim().slice(0, 420),
      tags: { source: 'system_output', root_run_id, division: 'solar_residential' },
      actor: 'system',
    });
    await createKnowledgeChunks(pool, {
      document_id: docId,
      chunks: chunkText(outputText, { maxLen: 1200 }),
      tags: { source: 'system_output', root_run_id },
      actor: 'system',
    });

    const ev1 = await emitEvent(pool, {
      event_level: 'milestone',
      event_type: 'playbook.generated',
      actor: 'system',
      artifact_id,
      workspace_id: wsId,
      payload: { root_run_id, tool_id: workerToolForLog, attempts },
    });
    event_ids.push(ev1);
  } else {
    artifact_id = await createArtifact(pool, {
      source: 'system_output',
      source_ref: `solar_res_lead_flow_v1_FAILED_${root_run_id}`,
      title: 'FAILED: Residential Solar Lead Flow v1 generation',
      artifact_type: 'failure_report',
      scope: 'personal_context',
      sensitivity: 'personal',
      attributes: { root_run_id, attempts },
      actor: 'system',
    });
    await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

    const evFail = await emitEvent(pool, {
      event_level: 'error',
      event_type: 'toolchain.failed',
      actor: 'system',
      artifact_id,
      workspace_id: wsId,
      payload: { root_run_id, attempts },
    });
    event_ids.push(evFail);

    review_id = await requestReview(pool, {
      artifact_id,
      requested_by: 'system',
      reviewer: 'stephen',
      review_type: 'classification',
      notes: 'Toolchain failed. Review failure report and re-run or adjust routing.',
      actor: 'system',
    });
  }

  // update worker run output_reference + counts
  await pool.query(
    `update tool_run_log
     set output_reference=$2::jsonb,
         artifacts_created=$3,
         events_created=$4,
         review_item_created=$5
     where run_id=$1`,
    [
      worker.rows[0].run_id,
      JSON.stringify({ artifact_id, event_ids, workspace_id: wsId, review_id }),
      1,
      event_ids.length,
      Boolean(review_id),
    ]
  );

  // update last_used_at
  await pool.query('update tool_registry set last_used_at=now() where tool_id=$1', ['orchestrator:mission_control']);
  if (workerToolForLog) await pool.query('update tool_registry set last_used_at=now() where tool_id=$1', [workerToolForLog]);

  // live flow view
  const flow = await pool.query(
    `select run_id, tool_id, task_summary, task_type, status, sequence_index, artifacts_created, events_created, review_item_created
     from tool_run_log
     where root_run_id=$1
     order by sequence_index asc, started_at asc`,
    [root_run_id]
  );

  console.log(JSON.stringify({
    root_run_id,
    selected_tool: selected_tool_id,
    fallback_used: workerToolForLog !== selected_tool_id,
    used_tool: workerToolForLog,
    attempts,
    artifact_id,
    event_ids,
    review_id,
    live_flow: flow.rows,
    output: outputText,
  }, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error('toolchain_baseline_failed', e);
  process.exit(1);
});
