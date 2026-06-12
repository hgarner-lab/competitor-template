const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

function replaceAll(oldValue, newValue) {
  text = text.split(oldValue).join(newValue);
}

function insertBefore(marker, value, label) {
  if (text.includes(value)) return true;
  const index = text.indexOf(marker);
  if (index === -1) {
    console.warn('Skipped ' + label + ': marker not found');
    return false;
  }
  text = text.slice(0, index) + value + text.slice(index);
  return true;
}

function replaceWedgeMarkup() {
  const start = text.indexOf('        wedgeCard.innerHTML = `');
  const endMarker = '`;\n      }\n\n      function briefMarkdown';
  const end = start === -1 ? -1 : text.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    console.warn('Skipped wedge markup: marker not found');
    return false;
  }
  const replacement = [
    '        const evidenceBrands = Array.isArray(opportunity.distinct_brands) && opportunity.distinct_brands.length',
    '          ? opportunity.distinct_brands.join(", ")',
    '          : (Array.isArray(opportunity.supporting_evidence) ? [...new Set(opportunity.supporting_evidence.map((item) => item.brand).filter(Boolean))].slice(0, 4).join(", ") : "");',
    '        const evidenceCount = opportunity.source_count || (Array.isArray(opportunity.supporting_evidence) ? opportunity.supporting_evidence.length : 0);',
    '        const snapshotScore = opportunity.opportunity_score || opportunity.confidence || 0;',
    '        const confidence = opportunity.confidence || snapshotScore;',
    '        const noiseLabel = opportunity.noise != null ? opportunity.noise + "% crowding" : "Crowding unknown";',
    '        wedgeCard.innerHTML = `<h3>Activation Wedge: ${escapeHtml(opportunity.title)}</h3><div class="wedge-snapshot"><div class="snapshot-main"><span>Selected bet snapshot</span><strong>${escapeHtml(opportunity.title)}</strong><p>${escapeHtml(opportunity.thesis)}</p></div><div class="snapshot-stats"><div><strong>${snapshotScore}</strong><span>Opportunity score</span></div><div><strong>${confidence}%</strong><span>Evidence confidence</span></div><div><strong>${evidenceCount}</strong><span>Evidence items</span></div><div><strong>${escapeHtml(opportunity.horizon)}</strong><span>Horizon</span></div></div><div class="snapshot-meta"><span>${escapeHtml(opportunity.buyer)}</span><span>${escapeHtml(opportunity.region || regionSelect.value)}</span><span>${escapeHtml(noiseLabel)}</span><span>${escapeHtml(evidenceBrands || "Competitor signal")}</span></div></div><div class="wedge-grid"><div><strong>The opening</strong><span>${escapeHtml(opportunity.thesis)}</span></div><div><strong>Right to win</strong><span>${escapeHtml(opportunity.proof)}</span></div><div><strong>Cost to respond</strong><span>Competitors would need a broader B2B capability map and stronger trust-led payment proof.</span></div><div><strong>Buyer trigger</strong><span>${escapeHtml(opportunity.why)}</span></div><div><strong>Watchout</strong><span>${escapeHtml(opportunity.risk)}</span></div></div>`;'
  ].join('\n');
  text = text.slice(0, start) + replacement + text.slice(end + 2);
  return true;
}

replaceWedgeMarkup();

if (!text.includes('id="betMapImpact"')) {
  replaceAll(
    '              <article class="card">\n                <div class="card-header"><p class="eyebrow">Selected Map Standing</p><span class="helper" id="selectedOpportunityScore"></span></div>\n                <div class="detail-list" id="opportunityDetail"></div>\n              </article>\n              <article class="card" style="grid-column: 1 / -1;">',
    '              <article class="card">\n                <div class="card-header"><p class="eyebrow">Selected Map Standing</p><span class="helper" id="selectedOpportunityScore"></span></div>\n                <div class="detail-list" id="opportunityDetail"></div>\n              </article>\n              <article class="card">\n                <div class="card-header"><p class="eyebrow">Selected Bet Map Impact</p><span class="helper">Projected movement if activated</span></div>\n                <div class="detail-list bet-impact-panel" id="betMapImpact"></div>\n              </article>\n              <article class="card" style="grid-column: 1 / -1;">'
  );
}

