#!/usr/bin/env node

/**
 * Merge normalised agent evidence into the dashboard evidence feed.
 *
 * The calibrated research worker owns public-source scoring. This step lets agent
 * evidence enrich the dashboard evidence layer and ranked-bet generation without
 * letting raw agent outputs directly drive the front end.
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DASHBOARD_PATH = path.join(DATA_DIR, 'dashboard.json');
const EVIDENCE_FEED_PATH = path.join(DATA_DIR, 'evidence-feed.json');

async function readJson(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (fallback !== null) return fallback; throw error; }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normaliseWhitespace(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function keyFor(item) {
  return String(item.dedupe_key || `${item.brand || ''}|${item.topic || ''}|${item.url || item.title || ''}|${(item.snippet || '').slice(0, 80)}`).toLowerCase();
}

function dashboardEvidence(item) {
  const text = normaliseWhitespace(item.text || `${item.title || ''} ${item.topic || ''} ${item.claim || ''} ${item.snippet || ''} ${(item.top_signals || []).join(' ')}`);
  return {
    brand: item.brand,
    topic: item.topic,
    source_type: item.source_type || 'agent signal',
    title: item.title || item.topic || 'Agent evidence',
    url: item.url || '',
    captured_at: item.captured_at,
    published_at: item.published_at,
    b2b_relevance_score: item.b2b_relevance_score || item.confidence || 0,
    source_class: item.source_class || 'agent_signal',
    evidence_quality_score: item.evidence_quality_score || item.confidence || 0,
    proof_bearing: Boolean(item.proof_bearing),
    nav_heavy: Boolean(item.nav_heavy),
    top_signals: item.top_signals || [],
    snippet: item.snippet || item.claim || item.title || '',
    text,
    agent: item.agent,
    run_id: item.run_id,
    confidence: item.confidence,
    source_origin: item.source_origin || 'agent_run',
    dedupe_key: keyFor(item)
  };
}

function evidenceRank(item) {
  return Number(item.evidence_quality_score || 0) + Number(item.proof_bearing) * 20 + Number(item.confidence || 0) * 0.2 + (item.source_origin === 'agent_run' ? 3 : 0);
}

function mergeEvidence(publicEvidence, agentEvidence) {
  const merged = new Map();
  for (const item of publicEvidence || []) {
    const key = keyFor(item);
    merged.set(key, { ...item, dedupe_key: key });
  }
  for (const item of agentEvidence || []) {
    const normalised = dashboardEvidence(item);
    const key = keyFor(normalised);
    const existing = merged.get(key);
    if (!existing || evidenceRank(normalised) >= evidenceRank(existing)) merged.set(key, normalised);
  }
  return Array.from(merged.values()).sort((a, b) => String(b.captured_at || '').localeCompare(String(a.captured_at || '')));
}

function appendBrandEvidence(brandScores, agentEvidence) {
  for (const brand of brandScores || []) {
    const brandName = String(brand.name || '').toLowerCase();
    const agentForBrand = agentEvidence
      .filter((item) => String(item.brand || '').toLowerCase() === brandName)
      .sort((a, b) => evidenceRank(b) - evidenceRank(a))
      .slice(0, 4)
      .map((item) => ({
        source_type: item.source_type || 'agent signal',
        source_class: item.source_class || 'agent_signal',
        evidence_quality_score: item.evidence_quality_score || item.confidence || 0,
        proof_bearing: Boolean(item.proof_bearing),
        title: item.title || item.topic || 'Agent evidence',
        url: item.url || '',
        snippet: item.snippet || item.claim || '',
        source_origin: 'agent_run',
        agent: item.agent,
        run_id: item.run_id
      }));
    if (!agentForBrand.length) continue;
    const existing = brand.evidence || [];
    const byKey = new Map();
    for (const item of [...agentForBrand, ...existing]) {
      const key = `${item.source_origin || 'public'}|${item.url || item.title || ''}|${item.snippet || ''}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }
    brand.evidence = Array.from(byKey.values()).slice(0, 8);
  }
}

async function main() {
  const dashboard = await readJson(DASHBOARD_PATH, null);
  const feed = await readJson(EVIDENCE_FEED_PATH, { agent_evidence: [], diagnostics: {} });
  const agentEvidence = Array.isArray(feed) ? feed : (feed.agent_evidence || feed.evidence || []);

  if (!agentEvidence.length) {
    dashboard.run_diagnostics = {
      ...(dashboard.run_diagnostics || {}),
      agent_evidence_items: 0,
      agent_evidence_note: 'No recent agent evidence found in data/agent-runs.'
    };
    await writeJson(DASHBOARD_PATH, dashboard);
    console.log('No agent evidence to merge.');
    return;
  }

  const publicEvidence = dashboard.evidence_feed || [];
  const mergedEvidence = mergeEvidence(publicEvidence, agentEvidence);
  appendBrandEvidence(dashboard.brand_scores || [], agentEvidence.map(dashboardEvidence));

  dashboard.evidence_feed = mergedEvidence;
  dashboard.status = `${dashboard.status || 'generated'}_with_agent_evidence`;
  dashboard.run_diagnostics = {
    ...(dashboard.run_diagnostics || {}),
    sources_kept: mergedEvidence.length,
    public_evidence_items: publicEvidence.length,
    agent_evidence_items: agentEvidence.length,
    merged_evidence_items: mergedEvidence.length,
    agent_evidence_generated_at: feed.generated_at || null,
    agent_evidence_recent_window_days: feed.recent_window_days || null
  };

  await writeJson(DASHBOARD_PATH, dashboard);
  console.log(`Merged ${agentEvidence.length} agent evidence items into dashboard evidence feed (${mergedEvidence.length} total).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
