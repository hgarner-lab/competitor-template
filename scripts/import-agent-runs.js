#!/usr/bin/env node

/**
 * Normalise recent agent outputs into a shared evidence feed.
 *
 * Agents can drop JSON files into data/agent-runs/. Each file may contain a single
 * object, an array, or an object with runs/results/items/evidence. This script turns
 * those mixed outputs into data/evidence-feed.json plus lightweight health/ledger
 * files for review.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const MEMORY_DIR = path.join(ROOT, 'memory');
const OUTPUT_DIR = path.join(ROOT, 'output');
const DEFAULT_AGENT_DIR = path.join(DATA_DIR, 'agent-runs');
const AGENT_DIR = process.env.AGENT_RUNS_DIR ? path.resolve(process.env.AGENT_RUNS_DIR) : DEFAULT_AGENT_DIR;
const EVIDENCE_FEED_PATH = path.join(DATA_DIR, 'evidence-feed.json');
const LEDGER_PATH = path.join(MEMORY_DIR, 'evidence-ledger.json');
const SOURCE_HEALTH_PATH = path.join(MEMORY_DIR, 'source-health.json');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'agent-ingestion-summary.md');
const RECENT_DAYS = Number(process.env.AGENT_RUN_RECENT_DAYS || 45);

function nowIso() { return new Date().toISOString(); }
function todayIsoDate() { return new Date().toISOString().slice(0, 10); }
function normaliseWhitespace(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(value) || 0))); }
function hash(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16); }
function asArray(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }

async function readJson(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (fallback !== null) return fallback; throw error; }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function pathExists(filePath) {
  try { await fs.access(filePath); return true; }
  catch { return false; }
}

async function listJsonFiles(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
  }
  return files.sort();
}

function confidenceToPercent(value, fallback = 60) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return clamp(raw <= 1 ? raw * 100 : raw, 0, 100);
}

function classifySource(sourceType = '', url = '') {
  const raw = `${sourceType} ${url}`.toLowerCase();
  if (/case|customer story|customers|success story/.test(raw)) return 'customer_story';
  if (/press|newsroom|announce|announcement|launched|launch/.test(raw)) return 'press_release';
  if (/partner|partnership/.test(raw)) return 'partner_announcement';
  if (/report|research|survey|annual|investor/.test(raw)) return 'report_or_research';
  if (/webinar|event|forum|guide|thought leadership/.test(raw)) return 'event_or_webinar';
  if (/resource|blog|brc/.test(raw)) return 'resource_centre';
  if (/overview|home/.test(raw)) return 'overview_page';
  return 'agent_signal';
}

function sourceQuality(sourceClass, confidence) {
  const weights = {
    customer_story: 92,
    press_release: 86,
    partner_announcement: 86,
    report_or_research: 84,
    event_or_webinar: 74,
    product_page: 64,
    overview_page: 56,
    resource_centre: 48,
    agent_signal: 68
  };
  const base = weights[sourceClass] || 60;
  return clamp(base * 0.55 + confidence * 0.45, 25, 95);
}

function isProofBearing(sourceClass, text, explicitValue) {
  if (typeof explicitValue === 'boolean') return explicitValue;
  if (['customer_story', 'press_release', 'partner_announcement', 'report_or_research'].includes(sourceClass)) return true;
  return /case study|customer|client|partner|partnership|announced|launched|report|research|survey|pilot|deployed|increased|reduced|improved|million|billion|percent|roi/i.test(text);
}

function expandPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['runs', 'results', 'items', 'evidence', 'findings', 'signals']) {
    if (Array.isArray(payload[key])) return payload[key].map((item) => ({ ...item, parent_run_id: payload.run_id, parent_agent: payload.agent }));
  }
  return [payload];
}

function withinRecentWindow(value) {
  if (!RECENT_DAYS || RECENT_DAYS <= 0) return true;
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return time >= cutoff;
}

function normaliseRecord(record, sourceFile) {
  const source = record.source || {};
  const metrics = record.metrics || record.scores || {};
  const agent = record.agent || record.agent_name || record.parent_agent || 'unknown-agent';
  const runId = record.run_id || record.parent_run_id || path.basename(sourceFile, '.json');
  const brand = record.brand || record.competitor || record.company || record.entity || source.brand || '';
  const topic = record.topic || record.theme || record.category || record.query || record.signal || 'Uncategorised agent signal';
  const sourceUrl = record.source_url || record.url || record.link || source.url || '';
  const title = record.source_title || record.title || source.title || topic;
  const sourceType = record.source_type || source.type || `agent run - ${agent}`;
  const observedAt = record.observed_at || record.captured_at || record.run_at || record.created_at || nowIso();
  const publishedAt = record.published_at || record.date || source.published_at || null;
  const claim = normaliseWhitespace(record.claim || record.finding || record.summary || record.evidence || record.snippet || record.description || '');
  const snippet = normaliseWhitespace(record.snippet || record.evidence || record.summary || record.claim || claim);
  const confidence = confidenceToPercent(record.confidence ?? record.evidence_confidence ?? metrics.confidence ?? metrics.proof_strength, 60);
  const sourceClass = record.source_class || classifySource(sourceType, sourceUrl);
  const topSignals = asArray(record.top_signals || record.signals || record.keywords || topic.split(/[,+/]/)).map(normaliseWhitespace).filter(Boolean).slice(0, 12);
  const text = normaliseWhitespace([title, topic, claim, snippet, topSignals.join(' ')].join(' '));

  if (!brand || !text) return { error: 'missing brand or evidence text' };
  if (!withinRecentWindow(observedAt || publishedAt)) return { error: `outside ${RECENT_DAYS}-day recent window` };

  const dedupeKey = String(record.dedupe_key || `${brand}|${topic}|${sourceUrl || title}|${claim.slice(0, 120)}`).toLowerCase();
  return {
    evidence: {
      brand,
      topic,
      source_type: sourceType,
      title,
      url: sourceUrl,
      captured_at: observedAt,
      published_at: publishedAt || undefined,
      b2b_relevance_score: clamp(record.b2b_relevance_score ?? metrics.buyer_relevance ?? confidence, 0, 100),
      source_class: sourceClass,
      evidence_quality_score: sourceQuality(sourceClass, confidence),
      proof_bearing: isProofBearing(sourceClass, text, record.proof_bearing),
      nav_heavy: Boolean(record.nav_heavy),
      top_signals: topSignals,
      snippet: snippet || claim || title,
      text,
      agent,
      run_id: runId,
      confidence,
      claim,
      metrics,
      source_origin: 'agent_run',
      source_file: path.relative(ROOT, sourceFile),
      dedupe_key: dedupeKey,
      content_hash: hash([brand, topic, sourceUrl, title, claim, snippet].join('|'))
    }
  };
}

function dedupeEvidence(records) {
  const byKey = new Map();
  for (const item of records) {
    const key = item.dedupe_key || `${item.brand}|${item.topic}|${item.url || item.title}`.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, item); continue; }
    const existingScore = Number(existing.evidence_quality_score || 0) + Number(existing.proof_bearing) * 20 + Number(existing.confidence || 0) * 0.2;
    const nextScore = Number(item.evidence_quality_score || 0) + Number(item.proof_bearing) * 20 + Number(item.confidence || 0) * 0.2;
    if (nextScore >= existingScore) byKey.set(key, item);
  }
  return Array.from(byKey.values()).sort((a, b) => String(b.captured_at || '').localeCompare(String(a.captured_at || '')));
}

function makeSourceHealth(evidence) {
  const sources = new Map();
  for (const item of evidence) {
    const key = item.url || `${item.agent}:${item.brand}:${item.topic}`;
    const current = sources.get(key) || {
      brand: item.brand,
      topic: item.topic,
      url: item.url || null,
      source_type: item.source_type,
      source_class: item.source_class,
      agents: new Set(),
      evidence_count: 0,
      last_seen: item.captured_at,
      highest_confidence: 0,
      proof_bearing: false
    };
    current.agents.add(item.agent);
    current.evidence_count += 1;
    current.last_seen = [current.last_seen, item.captured_at].filter(Boolean).sort().pop();
    current.highest_confidence = Math.max(current.highest_confidence, Number(item.confidence || 0));
    current.proof_bearing = current.proof_bearing || Boolean(item.proof_bearing);
    sources.set(key, current);
  }
  return Array.from(sources.values()).map((item) => ({ ...item, agents: Array.from(item.agents) }));
}

function makeSummary(feed) {
  const byBrand = feed.agent_evidence.reduce((map, item) => {
    map[item.brand] = (map[item.brand] || 0) + 1;
    return map;
  }, {});
  const lines = [];
  lines.push(`# Agent ingestion summary - ${todayIsoDate()}`);
  lines.push('');
  lines.push(`- Files read: ${feed.diagnostics.files_read}`);
  lines.push(`- Records seen: ${feed.diagnostics.records_seen}`);
  lines.push(`- Records kept: ${feed.diagnostics.records_kept}`);
  lines.push(`- Records skipped: ${feed.diagnostics.records_skipped}`);
  lines.push(`- Recent window: ${feed.recent_window_days} days`);
  lines.push('');
  lines.push('## Evidence by brand');
  lines.push('');
  for (const [brand, count] of Object.entries(byBrand).sort()) lines.push(`- ${brand}: ${count}`);
  if (!Object.keys(byBrand).length) lines.push('- No agent evidence found yet.');
  lines.push('');
  if (feed.diagnostics.skipped.length) {
    lines.push('## Skipped records');
    lines.push('');
    for (const item of feed.diagnostics.skipped.slice(0, 20)) lines.push(`- ${item.file}: ${item.reason}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await fs.mkdir(AGENT_DIR, { recursive: true });
  const files = await listJsonFiles(AGENT_DIR);
  const kept = [];
  const skipped = [];
  let recordsSeen = 0;

  for (const file of files) {
    let payload;
    try { payload = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { skipped.push({ file: path.relative(ROOT, file), reason: `invalid JSON: ${error.message}` }); continue; }

    for (const record of expandPayload(payload)) {
      recordsSeen += 1;
      const result = normaliseRecord(record, file);
      if (result.error) skipped.push({ file: path.relative(ROOT, file), reason: result.error });
      else kept.push(result.evidence);
    }
  }

  const agentEvidence = dedupeEvidence(kept);
  const feed = {
    schema_version: '0.1.0',
    generated_at: nowIso(),
    recent_window_days: RECENT_DAYS,
    source_dir: path.relative(ROOT, AGENT_DIR),
    agent_evidence: agentEvidence,
    diagnostics: {
      files_read: files.length,
      records_seen: recordsSeen,
      records_kept: agentEvidence.length,
      records_skipped: skipped.length,
      skipped
    }
  };

  const previousLedger = await readJson(LEDGER_PATH, { schema_version: '0.1.0', history: [] });
  const ledgerEntry = {
    run_at: feed.generated_at,
    files_read: files.length,
    records_seen: recordsSeen,
    records_kept: agentEvidence.length,
    records_skipped: skipped.length,
    brands: Array.from(new Set(agentEvidence.map((item) => item.brand))).sort(),
    agents: Array.from(new Set(agentEvidence.map((item) => item.agent))).sort()
  };

  await writeJson(EVIDENCE_FEED_PATH, feed);
  await writeJson(LEDGER_PATH, { schema_version: '0.1.0', latest: ledgerEntry, history: [ledgerEntry, ...(previousLedger.history || [])].slice(0, 50) });
  await writeJson(SOURCE_HEALTH_PATH, { schema_version: '0.1.0', generated_at: nowIso(), sources: makeSourceHealth(agentEvidence) });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(SUMMARY_PATH, makeSummary(feed), 'utf8');

  console.log(`Agent evidence imported: ${agentEvidence.length}/${recordsSeen} records from ${files.length} files.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
