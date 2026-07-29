import fs from 'fs';
import path from 'path';
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

function safeString(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return String(x);
}

function extractMessages(conv) {
  const out = [];
  if (conv?.mapping && typeof conv.mapping === 'object') {
    for (const n of Object.values(conv.mapping)) {
      const m = n?.message;
      if (!m) continue;
      const role = m?.author?.role || 'unknown';
      const content = m?.content;
      const parts = Array.isArray(content?.parts) ? content.parts : [];
      const text = parts.map(p => safeString(p)).join('\n').trim();
      if (text) out.push({ role, text });
    }
    return out;
  }
  if (Array.isArray(conv?.messages)) {
    for (const m of conv.messages) {
      const role = m?.role || 'unknown';
      const text = safeString(m?.content || '').trim();
      if (text) out.push({ role, text });
    }
  }
  return out;
}

function flattenConversation(conv) {
  const msgs = extractMessages(conv).map(m => `[${m.role}] ${m.text}`);
  return msgs.join('\n\n');
}

function pickSourceRef(conv, idx) {
  return safeString(conv?.id || conv?.conversation_id || conv?.uuid || `idx_${idx}`);
}

function pickTitle(conv) {
  return (safeString(conv?.title || conv?.name || 'Untitled GPT conversation') || 'Untitled GPT conversation').trim();
}

