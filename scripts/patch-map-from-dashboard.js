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

replaceAll(
  'svg.innerHTML = `<rect width="${size}" height="${size}" rx="10" fill="rgba(255,255,255,0.025)"/><text class="tooltip-title" x="12" y="22">${showingParents ? "Competitiveness pillars" : `${activeCategory.label} sub-metrics`}</text>${rings}${axes}${overlays}`;',
  'svg.innerHTML = `<rect width="${size}" height="${size}" rx="10" fill="rgba(255,255,255,0.025)"/>${rings}${axes}${overlays}`;'
);

replaceAll(
  'wedgeCard.innerHTML = `<h3>Activation Wedge: ${opportunity.title}</h3><span class="score-pill">Evidenced / ${opportunity.confidence}% confidence</span><div class="wedge-grid">',
  'wedgeCard.innerHTML = `<h3>Activation Wedge: ${opportunity.title}</h3><span class="score-pill evidence-confidence">Evidence confidence: ${opportunity.confidence}%</span><div class="wedge-grid">'
);

insertBefore(
  '      @media (max-width: 1180px)',
  '      .radar-svg .tooltip-title { display: none !important; }\n      .home-score-card .score-actions { order: 1; }\n      .home-score-card .stat-row { order: 2; }\n      .home-score-card .score-radar-panel { order: 3; }\n      .home-score-card .score-model { display: none !important; }\n      .wedge-card .score-pill.evidence-confidence { background: rgba(255,255,255,0.045); border-color: var(--line); border-radius: 8px; color: var(--muted); font-weight: 700; padding: 4px 8px; }\n',
  'radar and at-a-glance cleanup css'
);

fs.writeFileSync(path, text);
