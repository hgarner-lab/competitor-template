#!/usr/bin/env node

/**
 * Calibrated research worker for the intelligence dashboard.
 *
 * This v2 worker deliberately separates B2B relevance from competitive strength.
 * A generic owned product page can prove that a brand has B2B positioning, but it
 * cannot produce an elite score without stronger evidence such as customer proof,
 * partner announcements, dated launch activity, quantified outcomes or reports.
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
const RUBRIC_PATH = path.join(CONFIG_DIR, 'scoring-rubric-v2.json');
const CHANGE_LOG_PATH = path.join(MEMORY_DIR, 'weekly-change-log.md');
const REVIEW_PATH = path.join(OUTPUT_DIR, 'review-this-week.md');

function nowIso() { return new Date().toISOString(); }
function todayIsoDate() { return new Date().toISOString().slice(0, 10); }

async function readJson(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch (error) { if (fallback !== null) return fallback; throw error; }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normaliseWhitespace(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
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
  return normaliseWhitespace(decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')));
}
function escapeRegex(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function countMatches(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return (keywords || []).reduce((total, keyword) => {
    const needle = String(keyword || '').toLowerCase().trim();
    if (!needle) return total;
    const regex = new RegExp(`\\b${escapeRegex(needle)}\\b`, 'gi');
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
  return `${start > 0 ? '...' : ''}${clean.slice(start, end)}${end < clean.length ? '...' : ''}`;
}
function isPlaceholderUrl(url) { return !url || /replace-this\.example|example\.com/i.test(url); }
function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 research-worker/0.2 (+static intelligence dashboard)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5'
      }
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, title: extractTitle(body), text: htmlToText(body), rawLength: body.length };
  } finally { clearTimeout(timeout); }
}

function classifySource(source, page, guardrails) {
  const raw = `${source.source_type || ''} ${source.url || ''} ${page.title || ''}`.toLowerCase();
  let sourceClass = 'product_page';
  if (/case|customer story|customers|success story/.test(raw)) sourceClass = 'customer_story';
  else if (/press|newsroom|announce|announcement|launched|launch/.test(raw)) sourceClass = 'press_release';
  else if (/partner|partnership/.test(raw)) sourceClass = 'partner_announcement';
  else if (/report|research|survey|annual|investor/.test(raw)) sourceClass = 'report_or_research';
  else if (/webinar|event|forum|guide|thought leadership/.test(raw)) sourceClass = 'event_or_webinar';
  else if (/resource|blog|brc/.test(raw)) sourceClass = 'resource_centre';
  else if (/overview|home|carat|enterprise payments overview/.test(raw)) sourceClass = 'overview_page';
  else if (/cardhub|wallet|clover/.test(raw)) sourceClass = 'adjacent_or_mixed';

  const textStart = page.text.slice(0, 900).toLowerCase();
  const boilerplateHits = countMatches(textStart, guardrails.boilerplate_keywords || []);
  const proofHits = countMatches(page.text, guardrails.proof_bearing_keywords || []);
  const genericHits = countMatches(page.text, guardrails.generic_claim_keywords || []);
  const proofBearing = proofHits >= 2 || ['customer_story', 'case_study', 'press_release', 'partner_announcement', 'report_or_research'].includes(sourceClass);
  const navHeavy = boilerplateHits >= 3;
  const sourceQualityBase = guardrails.source_quality_weights?.[sourceClass] || 55;
  const quality = clamp(sourceQualityBase + Math.min(8, proofHits * 2) - Math.min(12, boilerplateHits * 3) - Math.min(8, genericHits), 25, 95);

  return { sourceClass, proofBearing, navHeavy, proofHits, boilerplateHits, genericHits, quality };
}

function passesB2BFilter(text, sourceType, filter) {
  const includeHits = countMatches(text, filter.include_keywords || []);
  const consumerHits = countMatches(text, filter.exclude_if_only_consumer_keywords || []);
  const minimum = filter.minimum_include_keyword_hits || 2;
  const sourceTypeHint = /business|commercial|enterprise|b2b|partner|merchant|bank|product|press|case|customer/i.test(sourceType || '');
  const passes = includeHits >= minimum || (sourceTypeHint && includeHits >= 1);
  const consumerOnly = consumerHits > 0 && includeHits < minimum;
  return { passes: passes && !consumerOnly, includeHits, consumerHits, sourceTypeHint, b2bScore: clamp(includeHits * 8 - consumerHits * 8 + (sourceTypeHint ? 8 : 0), 0, 100) };
}

function scoreCategory(evidence, category) {
  if (!evidence.length) return 0;
  const combined = evidence.map(item => item.text).join(' ');
  const matchCount = countMatches(combined, category.signals || []);
  const uniqueSignals = findMatchedKeywords(combined, category.signals || [], 100).length;
  const avgQuality = evidence.reduce((sum, item) => sum + item.quality, 0) / evidence.length;
  const proofCount = evidence.filter(item => item.proofBearing).length;

  let score = 28 + Math.min(24, uniqueSignals * 3) + Math.min(16, matchCount * 1.4) + avgQuality * 0.25;

  if (category.id === 'proof_strength') {
    score = 22 + Math.min(25, proofCount * 16) + Math.min(20, matchCount * 1.5) + avgQuality * 0.18;
  }
  if (category.id === 'differentiation') {
    score -= Math.min(10, evidence.reduce((sum, item) => sum + item.genericHits, 0));
  }
  return clamp(score);
}

function applyCaps(metrics, evidence, guardrails) {
  const sourceClasses = new Set(evidence.map(item => item.sourceClass));
  const proofCount = evidence.filter(item => item.proofBearing).length;
  const onlyProductOrOverview = evidence.every(item => ['product_page', 'overview_page', 'resource_centre', 'adjacent_or_mixed'].includes(item.sourceClass));
  const navHeavyCount = evidence.filter(item => item.navHeavy).length;
  const caps = [];

  let proofCap = null;
  if (proofCount === 0) proofCap = guardrails.no_proof_bearing_proof_strength_cap || 65;
  if (proofCap !== null) {
    metrics.proof_strength = Math.min(metrics.proof_strength || 0, proofCap);
    caps.push(`Proof Strength capped at ${proofCap}: no proof-bearing source detected.`);
  }

  let overallCap = 100;
  if (onlyProductOrOverview) {
    overallCap = Math.min(overallCap, guardrails.only_product_or_overview_overall_cap || 72);
    caps.push(`Overall capped at ${overallCap}: only product/overview/adjacent sources are present.`);
  }
  if (sourceClasses.size < 3) {
    overallCap = Math.min(overallCap, guardrails.fewer_than_three_source_types_overall_cap || 84);
    caps.push(`Overall capped at ${overallCap}: fewer than three distinct source types.`);
  }
  if (proofCount === 0) overallCap = Math.min(overallCap, guardrails.no_proof_bearing_overall_cap || 76);
  if (proofCount === 1) overallCap = Math.min(overallCap, guardrails.one_proof_bearing_source_overall_cap || 86);
  if (navHeavyCount > 0) {
    metrics.differentiation = Math.min(metrics.differentiation || 0, guardrails.overview_or_nav_heavy_cap || 62);
    metrics.proof_strength = Math.min(metrics.proof_strength || 0, guardrails.overview_or_nav_heavy_cap || 62);
    caps.push('Differentiation and Proof Strength capped for nav-heavy snippets.');
  }

  return { metrics, overallCap, caps, proofCount, sourceTypeCount: sourceClasses.size };
}

function weightedScore(metrics, categories) {
  const totalWeight = categories.reduce((sum, category) => sum + Number(category.weight || 0), 0) || 100;
  const weighted = categories.reduce((sum, category) => sum + Number(metrics[category.id] || 0) * Number(category.weight || 0), 0);
  return Math.round(weighted / totalWeight);
}
function previousBrandMap(previousDashboard) {
  const map = new Map();
  for (const brand of previousDashboard.brand_scores || []) map.set(brand.name, brand);
  return map;
}

async function analyseCompetitor(competitor, rubric, previousBrand) {
  const guardrails = rubric.scoring_guardrails || {};
  const evidence = [];
  const skipped = [];
  const enabledSources = (competitor.sources || []).filter(source => source.enabled !== false);

  for (const source of enabledSources) {
    if (isPlaceholderUrl(source.url)) { skipped.push({ url: source.url, reason: 'placeholder URL' }); continue; }
    try {
      const page = await fetchPage(source.url);
      if (!page.ok) { skipped.push({ url: source.url, reason: `HTTP ${page.status}` }); continue; }
      const filterResult = passesB2BFilter(page.text, source.source_type, rubric.b2b_relevance_filter || {});
      if (!filterResult.passes) {
        skipped.push({ url: source.url, reason: `filtered out: weak B2B relevance (${filterResult.includeHits} include hits, ${filterResult.consumerHits} consumer hits)` });
        continue;
      }
      const classification = classifySource(source, page, guardrails);
      evidence.push({
        brand: competitor.name,
        source_type: source.source_type || 'public page',
        title: page.title,
        url: source.url,
        captured_at: nowIso(),
        b2b_relevance_score: filterResult.b2bScore,
        source_class: classification.sourceClass,
        evidence_quality_score: classification.quality,
        proof_bearing: classification.proofBearing,
        nav_heavy: classification.navHeavy,
        top_signals: findMatchedKeywords(page.text, rubric.b2b_relevance_filter?.include_keywords || [], 8),
        snippet: makeSnippet(page.text, rubric.b2b_relevance_filter?.include_keywords || []),
        text: page.text,
        ...classification
      });
    } catch (error) { skipped.push({ url: source.url, reason: error.message || String(error) }); }
  }

  if (!evidence.length) {
    const previous = previousBrand || {};
    return { brandScore: { name: competitor.name, competitiveness_score: previous.competitiveness_score || 0, movement_since_last_run: 0, metrics: previous.metrics || { share_of_model: 0, differentiation: 0, buyer_relevance: 0, proof_strength: 0 }, summary: previous.summary || 'No enabled B2B-relevant public sources were fetched yet.', evidence: previous.evidence || [], run_note: 'No new evidence fetched. Existing score preserved where available.' }, evidence: [], skipped };
  }

  let metrics = {};
  for (const category of rubric.categories || []) metrics[category.id] = scoreCategory(evidence, category);
  const capResult = applyCaps(metrics, evidence, guardrails);
  metrics = capResult.metrics;
  const uncappedScore = weightedScore(metrics, rubric.categories || []);
  const score = Math.min(uncappedScore, capResult.overallCap);
  const previousScore = Number(previousBrand?.competitiveness_score || 0);
  const movement = 0;
  const movementNote = previousScore && previousScore !== score ? `Previous score was ${previousScore}, but movement is set to 0 until content deltas are verified.` : 'Movement set to 0 until content deltas are verified.';
  const topEvidenceTitles = evidence.slice(0, 2).map(item => item.title).join('; ');

  return { brandScore: { name: competitor.name, competitiveness_score: score, movement_since_last_run: movement, metrics, summary: `Based on ${evidence.length} B2B-relevant public source${evidence.length === 1 ? '' : 's'}. Score is calibrated for source quality. Strongest signals: ${topEvidenceTitles || 'none'}.`, evidence: evidence.slice(0, 5).map(item => ({ source_type: item.source_type, source_class: item.source_class, evidence_quality_score: item.evidence_quality_score, proof_bearing: item.proof_bearing, title: item.title, url: item.url, snippet: item.snippet })), score_diagnostics: { uncapped_score: uncappedScore, applied_overall_cap: capResult.overallCap, proof_bearing_sources: capResult.proofCount, distinct_source_types: capResult.sourceTypeCount, caps_applied: capResult.caps, movement_note: movementNote } }, evidence: evidence.map(({ text, ...item }) => item), skipped };
}

function topicMetadata(topicName) {
  const name = String(topicName || '').toLowerCase();
  if (name.includes('treasury')) return { buyer: 'VP Finance / Treasurer', region: 'Global', horizon: '3-9 months' };
  if (name.includes('cross-border')) return { buyer: 'VP Finance / Treasurer', region: 'Europe / Global', horizon: '0-6 months' };
  if (name.includes('embedded')) return { buyer: 'Platform partnerships lead', region: 'Global', horizon: '3-9 months' };
  if (name.includes('acquirer') || name.includes('merchant')) return { buyer: 'Merchant acquiring / commerce leader', region: 'North America / Global', horizon: '0-6 months' };
  if (name.includes('fraud') || name.includes('identity')) return { buyer: 'Risk, fraud and identity leader', region: 'Global', horizon: '6-12 months' };
  return { buyer: 'Finance leaders / enterprise buyers', region: 'Global', horizon: '6-12 months' };
}

function topicText(item) {
  return `${item.title || ''} ${item.source_type || ''} ${item.source_class || ''} ${item.snippet || ''} ${(item.top_signals || []).join(' ')}`;
}

function average(values, fallback = 0) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : fallback;
}

function valueLabel(score) {
  if (score >= 82) return 'Very high';
  if (score >= 72) return 'High';
  if (score >= 62) return 'Medium-high';
  return 'Emerging';
}

function summariseEvidence(items, limit = 3) {
  return items.slice(0, limit).map(item => `${item.brand}: ${item.title}`).join('; ');
}

function scoreWhitespaceTopics(evidenceFeed, rubric, previousDashboard, brandScores = [], clientBrandName = 'Mastercard') {
  if (!evidenceFeed.length && previousDashboard.whitespace_topics?.length) return previousDashboard.whitespace_topics;

  const client = brandScores.find(brand => String(brand.name).toLowerCase() === String(clientBrandName).toLowerCase()) || brandScores[0] || {};
  const clientMetrics = client.metrics || {};
  const clientFitBase = average([clientMetrics.buyer_relevance, clientMetrics.differentiation, clientMetrics.proof_strength], 60);
  const proofKeywords = rubric.scoring_guardrails?.proof_bearing_keywords || ['customer', 'case study', 'partner', 'report', 'research', 'pilot', 'launched', 'increased', 'reduced', 'million', 'billion', '%'];
  const buyerKeywords = rubric.b2b_relevance_filter?.include_keywords || ['enterprise', 'treasury', 'finance', 'merchant', 'platform', 'bank', 'acquirer', 'commercial'];

  return (rubric.whitespace_topics || []).map((topic, index) => {
    const keywords = topic.keywords || [];
    const matchedEvidence = evidenceFeed
      .map(item => ({ item, hits: countMatches(topicText(item), keywords) }))
      .filter(result => result.hits > 0)
      .sort((a, b) => {
        const proofDelta = Number(b.item.proof_bearing) - Number(a.item.proof_bearing);
        if (proofDelta) return proofDelta;
        const qualityDelta = Number(b.item.evidence_quality_score || 0) - Number(a.item.evidence_quality_score || 0);
        if (qualityDelta) return qualityDelta;
        return b.hits - a.hits;
      })
      .map(result => result.item);

    const topicEvidence = matchedEvidence.length ? matchedEvidence : evidenceFeed.slice(0, 3);
    const combined = topicEvidence.map(topicText).join(' ');
    const distinctBrands = new Set(matchedEvidence.map(item => item.brand).filter(Boolean));
    const competitorBrands = new Set(matchedEvidence.map(item => item.brand).filter(brand => String(brand).toLowerCase() !== String(clientBrandName).toLowerCase()));
    const clientEvidence = matchedEvidence.filter(item => String(item.brand).toLowerCase() === String(clientBrandName).toLowerCase());
    const buyerHits = countMatches(combined, buyerKeywords);
    const proofHits = countMatches(combined, proofKeywords);
    const proofBearingTopicCount = matchedEvidence.filter(item => item.proof_bearing).length;
    const avgQuality = average(topicEvidence.map(item => item.evidence_quality_score), 55);
    const saturation = matchedEvidence.length;

    const buyerSignal = clamp(42 + Math.min(38, buyerHits * 3) + Math.min(12, distinctBrands.size * 3));
    const proofSignal = clamp(34 + Math.min(28, proofHits * 2) + Math.min(20, proofBearingTopicCount * 8) + Math.min(12, avgQuality / 8));
    const crowding = clamp(Math.min(72, competitorBrands.size * 12 + saturation * 7));
    const fit = clamp(clientFitBase * 0.5 + buyerSignal * 0.28 + proofSignal * 0.22);
    const urgency = clamp(44 + Math.min(26, buyerHits * 2.8) + Math.min(16, proofBearingTopicCount * 6) + Math.min(10, saturation * 2));
    const noise = matchedEvidence.length ? crowding : 22;
    const opportunityScore = clamp(fit * 0.46 + urgency * 0.34 + (100 - noise) * 0.2, 35, 92);
    const metadata = topicMetadata(topic.topic);
    const supportingEvidence = topicEvidence.slice(0, 4).map(item => ({
      brand: item.brand,
      title: item.title,
      url: item.url,
      source_type: item.source_type,
      source_class: item.source_class,
      evidence_quality_score: item.evidence_quality_score,
      proof_bearing: item.proof_bearing,
      snippet: item.snippet
    }));

    const brandList = Array.from(distinctBrands).slice(0, 5).join(', ') || 'the current evidence set';
    const proofSummary = supportingEvidence.length ? summariseEvidence(supportingEvidence, 3) : 'No direct public evidence matched this topic in the current run.';
    const crowdingPhrase = competitorBrands.size >= 3 ? 'visible competitor crowding' : competitorBrands.size ? 'some competitor signal' : 'limited competitor signal';

    return {
      id: `live-${index + 1}-${String(topic.topic).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      topic: topic.topic,
      title: topic.topic,
      opportunity_score: opportunityScore,
      confidence: opportunityScore,
      buyer: metadata.buyer,
      region: metadata.region,
      horizon: metadata.horizon,
      value: valueLabel(opportunityScore),
      fit,
      urgency,
      noise,
      source_count: matchedEvidence.length,
      distinct_brands: Array.from(distinctBrands),
      competitor_count: competitorBrands.size,
      supporting_evidence: supportingEvidence,
      why_it_matters: `Detected from ${matchedEvidence.length} matching public evidence item${matchedEvidence.length === 1 ? '' : 's'} across ${brandList}. The evidence shows ${crowdingPhrase}, which makes this a live opportunity to pressure-test rather than a static theme.`,
      thesis: `${topic.topic} is ranking as a live bet because it combines B2B buyer relevance, available proof signals and manageable competitor crowding in the latest source set.`,
      why: `The strongest buyer signal is for ${metadata.buyer.toLowerCase()}, with ${buyerHits} buyer-relevance hits and ${proofBearingTopicCount} proof-bearing source${proofBearingTopicCount === 1 ? '' : 's'} tied to the topic.`,
      activation_idea: `Build a buyer-facing proof ladder for ${topic.topic.toLowerCase()}: what the market is saying, what competitors can prove, and where ${clientBrandName} can credibly create a sharper position.`,
      move: `Turn this into a live evidence table and brief: lead with ${metadata.buyer.toLowerCase()}, cite the strongest public sources, and separate ${clientBrandName}'s proof from competitor noise.`,
      proof: proofSummary,
      risk: noise >= 60
        ? 'Competitor signal is already crowded; the brief needs a sharper Mastercard-specific claim and proof hierarchy.'
        : proofBearingTopicCount < 2
          ? 'The topic has buyer relevance but needs more proof-bearing sources before it is safe for client-facing use.'
          : 'Keep the claim tied to named sources and quantified proof so the bet does not become a generic category statement.'
    };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 5);
}

function makeRecommendations(brandScores, whitespaceTopics, clientBrandName) {
  const topWhitespace = whitespaceTopics[0];
  const proofWeak = [...brandScores].sort((a, b) => (a.metrics?.proof_strength || 0) - (b.metrics?.proof_strength || 0))[0];
  const recommendations = [];
  recommendations.push({ title: 'Treat this run as internal QA, not client-ready intelligence', priority: 'High', why: 'Current inputs are mostly owned product or overview pages, so scores are directionally useful but not executive-ready.', action: 'Add proof-bearing sources before using scores externally: customer stories, partner announcements, press releases, reports, quantified outcomes or dated launch evidence.' });
  if (topWhitespace) recommendations.push({ title: `Pressure-test ${topWhitespace.topic}`, priority: 'Medium', why: 'Whitespace ranking is now based on live evidence counts, buyer signal, proof signal and competitor crowding from the calibrated run.', action: `Create an evidence table for ${topWhitespace.topic}: public proof, competitor crowding, buyer relevance and what ${clientBrandName || 'Mastercard'} can credibly own.` });
  if (proofWeak) recommendations.push({ title: `Strengthen proof for ${proofWeak.name}`, priority: 'Medium', why: 'Proof Strength is the weakest visible metric for this brand in the current scoring set.', action: 'Replace or supplement generic product pages with named customers, quantified outcomes, partner announcements or analyst-grade evidence.' });
  return recommendations;
}

function makeReviewMarkdown({ dashboard, skippedSources }) {
  const lines = [];
  lines.push(`# Weekly intelligence review - ${todayIsoDate()}`);
  lines.push('');
  lines.push('This file is generated by `scripts/research-worker-v2.js`. Treat this as an internal QA artifact until proof-bearing evidence is stronger.');
  lines.push('');
  lines.push('## Run summary');
  lines.push('');
  lines.push(`- Market: ${dashboard.market}`);
  lines.push(`- Client brand: ${dashboard.client_brand}`);
  lines.push(`- Brands scored: ${dashboard.brand_scores.length}`);
  lines.push(`- Evidence items kept: ${dashboard.evidence_feed.length}`);
  lines.push(`- Proof-bearing evidence items: ${dashboard.evidence_feed.filter(item => item.proof_bearing).length}`);
  lines.push(`- Sources skipped or filtered: ${skippedSources.length}`);
  lines.push(`- Readiness: ${dashboard.run_diagnostics.readiness}`);
  lines.push('');
  lines.push('## Brand scores');
  lines.push('');
  for (const brand of dashboard.brand_scores) {
    const diag = brand.score_diagnostics || {};
    lines.push(`- ${brand.name}: ${brand.competitiveness_score}/100 (uncapped ${diag.uncapped_score ?? 'n/a'}, movement ${brand.movement_since_last_run})`);
    if (diag.caps_applied?.length) lines.push(`  - Caps: ${diag.caps_applied.join(' ')}`);
  }
  lines.push('');
  lines.push('## Client-safe claims');
  lines.push('');
  lines.push('- This run used public, attributable sources only.');
  lines.push('- The current evidence base is mostly owned product or overview pages.');
  lines.push('- Scores are calibrated and capped where proof-bearing evidence is thin.');
  lines.push('- Movement is set to 0 until the system can verify source/content deltas.');
  lines.push('');
  lines.push('## Internal hypotheses only');
  lines.push('');
  lines.push('- Exact brand scores and whitespace rankings should not be used externally without manual review.');
  lines.push('- Claims of momentum, advantage or category leadership require stronger proof-bearing sources.');
  lines.push('');
  lines.push('## Ranked bets from live evidence');
  lines.push('');
  for (const topic of dashboard.whitespace_topics) {
    lines.push(`### ${topic.topic}: ${topic.opportunity_score}/100`);
    lines.push(`- Buyer: ${topic.buyer || 'n/a'}`);
    lines.push(`- Fit / urgency / crowding: ${topic.fit ?? 'n/a'} / ${topic.urgency ?? 'n/a'} / ${topic.noise ?? 'n/a'}`);
    lines.push(`- Evidence items matched: ${topic.source_count ?? 0}`);
    lines.push(`- Why: ${topic.why_it_matters}`);
    if (topic.proof) lines.push(`- Proof: ${topic.proof}`);
    lines.push('');
  }
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
    for (const item of skippedSources.slice(0, 30)) lines.push(`- ${item.brand || 'Unknown brand'}: ${item.url} - ${item.reason}`);
    lines.push('');
  }
  if (dashboard.evidence_feed.length) {
    lines.push('## Evidence feed');
    lines.push('');
    for (const item of dashboard.evidence_feed.slice(0, 20)) {
      lines.push(`### ${item.brand} - ${item.title}`);
      lines.push(`- Source type: ${item.source_type}`);
      lines.push(`- Source class: ${item.source_class}`);
      lines.push(`- Evidence quality: ${item.evidence_quality_score}`);
      lines.push(`- Proof-bearing: ${item.proof_bearing ? 'yes' : 'no'}`);
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
  lines.push(`\n## ${todayIsoDate()} - calibrated research run`);
  lines.push('');
  lines.push(`- Evidence items kept: ${dashboard.evidence_feed.length}`);
  lines.push(`- Proof-bearing evidence items: ${dashboard.evidence_feed.filter(item => item.proof_bearing).length}`);
  lines.push(`- Sources skipped or filtered: ${skippedSources.length}`);
  lines.push(`- Readiness: ${dashboard.run_diagnostics.readiness}`);
  lines.push('- Score movement: set to 0 until content deltas are verified.');
  if (dashboard.whitespace_topics?.length) lines.push(`- Top live ranked bet: ${dashboard.whitespace_topics[0].topic} (${dashboard.whitespace_topics[0].opportunity_score}/100, ${dashboard.whitespace_topics[0].source_count || 0} matching evidence items)`);
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
    for (const skipped of result.skipped || []) skippedSources.push({ brand: competitor.name, ...skipped });
  }

  const brandScores = results.map(result => result.brandScore);
  const evidenceFeed = results.flatMap(result => result.evidence);
  const proofBearingCount = evidenceFeed.filter(item => item.proof_bearing).length;
  const clientBrand = sources.client_brand || previousDashboard.client_brand || 'Mastercard';
  const whitespaceTopics = scoreWhitespaceTopics(evidenceFeed, rubric, previousDashboard, brandScores, clientBrand);
  const readiness = proofBearingCount >= sources.competitors.length ? 'AMBER: proof-bearing evidence present, still needs human review' : 'RED: mostly generic owned evidence; do not use scores client-facing yet';

  const dashboard = {
    schema_version: '0.2.0',
    last_updated: todayIsoDate(),
    generated_at: nowIso(),
    status: evidenceFeed.length ? 'generated_from_public_sources_calibrated' : 'no_new_evidence_preserved_previous_scores',
    market: previousDashboard.market || 'B2B payments intelligence',
    client_brand: clientBrand,
    brand_scores: brandScores,
    whitespace_topics: whitespaceTopics,
    recommendations: makeRecommendations(brandScores, whitespaceTopics, clientBrand),
    evidence_feed: evidenceFeed,
    run_diagnostics: { sources_kept: evidenceFeed.length, sources_skipped_or_filtered: skippedSources.length, proof_bearing_sources: proofBearingCount, readiness, warning: 'Scores are calibrated and capped. Client use requires manual review and stronger proof-bearing evidence.' }
  };

  await writeJson(DASHBOARD_PATH, dashboard);
  await fs.writeFile(REVIEW_PATH, makeReviewMarkdown({ dashboard, skippedSources }), 'utf8');
  await fs.appendFile(CHANGE_LOG_PATH, makeChangeLogEntry(dashboard, skippedSources), 'utf8');
  console.log('Calibrated research worker complete.');
  console.log(`Evidence kept: ${evidenceFeed.length}`);
  console.log(`Proof-bearing evidence: ${proofBearingCount}`);
  console.log(`Sources skipped or filtered: ${skippedSources.length}`);
  console.log(`Readiness: ${readiness}`);
}

main().catch(error => { console.error(error); process.exit(1); });
