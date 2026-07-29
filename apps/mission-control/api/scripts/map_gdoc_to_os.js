import fs from 'fs';
import pg from 'pg';
import { createEntity } from '../entities.js';
import { createArtifact, addPrimaryAnchor } from '../artifacts.js';
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

function pickTitle(txt) {
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (t) return t.slice(0, 140);
  }
  return 'Google Doc (untitled)';
}

async function main() {
  const DOC_ID = '11F4f7MkRSOJ_oKulNXsoclsx3rX_xa4JvdTPRLEhVDA';
  const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/edit`;
  const txtPath = '/tmp/doc_11F4f7.txt';

  const content = fs.readFileSync(txtPath, 'utf8');
  const title = pickTitle(content);

  loadEnv('/Users/turtleclaw/.openclaw/workspace/mission-control/api/.env');

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'hhs',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'hhs',
  });

  // Create a root run + orchestrator run for auditability
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
      'Map Google Doc into OS primitives (artifact + knowledge + events + optional review)',
      'map_external_doc',
      JSON.stringify({ doc_id: DOC_ID, doc_url: DOC_URL }),
      JSON.stringify({}),
    ]
  );

  const root_run_id = root.rows[0].root_run_id;
  const root_run_row_id = root.rows[0].run_id;

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
      `Create artifact + knowledge for Google Doc: ${title}`,
      'orchestrate',
      JSON.stringify({ root_run_id }),
      JSON.stringify({ selected_tool_id: 'orchestrator:mission_control' }),
      root_run_row_id,
      root_run_id,
    ]
  );

  // Primary anchor: workspace (per primary lens)
  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `Spec Doc: ${title}`,
    attributes: { root_run_id, doc_id: DOC_ID, source: 'gdoc' },
    actor: 'system',
  });

  // Artifact
  const artifact_id = await createArtifact(pool, {
    source: 'gdrive',
    source_ref: DOC_ID,
    title,
    artifact_type: 'document',
    scope: 'personal_context',
    sensitivity: 'personal',
    attributes: { root_run_id, doc_url: DOC_URL },
    actor: 'system',
  });

  await addPrimaryAnchor(pool, { artifact_id, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

  // Knowledge (traceable)
  const summary = content.replace(/\s+/g, ' ').trim().slice(0, 420) || null;
  const docId = await createKnowledgeDocument(pool, {
    artifact_id,
    title,
    scope: 'personal_context',
    summary,
    tags: { source: 'gdrive', doc_id: DOC_ID, root_run_id },
    actor: 'system',
  });

  const chunks = chunkText(content, { maxLen: 1200 });
  const chunksInserted = await createKnowledgeChunks(pool, {
    document_id: docId,
    chunks,
    tags: { source: 'gdrive', doc_id: DOC_ID, root_run_id },
    actor: 'system',
  });

  // Create a review item to classify/promote later (human gate) — keeps it inspectable.
  const review = await pool.query(
    `insert into review_queue(artifact_id, requested_by, reviewer, review_type, status, notes)
     values ($1,'system','stephen','classification','queued',$2)
     returning id`,
    [artifact_id, 'Imported Google Doc into OS. Needs classification and (optional) promotion decision.']
  );
  const review_id = review.rows[0].id;

  // Update run log outputs
  await pool.query(
    `update tool_run_log
     set output_reference=$2::jsonb,
         artifacts_created=1,
         events_created=3,
         review_item_created=true,
         completed_at=now()
     where run_id=$1`,
    [orch.rows[0].run_id, JSON.stringify({ artifact_id, knowledge_document_id: docId, chunks_inserted: chunksInserted, review_id, workspace_id: wsId })]
  );

  await pool.query('update tool_registry set last_used_at=now() where tool_id=$1', ['orchestrator:mission_control']);

  console.log(JSON.stringify({
    ok: true,
    root_run_id,
    artifact_id,
    knowledge_document_id: docId,
    chunks_inserted: chunksInserted,
    review_id,
    workspace_id: wsId,
    title,
  }, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error('map_gdoc_failed', e);
  process.exit(1);
});
