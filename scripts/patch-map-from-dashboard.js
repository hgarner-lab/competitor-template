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
replaceAll(
  '.home-score-card .score-actions { order: 1; }\n      .home-score-card .stat-row { order: 2; }\n      .home-score-card .score-radar-panel { order: 3; }',
  '.home-score-card .score-actions { order: 1; }\n      .home-score-card .score-radar-panel { order: 2; }\n      .home-score-card .stat-row { order: 3; }'
);

insertBefore(
  '      @media (max-width: 1180px)',
  '      .home-score-card .score-actions { order: 1; }\n      .home-score-card .score-radar-panel { order: 2; }\n      .home-score-card .stat-row { order: 3; }\n      .wedge-card { align-content: start; }\n      .wedge-snapshot { background: rgba(255,255,255,0.045); border: 1px solid var(--line); border-radius: 10px; display: grid; gap: 12px; padding: 14px; }\n      .snapshot-main { display: grid; gap: 6px; }\n      .snapshot-main span { color: var(--pink-2); font-size: 10px; font-weight: 900; text-transform: uppercase; }\n      .snapshot-main strong { color: var(--text); font-size: 18px; line-height: 1.2; }\n      .snapshot-main p { color: var(--muted); font-size: 12px; line-height: 1.38; margin: 0; }\n      .snapshot-stats { display: grid; gap: 8px; grid-template-columns: repeat(4, minmax(0, 1fr)); }\n      .snapshot-stats div { background: rgba(0,0,0,0.14); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }\n      .snapshot-stats strong { color: var(--text); display: block; font-size: 18px; line-height: 1.1; }\n      .snapshot-stats span { color: var(--quiet); display: block; font-size: 10px; line-height: 1.25; margin-top: 4px; }\n      .snapshot-meta { display: flex; flex-wrap: wrap; gap: 7px; }\n      .snapshot-meta span { background: rgba(255,255,255,0.055); border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 10px; padding: 5px 8px; }\n',
  'wedge snapshot css'
);

fs.writeFileSync(path, text);
