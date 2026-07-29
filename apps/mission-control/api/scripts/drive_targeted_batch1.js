import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
import { createEntity } from '../entities.js';
import { createArtifact, addPrimaryAnchor } from '../artifacts.js';
import { chunkText, createKnowledgeDocument, createKnowledgeChunks } from '../knowledge.js';

const { Pool } = pg;

const CATEGORIES = [
  'solar_residential',
  'solar_commercial',
  'marketing_ads',
  'automation_systems',
  'voice_agents',
  'workflows_sops',
  'business_strategy',
  'random_ideas',
];

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

function categorize(name, text) {
  const low = (name + '\n' + (text || '').slice(0, 4000)).toLowerCase();
  const has = (...keys) => keys.some(k => low.includes(k));

  if (has('retell', 'voice agent', 'appointment setting', 'objection', 'call script', 'inbound', 'outbound')) return 'voice_agents';
  if (has('make.com', 'n8n', 'webhook', 'workflow', 'mcp', 'agent builder', 'automation', 'http request')) return 'automation_systems';
  if (has('sop', 'checklist', 'process', 'template', 'playbook', 'framework', 'steps', 'weekly')) return 'workflows_sops';
  if (has('ad', 'creative', 'facebook', 'instagram', 'content', 'headline', 'copy', 'marketing')) return 'marketing_ads';
  if (has('solar', 'utility', 'kwh', 'battery', 'panel', 'pto', 'permit', 'install')) {
    if (has('commercial', 'multifamily', 'warehouse', 'property manager', 'hoa')) return 'solar_commercial';
    return 'solar_residential';
  }
  if (has('strategy', 'business plan', 'pricing', 'positioning', 'offer', 'crm', 'pipeline')) return 'business_strategy';
  return 'random_ideas';
}

function extractDoDont(text) {
  const t = safeString(text);
  const dos = [];
  const donts = [];
  const doRe = [/\bmust\b[^\.\n]{0,180}/gi, /\bshould\b[^\.\n]{0,180}/gi];
  const dontRe = [/\bdon't\b[^\.\n]{0,180}/gi, /\bdo not\b[^\.\n]{0,180}/gi, /\bnever\b[^\.\n]{0,180}/gi];
  for (const re of doRe) {
    const m = t.match(re);
    if (m) dos.push(...m.slice(0, 8));
  }
  for (const re of dontRe) {
    const m = t.match(re);
    if (m) donts.push(...m.slice(0, 8));
  }
  const uniq = (arr) => Array.from(new Set(arr.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 10);
  return { dos: uniq(dos), donts: uniq(donts) };
}

function exportDocToText(file) {
  const id = file.id;
  const mime = file.mimeType;

  // google docs
  if (mime === 'application/vnd.google-apps.document') {
    const outPath = `/tmp/drive_${id}.txt`;
    run(`gog docs export ${id} --format txt --out ${outPath} --no-input`);
    return fs.readFileSync(outPath, 'utf8');
  }

  // docx (download then extract via textutil if available)
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const dl = `/tmp/drive_${id}.docx`;
    run(`gog drive download ${id} --out ${dl} --no-input`);
    // macOS textutil can convert docx → txt
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

  const batchId = `drive_targeted_${Date.now()}`;
  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `Drive Targeted Pass — Batch 1 (${batchId})`,
    attributes: { batchId, purpose: 'drive_targeted_context_pass' },
    actor: 'system',
  });

  // Targeted drive search (high-signal keywords)
  const queries = [
    'sop', 'playbook', 'workflow', 'script', 'offer', 'onboarding', 'training',
    'automation', 'webhook', 'sales process', 'marketing strategy'
  ];

  const seen = new Set();
  const files = [];

  for (const q of queries) {
    const j = JSON.parse(run(`gog drive search ${JSON.stringify(q)} --max 10 --json --no-input`));
    for (const f of (j.files || [])) {
      if (!f.id || seen.has(f.id)) continue;
      // Skip low-signal types
      if (f.mimeType && f.mimeType.startsWith('image/')) continue;
      if (f.mimeType === 'application/vnd.google-apps.folder') continue;
      // Keep docs + docx primarily
      if (![
        'application/vnd.google-apps.document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ].includes(f.mimeType)) continue;
      seen.add(f.id);
      files.push(f);
      if (files.length >= 10) break;
    }
    if (files.length >= 10) break;
  }

  const breakdown = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  const processed = [];
  const overlaps = [];

  for (const f of files) {
    const text = exportDocToText(f);
    const name = safeString(f.name);
    const category = categorize(name, text);
    breakdown[category] = (breakdown[category] || 0) + 1;

    // artifact
    const artifactId = await createArtifact(pool, {
      source: 'gdrive',
      source_ref: f.id,
      title: name,
      artifact_type: 'document',
      scope: 'personal_context',
      sensitivity: 'personal',
      attributes: { batchId, mimeType: f.mimeType, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink },
      actor: 'system',
    });

    await addPrimaryAnchor(pool, { artifact_id: artifactId, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

    // knowledge
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

    // overlap signal (raw): if doc name includes openclaw/mission control keywords
    const lowName = name.toLowerCase();
    if (lowName.includes('openclaw') || lowName.includes('operating system') || lowName.includes('mission')) {
      overlaps.push({ name, id: f.id });
    }

    processed.push({ name, id: f.id, category, summary, chunksInserted, dos: dd.dos, donts: dd.donts, link: f.webViewLink });
  }

  const totals = await pool.query(
    `select
       (select count(*)::int from artifacts where source='gdrive' and attributes->>'batchId'=$1) as artifacts,
       (select count(*)::int from knowledge_documents_v2 where tags->>'batchId'=$1) as documents,
       (select count(*)::int from knowledge_chunks_v2 where document_id in (select id from knowledge_documents_v2 where tags->>'batchId'=$1)) as chunks,
       (select count(*)::int from events_v2 where artifact_id in (select id from artifacts where attributes->>'batchId'=$1)) as events`,
    [batchId]
  );

  const out = { batchId, totals: totals.rows[0], breakdown, processed, overlaps };
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}

main();
