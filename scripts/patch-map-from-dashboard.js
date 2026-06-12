const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

function replaceAll(oldValue, newValue) {
  text = text.split(oldValue).join(newValue);
}

function replaceOnce(oldValue, newValue, label) {
  if (text.includes(newValue)) return true;
  const index = text.indexOf(oldValue);
  if (index === -1) {
    console.warn('Skipped ' + label + ': marker not found');
    return false;
  }
  text = text.slice(0, index) + newValue + text.slice(index + oldValue.length);
  return true;
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

replaceAll('function renderMatrix(target) {      function renderMatrix(target) {', 'function renderMatrix(target) {');
replaceAll('\n\n\n\n\n\n      .home-map-card', '\n\n      .home-map-card');
replaceAll('<article class="card home-matrix-card">', '<article class="card home-matrix-card" id="fullComparisonDetails">');

if (!text.includes('id="scoreRadarSubtitle"')) {
  replaceAll(
    '<div class="score-radar-top"><strong>Competitor shape</strong><span>Overview radar</span></div>',
    '<div class="score-radar-top"><strong>Competitor shape</strong><span id="scoreRadarSubtitle">Visa vs Mastercard</span></div>'
  );
}

if (!text.includes('let activeScoreCompetitor =')) {
  replaceOnce(
    '      const activeCompetitors = new Set(["visa", "stripe", "adyen", "paypal", "fiserv"]);\n      const expandedCategories = new Set(["share"]);',
    '      const activeCompetitors = new Set(["visa", "stripe", "adyen", "paypal", "fiserv"]);\n      let activeScoreCompetitor = "visa";\n      const expandedCategories = new Set(["share"]);',
    'active compact competitor state'
  );
}

if (!text.includes('const scoreRadarSubtitle = document.querySelector("#scoreRadarSubtitle");')) {
  replaceOnce(
    '      const scoreRadarChart = document.querySelector("#scoreRadarChart");\n      const scoreCompetitorToggles = document.querySelector("#scoreCompetitorToggles");',
    '      const scoreRadarChart = document.querySelector("#scoreRadarChart");\n      const scoreRadarSubtitle = document.querySelector("#scoreRadarSubtitle");\n      const scoreCompetitorToggles = document.querySelector("#scoreCompetitorToggles");',
    'compact radar subtitle selector'
  );
}

const detailsHelpers = [
  '      function compactCompetitorKeys() {',
  '        const keys = Object.keys(b2bScoreProfile).filter((key) => key !== "mastercard");',
  '        return keys.length ? keys : ["visa", "stripe", "adyen", "paypal", "fiserv"];',
  '      }',
  '',
  '      function ensureActiveScoreCompetitor() {',
  '        const keys = compactCompetitorKeys();',
  '        if (!keys.includes(activeScoreCompetitor)) activeScoreCompetitor = keys[0];',
  '        return activeScoreCompetitor;',
  '      }',
  '',
  '      function renderScoreCompetitorToggles() {',
  '        if (!scoreCompetitorToggles) return;',
  '        const selected = ensureActiveScoreCompetitor();',
  '        scoreCompetitorToggles.innerHTML = compactCompetitorKeys().map((key) => `<button class="${selected === key ? "is-active" : ""}" data-score-competitor="${key}" type="button">${brandNames[key] || key}</button>`).join("");',
  '        scoreCompetitorToggles.querySelectorAll("[data-score-competitor]").forEach((button) => {',
  '          button.addEventListener("click", () => {',
  '            activeScoreCompetitor = button.dataset.scoreCompetitor;',
  '            renderAll();',
  '          });',
  '        });',
  '      }',
  '',
  '      function renderCompactScoreDetails() {',
  '        const brand = ensureActiveScoreCompetitor();',
  '        const values = categoryScoresFor(brand);',
  '        const metricDetails = allMetricDetails(brand);',
  '        const strongest = [...metricDetails].sort((a, b) => b.value - a.value).slice(0, 3);',
  '        const weakest = [...metricDetails].sort((a, b) => a.value - b.value).slice(0, 3);',
  '        if (scoreRadarSubtitle) scoreRadarSubtitle.textContent = `${brandNames[brand] || brand} vs Mastercard`;',
  '        dataCoverage.textContent = `${formatScore(values[0])}%`;',
  '        signalConsistency.textContent = `${formatScore(values[1])}%`;',
  '        sourceQuality.textContent = `${formatScore(values[2])}%`;',
  '        recency.textContent = `${formatScore(values[3])}%`;',
  '        doingWell.innerHTML = metricList(strongest);',
  '        needsImproving.innerHTML = metricList(weakest);',
  '      }',
  '',
].join('\n');

if (!text.includes('function renderScoreCompetitorToggles()')) {
  insertBefore('      function renderToggles() {', detailsHelpers, 'compact competitor helpers');
}

const radarHelpers = [
  '      function compactRadarPoints(values, size) {',
  '        const cx = size / 2;',
  '        const cy = size / 2 + 2;',
  '        const maxR = size * 0.28;',
  '        return values.map((value, index) => {',
  '          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;',
  '          const r = (value / 100) * maxR;',
  '          return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];',
  '        });',
  '      }',
  '',
  '      function renderCompactScoreRadar(svg) {',
  '        if (!svg) return;',
  '        const brand = ensureActiveScoreCompetitor();',
  '        const size = 200;',
  '        const masterValues = categoryScoresFor("mastercard");',
  '        const selectedValues = categoryScoresFor(brand);',
  '        const rings = [25, 50, 75, 100].map((level) => `<polygon points="${polygon(compactRadarPoints(Array(4).fill(level), size))}" fill="none" stroke="rgba(255,255,255,0.08)"/>`).join("");',
  '        const axisEnds = compactRadarPoints(Array(4).fill(100), size);',
  '        const axes = axisEnds.map(([x, y]) => `<line x1="100" y1="102" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.08)"/>`).join("");',
  '        const labels = [',
  '          `<text class="svg-small" x="100" y="26" text-anchor="middle">Share</text>`,',
  '          `<text class="svg-small" x="174" y="106" text-anchor="middle">Difference</text>`,',
  '          `<text class="svg-small" x="100" y="184" text-anchor="middle">Buyer fit</text>`,',
  '          `<text class="svg-small" x="26" y="106" text-anchor="middle">Proof</text>`',
  '        ].join("");',
  '        const selectedColor = colors[brand] || colors.visa;',
  '        const masterPoly = polygon(compactRadarPoints(masterValues, size));',
  '        const selectedPoly = polygon(compactRadarPoints(selectedValues, size));',
  '        const overlays = [',
  '          `<polygon points="${masterPoly}" fill="${colors.mastercard}" fill-opacity="0.12" stroke="${colors.mastercard}" stroke-width="1.4"/>`,',
  '          `<polygon points="${selectedPoly}" fill="${selectedColor}" fill-opacity="0.22" stroke="${selectedColor}" stroke-width="2.5"/>`',
  '        ].join("");',
  '        svg.setAttribute("viewBox", `0 0 ${size} ${size}`);',
  '        svg.innerHTML = `<rect width="${size}" height="${size}" rx="10" fill="rgba(255,255,255,0.025)"/>${rings}${axes}${labels}${overlays}`;',
  '      }',
  '',
].join('\n');

if (!text.includes('function renderCompactScoreRadar(svg)')) {
  insertBefore('      function renderToggles() {', radarHelpers, 'compact score radar helper');
}

replaceAll(
  '      function renderToggles() {\n        renderToggleSet(competitorToggles);\n        renderToggleSet(scoreCompetitorToggles);\n      }',
  '      function renderToggles() {\n        renderToggleSet(competitorToggles);\n        renderScoreCompetitorToggles();\n      }'
);
replaceAll('        if (scoreRadarChart) renderRadar(scoreRadarChart, 220);', '        renderCompactScoreRadar(scoreRadarChart);');
replaceAll('        if (scoreRadarChart) renderRadar(scoreRadarChart, 200, true);', '        renderCompactScoreRadar(scoreRadarChart);');
replaceAll('        renderToggles();\n        renderMatrix(matrixBody);', '        renderToggles();\n        renderCompactScoreDetails();\n        renderMatrix(matrixBody);');

insertBefore(
  '      @media (max-width: 1180px)',
  '      .home-score-card .score-model { display: none !important; }\n      .score-radar-svg .tooltip-title { display: none; }\n',
  'hide top model and radar title'
);

fs.writeFileSync(path, text);