if (!text.includes('const betMapImpact = document.querySelector("#betMapImpact");')) {
  replaceAll(
    '      const selectedOpportunityScore = document.querySelector("#selectedOpportunityScore");\n      const selectedBetSummary = document.querySelector("#selectedBetSummary");',
    '      const selectedOpportunityScore = document.querySelector("#selectedOpportunityScore");\n      const betMapImpact = document.querySelector("#betMapImpact");\n      const selectedBetSummary = document.querySelector("#selectedBetSummary");'
  );
}

if (!text.includes('function escapeHtml(value)')) {
  insertBefore(
    '      function currentData() {',
    '      function escapeHtml(value) {\n        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");\n      }\n\n',
    'escape html helper'
  );
}

const impactFunctions = [
  '      function clampMapValue(value, min, max) {',
  '        return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));',
  '      }',
  '',
  '      function betMapProjection() {',
  '        const data = currentData();',
  '        const opportunity = activeOpportunity();',
  '        const mastercard = (data.bubbles || []).find((bubble) => bubble.name === "Mastercard") || { x: 602, y: 116, r: 22 };',
  '        const fit = Number(opportunity.fit || opportunity.opportunity_score || 70);',
  '        const urgency = Number(opportunity.urgency || opportunity.confidence || 70);',
  '        const confidence = Number(opportunity.confidence || opportunity.opportunity_score || 70);',
  '        const noise = Number(opportunity.noise || 40);',
  '        const xLift = clampMapValue((fit - 50) * 0.9 + Math.max(0, 100 - noise) * 0.25, 14, 82);',
  '        const yLift = clampMapValue((urgency - 50) * 0.75 + (confidence - 50) * 0.28, 10, 74);',
  '        const toX = clampMapValue(mastercard.x + xLift, mastercard.x + 8, 694);',
  '        const toY = clampMapValue(mastercard.y - yLift, 54, mastercard.y - 6);',
  '        return { opportunity, mastercard, xLift, yLift, toX, toY, buyerMove: clampMapValue((xLift / 82) * 100, 0, 100), outcomeMove: clampMapValue((yLift / 74) * 100, 0, 100) };',
  '      }',
  '',
  '      function renderBetMapImpactOverlay() {',
  '        const projection = betMapProjection();',
  '        return `<g class="bet-impact-vector"><line x1="${projection.mastercard.x}" y1="${projection.mastercard.y}" x2="${projection.toX}" y2="${projection.toY}" stroke="#f37eb5" stroke-width="2.5" stroke-dasharray="5 4"/><circle cx="${projection.toX}" cy="${projection.toY}" r="15" fill="#df6aa7" fill-opacity="0.22" stroke="#f37eb5" stroke-width="2"/><text class="svg-label" x="${Math.min(650, projection.toX + 18)}" y="${Math.max(62, projection.toY - 8)}">Selected bet pull</text><text class="svg-small" x="${Math.min(650, projection.toX + 18)}" y="${Math.max(78, projection.toY + 8)}">+${projection.buyerMove}% buyer specificity / +${projection.outcomeMove}% outcome</text></g>`;',
  '      }',
  '',
  '      function renderBetMapImpact() {',
  '        if (!betMapImpact) return;',
  '        const projection = betMapProjection();',
  '        const opportunity = projection.opportunity;',
  '        const liftLabel = projection.outcomeMove >= 70 ? "strong pull toward the top-right" : projection.outcomeMove >= 45 ? "moderate pull toward the top-right" : "incremental pull toward the top-right";',
  '        betMapImpact.innerHTML = `<div class="impact-summary"><span>Selected ranked bet</span><strong>${escapeHtml(opportunity.title)}</strong><p>This bet creates a ${liftLabel}: it pushes Mastercard toward more specific buyer pain on the x-axis and a more outcome-led story on the y-axis.</p></div><div class="impact-metrics"><div><strong>+${projection.buyerMove}%</strong><span>Buyer specificity pull</span></div><div><strong>+${projection.outcomeMove}%</strong><span>Business outcome pull</span></div><div><strong>${opportunity.fit}</strong><span>Strategic fit</span></div><div><strong>${100 - Number(opportunity.noise || 0)}</strong><span>Whitespace headroom</span></div></div><div class="detail-item"><strong>Why it moves the map:</strong> ${escapeHtml(opportunity.why || opportunity.thesis)}</div><div class="detail-item"><strong>What would prove it:</strong> ${escapeHtml(opportunity.proof || "Evidence table, campaign proof and buyer validation.")}</div>`;',
  '      }',
  '',
].join('\n');

