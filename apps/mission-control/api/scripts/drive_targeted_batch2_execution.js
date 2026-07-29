import fs from 'fs';
import { execSync } from 'child_process';
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

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

function safeString(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return String(x);
}

function isHighSignalExecution(name, text) {
  const low = (name + '\n' + (text || '').slice(0, 2500)).toLowerCase();
  // strict skip terms (deprioritize)
  const skip = ['openclaw', 'second brain directive', 'system directive', 'agent builder course', 'architecture lock'];
  if (skip.some(s => low.includes(s))) return false;

  const execTerms = [
    'proposal', 'estimate', 'intake', 'qualification', 'qualify', 'install', 'pto', 'permit',
    'site survey', 'objection', 'call script', 'appointment', 'follow-up', 'follow up',
    'checklist', 'sop', 'process', 'onboarding', 'lead handling'
  ];
  return execTerms.some(t => low.includes(t));
}

function classifyType(name, text) {
  const low = (name + '\n' + (text || '').slice(0, 3000)).toLowerCase();
  const solar = ['solar','kwh','utility','panel','battery','pto','permit','install'];
  const sop = ['sop','checklist','process','workflow','onboarding','lead handling','follow-up'];
  const sales = ['call script','objection','appointment','messaging','text','dm','follow up'];

  const isSolar = solar.some(t => low.includes(t));
  const isSop = sop.some(t => low.includes(t));
  const isSales = sales.some(t => low.includes(t));
  return { isSolar, isSop, isSales };
}

function categorize(name, text) {
  const low = (name + '\n' + (text || '').slice(0, 4000)).toLowerCase();
  const has = (...keys) => keys.some(k => low.includes(k));

  if (has('objection', 'call script', 'appointment setting', 'messaging', 'follow-up')) return 'voice_agents';
  if (has('sop', 'checklist', 'lead handling', 'onboarding', 'process', 'workflow')) return 'workflows_sops';
  if (has('solar', 'utility', 'kwh', 'battery', 'panel', 'pto', 'permit', 'install', 'proposal', 'estimate', 'intake', 'qualification')) {
    if (has('commercial', 'multifamily', 'warehouse', 'property manager', 'hoa')) return 'solar_commercial';
    return 'solar_residential';
  }
  return 'business_strategy';
}

function extractDoDont(text) {
  const t = safeString(text);
  const dos = [];
  const donts = [];
  const doRe = [/\bmust\b[^\.\n]{0,180}/gi, /\bshould\b[^\.\n]{0,180}/gi];
  const dontRe = [/\bdon't\b[^\.\n]{0,180}/gi, /\bdo not\b[^\.\n]{0,180}/gi, /\bnever\b[^\.\n]{0,180}/gi];
  for (const re of doRe) {
    const m = t.match(re);
    if (m) dos.push(...m.slice(0, 10));
  }
  for (const re of dontRe) {
    const m = t.match(re);
    if (m) donts.push(...m.slice(0, 10));
  }
  const uniq = (arr) => Array.from(new Set(arr.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 10);
  return { dos: uniq(dos), donts: uniq(donts) };
}

function exportDocToText(file) {
  const id = file.id;
  const mime = file.mimeType;

  if (mime === 'application/vnd.google-apps.document') {
    const outPath = `/tmp/drive_${id}.txt`;
    run(`gog docs export ${id} --format txt --out ${outPath} --no-input`);
    return fs.readFileSync(outPath, 'utf8');
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const dl = `/tmp/drive_${id}.docx`;
    run(`gog drive download ${id} --out ${dl} --no-input`);
    const txt = `/tmp/drive_${id}.txt`;
    run(`textutil -convert txt -output ${txt} ${dl}`);
    return fs.readFileSync(txt, 'utf8');
  }

  return '';
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

  const batchId = `drive_exec_${Date.now()}`;
  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `Drive Execution Pass — Batch 02 (${batchId})`,
    attributes: { batchId, purpose: 'drive_targeted_execution_refinement' },
    actor: 'system',
  });

  // Execution-focused search terms (strict order)
  const queries = [
    'solar proposal', 'solar intake form', 'solar qualification', 'solar install', 'pto permit',
    'residential solar process', 'commercial solar process',
    'call script', 'objection handling', 'appointment setting',
    'lead handling sop', 'follow-up sop', 'onboarding checklist'
  ];

  const seen = new Set();
  const files = [];

  for (const q of queries) {
    const j = JSON.parse(run(`gog drive search ${JSON.stringify(q)} --max 20 --json --no-input`));
    for (const f of (j.files || [])) {
      if (!f.id || seen.has(f.id)) continue;
      if (f.mimeType && f.mimeType.startsWith('image/')) continue;
      if (f.mimeType === 'application/vnd.google-apps.folder') continue;
      if (![
        'application/vnd.google-apps.document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ].includes(f.mimeType)) continue;

      // quick name filter (deprioritize system docs)
      const nm = (f.name || '').toLowerCase();
      if (nm.includes('openclaw') || nm.includes('second brain') || nm.includes('directive')) continue;

      seen.add(f.id);
      files.push(f);
      if (files.length >= 10) break;
    }
    if (files.length >= 10) break;
  }

  const processed = [];
  let solarCount = 0, sopCount = 0, salesCount = 0;

  for (const f of files) {
    const text = exportDocToText(f);
    const name = safeString(f.name);

    // strict execution filter
    if (!isHighSignalExecution(name, text)) continue;

    const flags = classifyType(name, text);
    if (flags.isSolar) solarCount++;
    if (flags.isSop) sopCount++;
    if (flags.isSales) salesCount++;

    const category = categorize(name, text);
    const artifactId = await createArtifact(pool, {
      source: 'gdrive',
      source_ref: f.id,
      title: name,
      artifact_type: 'document',
      scope: 'personal_context',
      sensitivity: 'personal',
      attributes: { batchId, mimeType: f.mimeType, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink, category },
      actor: 'system',
    });

    await addPrimaryAnchor(pool, { artifact_id: artifactId, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

    const summary = (text || '').replace(/\s+/g, ' ').trim().slice(0, 420) || null;
    let docId = null;
    let chunksInserted = 0;
    if ((text || '').trim()) {
      docId = await createKnowledgeDocument(pool, {
        artifact_id: artifactId,
        title: name,
        scope: 'personal_context',
        summary,
        tags: { source: 'gdrive', batchId, category },
        actor: 'system',
      });
      const chunks = chunkText(text, { maxLen: 1200 });
      chunksInserted = await createKnowledgeChunks(pool, {
        document_id: docId,
        chunks,
        tags: { source: 'gdrive', batchId, category },
        actor: 'system',
      });
    }

    const dd = extractDoDont(text);

    processed.push({ name, id: f.id, category, summary, chunksInserted, dos: dd.dos, donts: dd.donts, link: f.webViewLink, flags });
  }

  const totals = await pool.query(
    `select
       (select count(*)::int from artifacts where source='gdrive' and attributes->>'batchId'=$1) as artifacts,
       (select count(*)::int from knowledge_documents_v2 where tags->>'batchId'=$1) as documents,
       (select count(*)::int from knowledge_chunks_v2 where document_id in (select id from knowledge_documents_v2 where tags->>'batchId'=$1)) as chunks,
       (select count(*)::int from events_v2 where artifact_id in (select id from artifacts where attributes->>'batchId'=$1)) as events`,
    [batchId]
  );

  console.log(JSON.stringify({
    batchId,
    totals: totals.rows[0],
    counts: { solar_specific: solarCount, sop_workflow: sopCount, sales_script: salesCount },
    processed
  }, null, 2));

  await pool.end();
}

main();
