#!/usr/bin/env node

/**
 * Expands ranked bets after the calibrated research worker has built the evidence feed.
 *
 * The main worker scores brands and creates an initial whitespace list. This step keeps
 * the same public-evidence discipline, but scores every configured whitespace topic and
 * writes a larger ranked-bet set for the dashboard.
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_PATH = path.join(ROOT, 'data', 'dashboard.json');
const RUBRIC_PATH = path.join(ROOT, 'config', 'scoring-rubric-v2.json');
const REVIEW_PATH = path.join(ROOT, 'output', 'review-this-week.md');

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function topicMetadata(topicName) {
  const name = String(topicName || '').toLowerCase();
  if (name.includes('treasury')) return { buyer: 'VP Finance / Treasurer', region: 'Global', horizon: '3-9 months' };
  if (name.includes('cross-border')) return { buyer: 'VP Finance / Treasurer', region: 'Europe / Global', horizon: '0-6 months' };
  if (name.includes('embedded')) return { buyer: 'Platform partnerships lead', region: 'Global', horizon: '3-9 months' };
  if (name.includes('acquirer') || name.includes('merchant enablement')) return { buyer: 'Merchant acquiring / commerce leader', region: 'North America / Global', horizon: '0-6 months' };
  if (name.includes('fraud') || name.includes('identity')) return { buyer: 'Risk, fraud and identity leader', region: 'Global', horizon: '6-12 months' };
  if (name.includes('data intelligence') || name.includes('analytics')) return { buyer: 'Merchant growth / data leader', region: 'Global', horizon: '3-9 months' };
  if (name.includes('commercial card') || name.includes('spend') || name.includes('procurement')) return { buyer: 'Procurement / AP leader', region: 'Global', horizon: '0-6 months' };
  if (name.includes('reconciliation') || name.includes('accounts payable') || name.includes('accounts receivable')) return { buyer: 'Finance operations leader', region: 'Global', horizon: '0-6 months' };
  if (name.includes('supplier') || name.includes('working-capital') || name.includes('working capital')) return { buyer: 'Treasurer / supplier payments lead', region: 'Global', horizon: '3-9 months' };
  if (name.includes('settlement') || name.includes('liquidity') || name.includes('real-time')) return { buyer: 'Treasury operations leader', region: 'Global', horizon: '0-6 months' };
  if (name.includes('account-to-account') || name.includes('open banking') || name.includes('open finance')) return { buyer: 'Payments strategy lead', region: 'Europe / Global', horizon: '3-9 months' };
  if (name.includes('bank') || name.includes('fintech') || name.includes('partner')) return { buyer: 'Bank / fintech partnership leader', region: 'Global', horizon: '6-12 months' };
  return { buyer: 'Finance leaders / enterprise buyers', region: 'Global', horizon: '6-12 months' };
}

function summariseEvidence(items, limit = 3) {
  return items.slice(0, limit).map((item) => `${item.brand}: ${item.title}`).join('; ');
}

function scoreTopic(topic, index, dashboard, rubric) {
  const evidenceFeed = dashboard.evidence_feed || [];
  const brandScores = dashboard.brand_scores || [];
  const clientBrandName = dashboard.client_brand || 'Mastercard';
  const client = brandScores.find((brand) => String(brand.name).toLowerCase() === String(clientBrandName).toLowerCase()) || brandScores[0] || {};
  const clientMetrics = client.metrics || {};
  const clientFitBase = average([clientMetrics.buyer_relevance, clientMetrics.differentiation, clientMetrics.proof_strength], 60);
  const proofKeywords = rubric.scoring_guardrails?.proof_bearing_keywords || ['customer', 'case study', 'partner', 'report', 'research', 'pilot', 'launched', 'increased', 'reduced', 'million', 'billion', 'percent'];
  const buyerKeywords = rubric.b2b_relevance_filter?.include_keywords || ['enterprise', 'treasury', 'finance', 'merchant', 'platform', 'bank', 'acquirer', 'commercial'];
  const keywords = topic.keywords || [];

  const matchedEvidence = evidenceFeed
    .map((item) => ({ item, hits: countMatches(topicText(item), keywords) }))
    .filter((result) => result.hits > 0)
    .sort((a, b) => {
      const proofDelta = Number(b.item.proof_bearing) - Number(a.item.proof_bearing);
      if (proofDelta) return proofDelta;
      const qualityDelta = Number(b.item.evidence_quality_score || 0) - Number(a.item.evidence_quality_score || 0);
      if (qualityDelta) return qualityDelta;
      return b.hits - a.hits;
    })
    .map((result) => result.item);

  const topicEvidence = matchedEvidence.length ? matchedEvidence : evidenceFeed.slice(0, 3);
  const combined = topicEvidence.map(topicText).join(' ');
  const distinctBrands = new Set(matchedEvidence.map((item) => item.brand).filter(Boolean));
  const competitorBrands = new Set(matchedEvidence.map((item) => item.brand).filter((brand) => String(brand).toLowerCase() !== String(clientBrandName).toLowerCase()));
  const buyerHits = countMatches(combined, buyerKeywords);
  const proofHits = countMatches(combined, proofKeywords);
  const proofBearingTopicCount = matchedEvidence.filter((item) => item.proof_bearing).length;
  const avgQuality = average(topicEvidence.map((item) => item.evidence_quality_score), 55);
  const saturation = matchedEvidence.length;

  const buyerSignal = clamp(42 + Math.min(38, buyerHits * 3) + Math.min(12, distinctBrands.size * 3));
  const proofSignal = clamp(34 + Math.min(28, proofHits * 2) + Math.min(20, proofBearingTopicCount * 8) + Math.min(12, avgQuality / 8));
  const crowding = clamp(Math.min(72, competitorBrands.size * 12 + saturation * 7));
  const fit = clamp(clientFitBase * 0.5 + buyerSignal * 0.28 + proofSignal * 0.22);
  const urgency = clamp(44 + Math.min(26, buyerHits * 2.8) + Math.min(16, proofBearingTopicCount * 6) + Math.min(10, saturation * 2));
  const noise = matchedEvidence.length ? crowding : 22;
  const opportunityScore = clamp(fit * 0.46 + urgency * 0.34 + (100 - noise) * 0.2, 35, 92);
  const metadata = topicMetadata(topic.topic);
  const supportingEvidence = topicEvidence.slice(0, 4).map((item) => ({
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
  const buyerSpecificityPull = clamp((fit - 50) * 1.2 + Math.max(0, 100 - noise) * 0.25, 8, 92);
  const businessOutcomePull = clamp((urgency - 50) * 1.05 + (proofSignal - 50) * 0.3, 8, 92);

  return {
    id: `live-${index + 1}-${slugify(topic.topic)}`,
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
    map_impact: {
      buyer_specificity_pull: buyerSpecificityPull,
      business_outcome_pull: businessOutcomePull,
      summary: `Expected to pull ${clientBrandName} toward more specific buyer pain and a more outcome-led map position.`
    },
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
}

function rankedBetMarkdown(dashboard) {
  const lines = ['## Ranked bets from live evidence', ''];
  for (const topic of dashboard.whitespace_topics || []) {
    lines.push(`### ${topic.topic}: ${topic.opportunity_score}/100`);
    lines.push(`- Buyer: ${topic.buyer || 'n/a'}`);
    lines.push(`- Fit / urgency / crowding: ${topic.fit ?? 'n/a'} / ${topic.urgency ?? 'n/a'} / ${topic.noise ?? 'n/a'}`);
    lines.push(`- Evidence items matched: ${topic.source_count ?? 0}`);
    if (topic.map_impact) lines.push(`- Map impact: +${topic.map_impact.buyer_specificity_pull} buyer specificity / +${topic.map_impact.business_outcome_pull} business outcome`);
    lines.push(`- Why: ${topic.why_it_matters}`);
    if (topic.proof) lines.push(`- Proof: ${topic.proof}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function updateReview(dashboard) {
  let review;
  try { review = await fs.readFile(REVIEW_PATH, 'utf8'); }
  catch { return; }
  const replacement = rankedBetMarkdown(dashboard);
  const marker = '## Ranked bets from live evidence';
  const nextMarker = '\n## Recommendations';
  const start = review.indexOf(marker);
  const end = start === -1 ? -1 : review.indexOf(nextMarker, start);
  if (start !== -1 && end !== -1) review = review.slice(0, start) + replacement + review.slice(end);
  else review = `${review.trim()}\n\n${replacement}\n`;
  await fs.writeFile(REVIEW_PATH, review, 'utf8');
}

async function main() {
  const dashboard = JSON.parse(await fs.readFile(DASHBOARD_PATH, 'utf8'));
  const rubric = JSON.parse(await fs.readFile(RUBRIC_PATH, 'utf8'));
  const limit = Math.max(1, Number(rubric.ranked_bet_limit || rubric.whitespace_topic_limit || 10));
  const topics = rubric.whitespace_topics || [];

  if (!topics.length) {
    console.log('No whitespace topics configured; ranked bets unchanged.');
    return;
  }

  if (!dashboard.evidence_feed?.length) {
    dashboard.whitespace_topics = (dashboard.whitespace_topics || []).slice(0, limit);
  } else {
    dashboard.whitespace_topics = topics
      .map((topic, index) => scoreTopic(topic, index, dashboard, rubric))
      .sort((a, b) => b.opportunity_score - a.opportunity_score || b.source_count - a.source_count)
      .slice(0, limit);
  }

  dashboard.run_diagnostics = {
    ...(dashboard.run_diagnostics || {}),
    ranked_bet_limit: limit,
    candidate_whitespace_topics: topics.length,
    ranked_bets_generated: dashboard.whitespace_topics.length
  };

  await fs.writeFile(DASHBOARD_PATH, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8');
  await updateReview(dashboard);
  console.log(`Expanded ranked bets: ${dashboard.whitespace_topics.length}/${topics.length} candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