function makeSummary(text, max = 420) {
  const cleaned = safeString(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function extractDoDont(text) {
  const t = safeString(text);
  const dos = [];
  const donts = [];

  const doRe = [/\bmust\b[^\.\n]{0,180}/gi, /\bshould\b[^\.\n]{0,180}/gi, /\bdo\b[^\.\n]{0,180}/gi];
  const dontRe = [/\bdon't\b[^\.\n]{0,180}/gi, /\bdo not\b[^\.\n]{0,180}/gi, /\bnever\b[^\.\n]{0,180}/gi];

  for (const re of doRe) {
    const m = t.match(re);
    if (m) dos.push(...m.slice(0, 6));
  }
  for (const re of dontRe) {
    const m = t.match(re);
    if (m) donts.push(...m.slice(0, 6));
  }

  const uniq = (arr) => Array.from(new Set(arr.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 10);
  return { dos: uniq(dos), donts: uniq(donts) };
}

function categorize(title, text) {
  const low = (title + '\n' + text.slice(0, 4000)).toLowerCase();

  const has = (...keys) => keys.some(k => low.includes(k));

  if (has('retell', 'voice agent', 'appointment setting', 'objection', 'call script', 'inbound', 'outbound')) return 'voice_agents';
  if (has('make.com', 'n8n', 'webhook', 'workflow', 'mcp', 'agent builder', 'automation', 'zapier', 'integrations', 'http request')) return 'automation_systems';
  if (has('sop', 'checklist', 'process', 'weekly review', 'template', 'playbook', 'framework', 'steps')) return 'workflows_sops';
  if (has('ad', 'creative', 'facebook', 'instagram', 'post', 'content system', 'content creation', 'headline', 'copy', 'landing page copy')) return 'marketing_ads';
  if (has('solar', 'utility', 'kwh', 'battery', 'panel', 'pto', 'permit', 'install')) {
    if (has('commercial', 'multifamily', 'warehouse', 'property manager', 'hoa', 'biz', 'business')) return 'solar_commercial';
    return 'solar_residential';
  }
  if (has('strategy', 'business plan', 'model', 'pricing', 'positioning', 'offer', 'crm', 'pipeline')) return 'business_strategy';

  return 'random_ideas';
}

function detectPlaybookSignals(title, text) {
  const low = (title + ' ' + text.slice(0, 2500)).toLowerCase();
  const hits = [];
  for (const k of ['playbook', 'framework', 'steps', 'system', 'workflow', 'sop', 'script', 'checklist', 'template']) {
    if (low.includes(k)) hits.push(k);
  }
  return Array.from(new Set(hits));
}

function mdEscape(s) {
  return String(s || '').replace(/\r/g, '').trim();
}

async function gitCommitPush(kbPath, message) {
  const { execSync } = await import('child_process');
  execSync('git add mission_control/reports', { cwd: kbPath, stdio: 'inherit' });
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: kbPath, stdio: 'inherit' });
  execSync('git push', { cwd: kbPath, stdio: 'inherit' });
}

async function main() {
  const startedAt = Date.now();
  const stopAt = startedAt + 8 * 60 * 60 * 1000;
  const batchSize = Number(process.env.BATCH_SIZE || 15);

  loadEnv('/Users/turtleclaw/.openclaw/workspace/mission-control/api/.env');

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'hhs',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'hhs',
  });

  const kbPath = '/Users/turtleclaw/.openclaw/workspace/hhs/HelpingHandsSystems-KB';
  const reportsDir = path.join(kbPath, 'mission_control/reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  // Workspace anchor for this run
  const runId = `context_build_${Date.now()}`;
  const wsId = await createEntity(pool, {
    entity_type: 'workspace',
    display_name: `Context Build Run (${runId})`,
    attributes: { runId, purpose: 'structured_context_build' },
    actor: 'system',
  });

  const data = JSON.parse(fs.readFileSync('/tmp/conversations.json', 'utf8'));
  const convos = Array.isArray(data) ? data : (Array.isArray(data?.conversations) ? data.conversations : []);

  // existing artifacts to avoid duplicates
  const existing = await pool.query("select source_ref from artifacts where source='chatgpt'");
  const existingSet = new Set(existing.rows.map(r => r.source_ref));

  // Remaining conversations (largest first)
  const remaining = convos
    .map((c, idx) => ({ idx, c, title: pickTitle(c), source_ref: pickSourceRef(c, idx) }))
    .filter(x => !existingSet.has(x.source_ref))
    .map(x => {
      const text = flattenConversation(x.c);
      return { ...x, text, score: text.length };
    })
    .sort((a, b) => b.score - a.score);

  let cursor = 0;
  let batchNum = 0;

  while (Date.now() < stopAt && cursor < remaining.length) {
    batchNum++;
    const batch = remaining.slice(cursor, cursor + batchSize);
    cursor += batch.length;

    const processed = [];
    const breakdown = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
    const insights = { repeated_topics: new Map(), patterns: new Map(), new_playbooks: new Map() };

    for (const item of batch) {
      const category = categorize(item.title, item.text);
      breakdown[category] = (breakdown[category] || 0) + 1;

      // artifact
      const artifactId = await createArtifact(pool, {
        source: 'chatgpt',
        source_ref: item.source_ref,
        title: item.title,
        artifact_type: 'conversation',
        scope: 'personal_context',
        sensitivity: 'personal',
        attributes: { runId, category, score: item.score },
        actor: 'system',
      });

      // anchor
      await addPrimaryAnchor(pool, { artifact_id: artifactId, anchor_entity_id: wsId, anchor_type: 'workspace', actor: 'system' });

      // knowledge
      const summary = makeSummary(item.text);
      let docId = null;
      let chunksInserted = 0;
      if (item.text.trim()) {
        docId = await createKnowledgeDocument(pool, {
          artifact_id: artifactId,
          title: item.title,
          scope: 'personal_context',
          summary,
          tags: { source: 'chatgpt', runId, category },
          actor: 'system',
        });
        const chunks = chunkText(item.text, { maxLen: 1200 });
        chunksInserted = await createKnowledgeChunks(pool, {
          document_id: docId,
          chunks,
          tags: { source: 'chatgpt', runId, category },
          actor: 'system',
        });
      }

      const { dos, donts } = extractDoDont(item.text);
      const playbookSignals = detectPlaybookSignals(item.title, item.text);

      for (const k of [category, ...playbookSignals]) {
        if (!k) continue;
        insights.repeated_topics.set(k, (insights.repeated_topics.get(k) || 0) + 1);
      }
      if (dos.length) insights.patterns.set('has_dos', (insights.patterns.get('has_dos') || 0) + 1);
      if (donts.length) insights.patterns.set('has_donts', (insights.patterns.get('has_donts') || 0) + 1);
      if (playbookSignals.length) insights.new_playbooks.set(item.title, playbookSignals.join(', '));

      processed.push({
        title: item.title,
        source_ref: item.source_ref,
        category,
        summary,
        chunksInserted,
        possible_dos: dos,
        possible_donts: donts,
        playbook_signals: playbookSignals,
      });
    }

    // batch report
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');

    const fileName = `${yyyy}-${mm}-${dd}_context_build_${runId}_batch_${String(batchNum).padStart(2, '0')}_${hh}${mi}.md`;
    const reportPath = path.join(reportsDir, fileName);

    const topMap = (m, n = 10) => {
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    };

    const breakdownMd = Object.entries(breakdown)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const samplesMd = processed.slice(0, 10).map(p => {
      return `### ${mdEscape(p.title)}\n- source_ref: ${p.source_ref}\n- category: ${p.category}\n- summary: ${mdEscape(p.summary || '')}\n- chunks_inserted: ${p.chunksInserted}\n- playbook_signals: ${p.playbook_signals.join(', ') || 'none'}\n- DO (raw):\n${(p.possible_dos || []).map(x => `  - ${mdEscape(x)}`).join('\n') || '  - (none)'}\n- DON’T (raw):\n${(p.possible_donts || []).map(x => `  - ${mdEscape(x)}`).join('\n') || '  - (none)'}\n`;
    }).join('\n');

    const repeatedMd = topMap(insights.repeated_topics, 12)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const patternsMd = topMap(insights.patterns, 10)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const playbooksMd = [...insights.new_playbooks.entries()].slice(0, 10)
      .map(([t, sig]) => `- ${mdEscape(t)} → ${sig}`)
      .join('\n');

    const report = `# Context Build — Batch ${batchNum}\n\n**Run:** ${runId}\n**Batch size:** ${batch.length}\n**Time:** ${yyyy}-${mm}-${dd} ${hh}:${mi}\n\n## Processed\n- documents processed: ${batch.length}\n\n## Category breakdown\n${breakdownMd || '- (none)'}\n\n## Top insights (raw)\n### Repeated topics/signals\n${repeatedMd || '- (none)'}\n\n### Patterns\n${patternsMd || '- (none)'}\n\n### New playbooks/framework signals\n${playbooksMd || '- (none)'}\n\n## Samples (first 10)\n${samplesMd}\n`;

    fs.writeFileSync(reportPath, report, 'utf8');

    // commit/push per batch
    await gitCommitPush(kbPath, `Context build: ${runId} batch ${batchNum} (${batch.length} docs)`);

    // throttle between batches
    await new Promise(r => setTimeout(r, 5000));
  }

  await pool.end();
  console.log(JSON.stringify({ ok: true, runId, batchesCompleted: batchNum }, null, 2));
}

main().catch((e) => {
  console.error('context_build_failed', e);
  process.exit(1);
});
