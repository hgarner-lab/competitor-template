#!/usr/bin/env node

/**
 * Scheduled evidence scout.
 *
 * Uses the OpenAI Responses API with hosted web search to find recent public,
 * proof-bearing evidence and write dashboard-ready JSON into data/agent-runs/.
 * The key is read only from OPENAI_API_KEY at runtime.
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');
const AGENT_RUNS_DIR = path.join(DATA_DIR, 'agent-runs');
const DASHBOARD_PATH = path.join(DATA_DIR, 'dashboard.json');
const SOURCES_PATH = path.join(DATA_DIR, 'sources.json');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'scout-agent-summary.md');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const SCOUT_BRAND = process.env.SCOUT_BRAND || 'All';
const SCOUT_TOPIC = process.env.SCOUT_TOPIC || 'All';
const MAX_ITEMS = Math.max(1, Math.min(5, Number(process.env.SCOUT_MAX_ITEMS || 3)));
const RECENT_DAYS = Math.max(7, Math.min(90, Number(process.env.SCOUT_RECENT_DAYS || 45)));

const BRANDS = ['Mastercard', 'Visa', 'Stripe', 'Adyen', 'PayPal', 'Fiserv'];
const TOPICS = [
  'AI-led treasury automation',
  'Cross-border B2B payment certainty',
  'Embedded finance for enterprise platforms',
  'Acquirer and merchant enablement',
  'Fraud and identity orchestration',
  'Merchant data intelligence',
  'Commercial card spend control',
  'Accounts payable and receivable automation',
  'Supplier working-capital resilience',
  'Real-time settlement and liquidity visibility',
  'Open banking and account-to-account B2B payments',
  'Partner ecosystem orchestration for banks and fintechs',
  'B2B payment acceptance for marketplaces',
  'Enterprise payment risk and compliance assurance'
];

function nowIso() { return new Date().toISOString(); }
function todayIsoDate() { return nowIso().slice(0, 10); }
function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'agent-evidence'; }
function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(value) || 0))); }
function normaliseUrl(url) { return String(url || '').trim().replace(/#.*$/, '').replace(/\/$/, ''); }
function asArray(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch { return fallback; }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function listJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await listJsonFiles(full));
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
    }
    return files;
  } catch {
    return [];
  }
}

function collectUrls(value, urls = new Set()) {
  if (!value) return urls;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) urls.add(normaliseUrl(value));
    return urls;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls);
    return urls;
  }
  if (typeof value === 'object') {
    for (const key of ['url', 'source_url', 'link']) {
      if (value[key]) urls.add(normaliseUrl(value[key]));
    }
    for (const nested of Object.values(value)) collectUrls(nested, urls);
  }
  return urls;
}

async function existingUrls() {
  const dashboard = await readJson(DASHBOARD_PATH, {});
  const sources = await readJson(SOURCES_PATH, {});
  const urls = collectUrls(dashboard);
  collectUrls(sources, urls);
  for (const file of await listJsonFiles(AGENT_RUNS_DIR)) {
    collectUrls(await readJson(file, {}), urls);
  }
  return urls;
}

function evidenceSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      evidence_items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            run_id: { type: 'string' },
            agent: { type: 'string' },
            brand: { type: 'string', enum: BRANDS },
            topic: { type: 'string', enum: TOPICS },
            source_url: { type: 'string' },
            source_title: { type: 'string' },
            source_type: { type: 'string' },
            published_at: { type: 'string' },
            observed_at: { type: 'string' },
            claim: { type: 'string' },
            evidence: { type: 'string' },
            metrics: {
              type: 'object',
              additionalProperties: false,
              properties: {
                buyer_relevance: { type: 'number' },
                proof_strength: { type: 'number' },
                differentiation: { type: 'number' },
                share_of_model: { type: 'number' }
              },
              required: ['buyer_relevance', 'proof_strength', 'differentiation', 'share_of_model']
            },
            confidence: { type: 'number' },
            dedupe_key: { type: 'string' }
          },
          required: [
            'run_id', 'agent', 'brand', 'topic', 'source_url', 'source_title',
            'source_type', 'published_at', 'observed_at', 'claim', 'evidence',
            'metrics', 'confidence', 'dedupe_key'
          ]
        }
      },
      notes: { type: 'string' }
    },
    required: ['evidence_items', 'notes']
  };
}

function scoutPrompt(urls) {
  const brandLine = SCOUT_BRAND && SCOUT_BRAND !== 'All' ? `Target brand: ${SCOUT_BRAND}` : `Target brands: ${BRANDS.join(', ')}`;
  const topicLine = SCOUT_TOPIC && SCOUT_TOPIC !== 'All' ? `Target topic: ${SCOUT_TOPIC}` : `Target topics: ${TOPICS.join('; ')}`;
  const avoidList = Array.from(urls).filter(Boolean).sort().slice(0, 140).map((url) => `- ${url}`).join('\n');

  return `Find up to ${MAX_ITEMS} recent, public, proof-bearing B2B payments evidence items for the Mastercard competitor dashboard.\n\n${brandLine}\n${topicLine}\nRecent window: last ${RECENT_DAYS} days where possible.\n\nAvoid every URL below because it is already in the dashboard or already submitted:\n${avoidList || '- No avoided URLs found.'}\n\nRules:\n- Use only public attributable URLs.\n- Prefer official press releases, customer stories, partner announcements, research reports, investor sources, or clearly B2B product pages.\n- Do not use consumer-only evidence unless it materially affects B2B positioning.\n- Do not invent missing dates or claims. If a source has no visible publication date, set published_at to an empty string.\n- Use metrics on a 0-100 scale.\n- Use confidence on a 0-1 scale.\n- Return only high-confidence items with confidence >= 0.70.\n- Do not return a URL from the avoided list.\n- Use lowercase dedupe_key with this pattern: brand|topic-slug|source-url.\n- source_type should be descriptive, for example customer story - Quadient embedded payments, press_release, partner_announcement, report_or_research, product_page, investor_source, or executive_post.`;
}

function outputText(data) {
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
      if (typeof content.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('\n').trim();
}

async function callOpenAI(urls) {
  const body = {
    model: OPENAI_MODEL,
    tools: [{ type: 'web_search', external_web_access: true }],
    tool_choice: 'required',
    input: [
      {
        role: 'system',
        content: 'You are a careful B2B payments competitor evidence analyst. You find only public, attributable, proof-bearing evidence and return strict JSON for a dashboard ingestion pipeline.'
      },
      { role: 'user', content: scoutPrompt(urls) }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'agent_evidence_batch',
        strict: true,
        schema: evidenceSchema()
      }
    }
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI API request failed with ${response.status}: ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const text = outputText(data);
  if (!text) throw new Error('OpenAI response did not include parseable output text.');
  return JSON.parse(text);
}

function cleanItem(item, urls) {
  const url = normaliseUrl(item.source_url);
  if (!url || urls.has(url)) return null;
  if (!BRANDS.includes(item.brand) || !TOPICS.includes(item.topic)) return null;
  const confidence = Number(item.confidence || 0);
  if (!Number.isFinite(confidence) || confidence < 0.7) return null;
  const observedAt = item.observed_at || nowIso();
  const metrics = item.metrics || {};
  return {
    run_id: item.run_id || `${todayIsoDate()}-dashboard-evidence-scout`,
    agent: item.agent || 'dashboard-evidence-scout',
    brand: item.brand,
    topic: item.topic,
    source_url: url,
    source_title: String(item.source_title || '').trim(),
    source_type: String(item.source_type || 'agent_signal').trim(),
    published_at: String(item.published_at || '').trim(),
    observed_at: observedAt,
    claim: String(item.claim || '').trim(),
    evidence: String(item.evidence || item.claim || '').trim(),
    metrics: {
      buyer_relevance: clamp(metrics.buyer_relevance),
      proof_strength: clamp(metrics.proof_strength),
      differentiation: clamp(metrics.differentiation),
      share_of_model: clamp(metrics.share_of_model)
    },
    confidence,
    dedupe_key: String(item.dedupe_key || `${item.brand}|${slug(item.topic)}|${url}`).toLowerCase()
  };
}

async function writeEvidence(items) {
  await fs.mkdir(AGENT_RUNS_DIR, { recursive: true });
  const written = [];
  const stamp = nowIso().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let index = 1;
  for (const item of items) {
    const file = path.join(AGENT_RUNS_DIR, `${stamp}-${String(index).padStart(2, '0')}-${slug(item.brand)}-${slug(item.topic)}.json`);
    await writeJson(file, item);
    written.push(path.relative(ROOT, file));
    index += 1;
  }
  return written;
}

async function writeSummary(written, result, skippedReason = '') {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const lines = [];
  lines.push(`# Scout agent summary - ${todayIsoDate()}`);
  lines.push('');
  lines.push(`- Model: ${OPENAI_MODEL}`);
  lines.push(`- Brand scope: ${SCOUT_BRAND}`);
  lines.push(`- Topic scope: ${SCOUT_TOPIC}`);
  lines.push(`- Items written: ${written.length}`);
  if (skippedReason) lines.push(`- Note: ${skippedReason}`);
  lines.push('');
  lines.push('## Files written');
  lines.push('');
  if (written.length) for (const file of written) lines.push(`- ${file}`);
  else lines.push('- None');
  lines.push('');
  if (result && result.notes) {
    lines.push('## Model notes');
    lines.push('');
    lines.push(String(result.notes));
    lines.push('');
  }
  await fs.writeFile(SUMMARY_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  require('fs').appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY. Add it as a GitHub Actions secret before running this workflow.');
    setOutput('items_written', '0');
    process.exit(2);
  }

  const urls = await existingUrls();
  const result = await callOpenAI(urls);
  const cleaned = asArray(result.evidence_items).map((item) => cleanItem(item, urls)).filter(Boolean).slice(0, MAX_ITEMS);
  const written = await writeEvidence(cleaned);
  await writeSummary(written, result, cleaned.length ? '' : 'No new high-confidence evidence found.');
  setOutput('items_written', String(written.length));
  console.log(`Scout evidence items written: ${written.length}`);
}

main().catch(async (error) => {
  console.error(error.message || error);
  setOutput('items_written', '0');
  try { await writeSummary([], null, error.message || String(error)); } catch {}
  process.exit(1);
});