if (!text.includes('function betMapProjection()')) {
  insertBefore('      function renderMap(svg, large) {', impactFunctions, 'bet map impact functions');
}

replaceAll('          ${bubbles}`;', '          ${bubbles}${large ? renderBetMapImpactOverlay() : ""}`;');
replaceAll('        renderOpportunityDetail();\n        renderOpportunitySelect();', '        renderOpportunityDetail();\n        renderBetMapImpact();\n        renderOpportunitySelect();');

replaceAll(
  '.home-score-card .score-actions { order: 1; }\n      .home-score-card .stat-row { order: 2; }\n      .home-score-card .score-radar-panel { order: 3; }',
  '.home-score-card .score-actions { order: 1; }\n      .home-score-card .score-radar-panel { order: 2; }\n      .home-score-card .stat-row { order: 3; }'
);

insertBefore(
  '      @media (max-width: 1180px)',
  '      .home-score-card .score-actions { order: 1; }\n      .home-score-card .score-radar-panel { order: 2; }\n      .home-score-card .stat-row { order: 3; }\n      .wedge-card { align-content: start; }\n      .wedge-snapshot { background: rgba(255,255,255,0.045); border: 1px solid var(--line); border-radius: 10px; display: grid; gap: 12px; padding: 14px; }\n      .snapshot-main { display: grid; gap: 6px; }\n      .snapshot-main span, .impact-summary span { color: var(--pink-2); font-size: 10px; font-weight: 900; text-transform: uppercase; }\n      .snapshot-main strong, .impact-summary strong { color: var(--text); font-size: 18px; line-height: 1.2; }\n      .snapshot-main p, .impact-summary p { color: var(--muted); font-size: 12px; line-height: 1.38; margin: 0; }\n      .snapshot-stats, .impact-metrics { display: grid; gap: 8px; grid-template-columns: repeat(4, minmax(0, 1fr)); }\n      .snapshot-stats div, .impact-metrics div { background: rgba(0,0,0,0.14); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }\n      .snapshot-stats strong, .impact-metrics strong { color: var(--text); display: block; font-size: 18px; line-height: 1.1; }\n      .snapshot-stats span, .impact-metrics span { color: var(--quiet); display: block; font-size: 10px; line-height: 1.25; margin-top: 4px; }\n      .snapshot-meta { display: flex; flex-wrap: wrap; gap: 7px; }\n      .snapshot-meta span { background: rgba(255,255,255,0.055); border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 10px; padding: 5px 8px; }\n      .bet-impact-panel { gap: 10px; }\n      .impact-summary { background: rgba(223,106,167,0.08); border: 1px solid rgba(223,106,167,0.2); border-radius: 10px; display: grid; gap: 7px; padding: 12px; }\n      .bet-impact-vector .svg-small { fill: #f1c6dc; font-size: 10px; }\n',
  'wedge and map impact css'
);

fs.writeFileSync(path, text);
