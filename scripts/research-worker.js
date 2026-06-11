#!/usr/bin/env node

/**
 * Simple backend-style research worker for a static intelligence dashboard.
 *
 * What it does:
 * - Reads data/sources.json and config/scoring-rubric.json
 * - Fetches enabled public URLs
 * - Extracts readable text
 * - Keeps B2B-relevant evidence only
 * - Scores competitors against the rubric
 * - Writes data/dashboard.json
 * - Appends memory/weekly-change-log.md
 * - Writes output/review-this-week.md
 *
 * This is deliberately simple. It has no database, no auth and no external packages.
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_DIR = path.join(ROOT, 'config');
const MEMORY_DIR = path.join(ROOT, 'memory');
const OUTPUT_DIR = path.join(ROOT, 'output');

const DASHBOARD_PATH = path.join(DATA_DIR, 'dashboard.json');
const SOURCES_PATH = path.join(DATA_DIR, 'sources.json');
const RUBRIC_PATH = path.join(CONFIG_DIR, 'scoring-rubric.json');
const CHANGE_LOG_PATH = path.join(MEMORY_DIR, 'weekly-change-log.md');
const REVIEW_PATH = path.join(OUTPUT_DIR, 'review-this-week.md');

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normaliseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normaliseWhitespace(decodeEntities(match[1])) : 'Untitled public page';
}

function htmlToText(html) {
  return normaliseWhitespace(
    decodeEntities(
      String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--([\s\S]*?)-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function countMatches(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return (keywords || []).reduce((total, keyword) => {
    const needle = String(keyword || '').toLowerCase();
    if (!needle) return total;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = lower.match(regex);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function findMatchedKeywords(text, keywords, limit = 8) {
  const lower = String(text || '').toLowerCase();
  const found = [];
  for (const keyword of keywords || []) {
    const needle = String(keyword || '').toLowerCase();
    if (needle && lower.includes(needle)) found.push(keyword);
    if (found.length >= limit) break;
  }
  return found;
}

function makeSnippet(text, keywords, length = 360) {
  const clean = normaliseWhitespace(text);
  if (!clean) return '';

  const lower = clean.toLowerCase();
  let index = -1;
  for (const keyword of keywords || []) {
    const hit = lower.indexOf(String(keyword).toLowerCase());
    if (hit >= 0 && (index === -1 || hit < index)) index = hit;
  }

  if (index === -1) return clean.slice(0, length);

  const start = Math.max(0, index - 120);
  const end = Math.min(clean.length, start + length);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < clean.length ? '...' : '';
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function isPlaceholderUrl(url) {
  return !url || /replace-this\.example|example\.com/i.test(url);
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 research-worker/0.1 (+static intelligence dashboard)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      title: extractTitle(body),
      text: htmlToText(body),
      rawLength: body.length
    };
  } finally {
    clearTimeout(timeout);
  }
}

function passesB2BFilter(text, sourceType, filter) {
  const includeHits = countMatches(text, filter.include_keywords || []);
  const consumerHits = countMatches(text, filter.exclude_if_only_consumer_keywords || []);
  const minimum = filter.minimum_include_keyword_hits || 2;

  const sourceTypeHint = /business|commercial|enterprise|b2b|partner|merchant|bank|product|press|case|customer/i.test(sourceType || '');
  const passes = includeHits >= minimum || (sourceTypeHint && includeHits >= 1);
  const consumerOnly = consumerHits > 0 && includeHits < minimum;

  return {
    passes: passes && !consumerOnly,
    includeHits,
    consumerHits,
    sourceTypeHint,
    b2bScore: Math.max(0, Math.min(100, includeHits * 12 - consumerHits * 10 + (sourceTypeHint ? 10 : 0)))
  };
}

function scoreCategory(texts, category, evidenceCount) {
  const combined = texts.join(' ');
  const matchCount = countMatches(combined, category.signals || []);
  const uniqueSignals = findMatchedKeywords(combined, category.signals || [], 100).length;

  if (!texts.length) return 0;

  const score = 20 + Math.min(45, matchCount * 4) + Math.min(25, uniqueSignals * 5) + Math.min(10, evidenceCount * 3);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function weightedScore(metrics, categories) {
  const totalWeight = categories.reduce((sum, category) => sum + Number(category.weight || 0), 0) || 100;
  const weighted = categories.reduce((sum, category) => {
    return sum + (Number(metrics[category.id] || 0) * Number(category.weight || 0));
  }, 0);
  return Math.round(weighted / totalWeight);
}

function previousBrandMap(previousDashboard) {
  const map = new Map();
  for (const brand of previousDashboard.brand_scores || []) {
    map.set(brand.name, brand);
  }
  return map;
}

async function analyseCompetitor(competitor, rubric, previousBrand) {
  const allEvidence = [];
  const keptTexts = [];
  const skipped = [];
  const enabledSources = (competitor.sources || []).filter(source => source.enabled !== false);

  for (const source of enabledSources) {
    if (isPlaceholderUrl(source.url)) {
      skipped.push({ url: source.url, reason: 'placeholder URL' });
      continue;
    }

    try {
      const page = await fetchPage(source.url);
      if (!page.ok) {
        skipped.push({ url: source.url, reason: `HTTP ${page.status}` });
        continue;
      }

      const filterResult = passesB2BFilter(page.text, source.source_type, rubric.b2b_relevance_filter || {});
      if (!filterResult.passes) {
        skipped.push({
          url: source.url,
          reason: `filtered out: weak B2B relevance (${filterResult.includeHits} include hits, ${filterResult.consumerHits} consumer hits)`
        });
        continue;
      }

      keptTexts.push(page.text);
      allEvidence.push({
        brand: competitor.name,
        source_type: source.source_type || 'public page',
        title: page.title,
        url: source.url,
        captured_at: nowIso(),
        b2b_relevance_score: filterResult.b2bScore,
        top_signals: findMatchedKeywords(page.text, rubric.b2b_relevance_filter?.include_keywords || [], 8),
        snippet: makeSnippet(page.text, rubric.b2b_relevance_filter?.include_keywords || [])
      });
    } catch (error) {
      skipped.push({ url: source.url, reason: error.message || String(error) });
    }
  }

  if (!keptTexts.length) {
    const previous = previousBrand || {};
    return {
      brandScore: {
        name: competitor.name,
        competitiveness_score: previous.competitiveness_score || 0,
        movement_since_last_run: 0,
        metrics: previous.metrics || {
          share_of_model: 0,
          differentiation: 0,
          buyer_relevance: 0,
          proof_strength: 0
        },
        summary: previous.summary || 'No enabled B2B-relevant public sources were fetched yet.',
        evidence: previous.evidence || [],
        run_note: 'No new evidence fetched. Existing score preserved where available.'
      },
      evidence: [],
      skipped,
      fetchedCount: 0
    };
  }

  const metrics = {};
  for (const category of rubric.categories || []) {
    metrics[category.id] = scoreCategory(keptTexts, category, allEvidence.length);
  }

  const score = weightedScore(metrics, rubric.categories || []);
  const previousScore = Number(previousBrand?.competitiveness_score || 0);
  const movement = previousScore ? score - previousScore : 0;

  const topEvidenceTitles = allEvidence.slice(0, 2).map(item => item.title).join('; ');

  return {
    brandScore: {
      name: competitor.name,
      competitiveness_score: score,
      movement_since_last_run: movement,
      metrics,
      summary: `Based on ${allEvidence.length} B2B-relevant public source${allEvidence.length === 1 ? '' : 's'}. Strongest signals: ${topEvidenceTitles || 'none'}.`,
      evidence: allEvidence.slice(0, 5).map(item => ({
        source_type: item.source_type,
        title: item.title,
        url: item.url,
        snippet: item.snippet
      }))
    },
    evidence: allEvidence,
    skipped,
    fetchedCount: allEvidence.length
  };
}

function scoreWhitespaceTopics(evidenceFeed, rubric, previousDashboard) {
  if (!evidenceFeed.length && previousDashboard.whitespace_topics?.length) {
    return previousDashboard.whitespace_topics;
  }

  const combined = evidenceFeed.map(item => `${item.title} ${item.snippet} ${(item.top_signals || []).join(' ')}`).join(' ');

  return (rubric.whitespace_topics || []).map(topic => {
    const saturation = countMatches(combined, topic.keywords || []);
    const buyerHits = countMatches(combined, ['enterprise', 'cfo', 'treasury', 'merchant', 'platform', 'bank', 'acquirer', 'commercial', 'finance']);

    // Simple v1 logic: strong buyer context plus low-to-medium competitor saturation is interesting.
    const opportunity = Math.max(35, Math.min(95, 70 + Math.min(15, buyerHits) - Math.min(25, saturation * 3) + (saturation > 0 ? 8 : 0)));

    return {
      topic: topic.topic,
      opportunity_score: Math.round(opportunity),
      why_it_matters: saturation > 0
        ? `Detected in public evidence, but not yet saturated enough to treat as a closed space.`
        : `No strong competitor saturation detected in this run, which may make it worth investigating manually.`,
      activation_idea: `Review public evidence and decide whether ${topic.topic.toLowerCase()} should become a buyer-facing brief.`
    };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 5);
}

function makeRecommendations(brandScores, whitespaceTopics, clientBrandName) {
  const client = brandScores.find(brand => brand.name === clientBrandName) || brandScores[0];
  const topWhitespace = whitespaceTopics[0];
  const proofWeak = [...brandScores].sort((a, b) => (a.metrics?.proof_strength || 0) - (b.metrics?.proof_strength || 0))[0];

  const recommendations = [];

  if (topWhitespace) {
    recommendations.push({
      title: `Pressure-test ${topWhitespace.topic}`,
      priority: 'High',
      why: `It currently has the strongest whitespace score in this run.`,
      action: `Create a one-page buyer brief: problem, audience, evidence, competitor crowding and a proposed ${client?.name || 'client'} angle.`
    });
  }

  if (proofWeak) {
    recommendations.push({
      title: `Strengthen proof for ${proofWeak.name}`,
      priority: 'Medium',
      why: `Proof Strength is the weakest visible metric for this brand in the current scoring set.`,
      action: `Add named customers, quantified outcomes, partner announcements or analyst-grade evidence before making a client-facing claim.`
    });
  }

  recommendations.push({
    title: 'Keep the source list narrow for now',
    priority: 'Medium',
    why: 'A controlled source list makes the first version easier to trust, review and debug.',
    action: 'Add 3 to 5 high-quality public URLs per brand before expanding automated discovery.'
  });

  return recommendations;
}

function makeReviewMarkdown({ dashboard, results, skippedSources }) {
  const lines = [];
  lines.push(`# Weekly intelligence review - ${todayIsoDate()}`);
  lines.push('');
  lines.push('This file is generated by `scripts/research-worker.js`. Review before using the output with a client.');
  lines.push('');
  lines.push('## Run summary');
  lines.push('');
  lines.push(`- Market: ${dashboard.market}`);
  lines.push(`- Client brand: ${dashboard.client_brand}`);
  lines.push(`- Brands scored: ${dashboard.brand_scores.length}`);
  lines.push(`- Evidence items kept: ${dashboard.evidence_feed.length}`);
  lines.push(`- Sources skipped or filtered: ${skippedSources.length}`);
  lines.push('');

  lines.push('## Brand scores');
  lines.push('');
  for (const brand of dashboard.brand_scores) {
    const movement = brand.movement_since_last_run > 0 ? `+${brand.movement_since_last_run}` : String(brand.movement_since_last_run || 0);
    lines.push(`- ${brand.name}: ${brand.competitiveness_score}/100 (${movement})`);
  }
  lines.push('');

  lines.push('## Whitespace topics');
  lines.push('');
  for (const topic of dashboard.whitespace_topics) {
    lines.push(`- ${topic.topic}: ${topic.opportunity_score}/100`);
  }
  lines.push('');

  lines.push('## Recommendations');
  lines.push('');
  for (const rec of dashboard.recommendations) {
    lines.push(`### ${rec.title}`);
    lines.push(`Priority: ${rec.priority}`);
    lines.push('');
    lines.push(rec.why);
    lines.push('');
    lines.push(`Action: ${rec.action}`);
    lines.push('');
  }

  if (skippedSources.length) {
    lines.push('## Skipped or filtered sources');
    lines.push('');
    for (const item of skippedSources.slice(0, 30)) {
      lines.push(`- ${item.brand || 'Unknown brand'}: ${item.url} - ${item.reason}`);
    }
    lines.push('');
  }

  if (dashboard.evidence_feed.length) {
    lines.push('## Evidence feed');
    lines.push('');
    for (const item of dashboard.evidence_feed.slice(0, 20)) {
      lines.push(`### ${item.brand} - ${item.title}`);
      lines.push(`- Source type: ${item.source_type}`);
      lines.push(`- URL: ${item.url}`);
      lines.push(`- B2B relevance score: ${item.b2b_relevance_score}`);
      lines.push(`- Signals: ${(item.top_signals || []).join(', ') || 'none'}`);
      lines.push(`- Snippet: ${item.snippet}`);
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function makeChangeLogEntry(dashboard, skippedSources) {
  const lines = [];
  lines.push(`\n## ${todayIsoDate()} - automated research run`);
  lines.push('');
  lines.push(`- Evidence items kept: ${dashboard.evidence_feed.length}`);
  lines.push(`- Sources skipped or filtered: ${skippedSources.length}`);

  const movements = dashboard.brand_scores
    .filter(brand => Number(brand.movement_since_last_run || 0) !== 0)
    .sort((a, b) => Math.abs(b.movement_since_last_run) - Math.abs(a.movement_since_last_run));

  if (movements.length) {
    lines.push('- Score movement:');
    for (const brand of movements) {
      const movement = brand.movement_since_last_run > 0 ? `+${brand.movement_since_last_run}` : String(brand.movement_since_last_run);
      lines.push(`  - ${brand.name}: ${movement}`);
    }
  } else {
    lines.push('- Score movement: no movement detected or no previous score available.');
  }

  if (dashboard.whitespace_topics?.length) {
    lines.push(`- Top whitespace topic: ${dashboard.whitespace_topics[0].topic} (${dashboard.whitespace_topics[0].opportunity_score}/100)`);
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const previousDashboard = await readJson(DASHBOARD_PATH, { brand_scores: [], whitespace_topics: [] });
  const sources = await readJson(SOURCES_PATH);
  const rubric = await readJson(RUBRIC_PATH);
  const previousMap = previousBrandMap(previousDashboard);

  const results = [];
  const skippedSources = [];

  for (const competitor of sources.competitors || []) {
    const result = await analyseCompetitor(competitor, rubric, previousMap.get(competitor.name));
    results.push(result);
    for (const skipped of result.skipped || []) {
      skippedSources.push({ brand: competitor.name, ...skipped });
    }
  }

  const brandScores = results.map(result => result.brandScore);
  const evidenceFeed = results.flatMap(result => result.evidence);
  const whitespaceTopics = scoreWhitespaceTopics(evidenceFeed, rubric, previousDashboard);

  const dashboard = {
    schema_version: '0.1.0',
    last_updated: todayIsoDate(),
    generated_at: nowIso(),
    status: evidenceFeed.length ? 'generated_from_public_sources' : 'no_new_evidence_preserved_previous_scores',
    market: previousDashboard.market || 'B2B payments intelligence',
    client_brand: sources.client_brand || previousDashboard.client_brand || 'Mastercard',
    brand_scores: brandScores,
    whitespace_topics: whitespaceTopics,
    recommendations: makeRecommendations(brandScores, whitespaceTopics, sources.client_brand || previousDashboard.client_brand),
    evidence_feed: evidenceFeed,
    run_diagnostics: {
      sources_kept: evidenceFeed.length,
      sources_skipped_or_filtered: skippedSources.length,
      warning: evidenceFeed.length
        ? null
        : 'No new B2B-relevant evidence was fetched. Check data/sources.json and set real public URLs to enabled: true.'
    }
  };

  await writeJson(DASHBOARD_PATH, dashboard);
  await fs.writeFile(REVIEW_PATH, makeReviewMarkdown({ dashboard, results, skippedSources }), 'utf8');
  await fs.appendFile(CHANGE_LOG_PATH, makeChangeLogEntry(dashboard, skippedSources), 'utf8');

  console.log(`Research worker complete.`);
  console.log(`Evidence kept: ${evidenceFeed.length}`);
  console.log(`Sources skipped or filtered: ${skippedSources.length}`);
  console.log(`Wrote ${path.relative(ROOT, DASHBOARD_PATH)}`);
  console.log(`Wrote ${path.relative(ROOT, REVIEW_PATH)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
