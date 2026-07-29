import fs from 'fs';
import pg from 'pg';
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

loadEnv('/Users/turtleclaw/.openclaw/workspace/mission-control/api/.env');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'hhs',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'hhs',
});

async function main() {
  // Setup: create a workspace anchor
  const ws = await pool.query(
    "insert into entities(entity_type, display_name) values ('workspace','PHASE5 Workspace') returning id"
  );
  const wsId = ws.rows[0].id;

  // 1) Create artifact
  const artifactId = await createArtifact(pool, {
    source: 'the_vital',
    source_ref: 'phase5_artifact_' + Date.now(),
    title: 'Phase5 artifact',
    artifact_type: 'note',
    actor: 'system',
  });

  // anchor it (not strictly required to create knowledge, but consistent with system)
  await addPrimaryAnchor(pool, { artifact_id: artifactId, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

  // 2) Create knowledge document referencing artifact
  const docId = await createKnowledgeDocument(pool, {
    artifact_id: artifactId,
    title: 'Phase5 knowledge doc',
    scope: 'personal_context',
    tags: { phase: 5 },
    actor: 'system',
  });

  // 3) Create chunks referencing document
  const text = 'This is a Phase 5 test document. '.repeat(200);
  const chunks = chunkText(text, { maxLen: 500 });
  const inserted = await createKnowledgeChunks(pool, {
    document_id: docId,
    chunks,
    tags: { phase: 5 },
    actor: 'system',
  });

  // Validate traceability chain exists
  const chain = await pool.query(
    `select a.id as artifact_id, d.id as document_id, c.id as chunk_id
     from artifacts a
     join knowledge_documents_v2 d on d.artifact_id=a.id
     join knowledge_chunks_v2 c on c.document_id=d.id
     where a.id=$1
     limit 3`,
    [artifactId]
  );

  // Validate artifact.processed event emitted
  const ev = await pool.query(
    `select event_level, event_type, artifact_id
     from events_v2
     where artifact_id=$1 and event_type='artifact.processed'
     order by occurred_at desc
     limit 1`,
    [artifactId]
  );

  console.log(JSON.stringify({ artifactId, docId, chunk_count: chunks.length, inserted, chain_rows: chain.rows, processed_event: ev.rows[0] || null }, null, 2));
}

main().then(() => pool.end());
