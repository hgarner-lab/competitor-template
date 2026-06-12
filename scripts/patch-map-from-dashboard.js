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
replaceAll('<article class="card home-matrix-card">', '<article class="card home-matrix-card" id="fullComparisonDetails">');
replaceAll('<div class="score-radar-top"><strong>Competitor shape</strong><span>Overview radar</span></div>', '<div class="score-radar-top"><strong>Competitor shape</strong><span id="scoreRadarSubtitle">Visa vs Mastercard</span></div>');

if (!text.includes('let activeScoreCompetitor =')) {
  replaceOnce('      const activeCompetitors = new Set(["visa", "stripe", "adyen", "paypal", "fiserv"]);\n      const expandedCategories = new Set(["share"]);', '      const activeCompetitors = new Set(["visa", "stripe", "adyen", "paypal", "fiserv"]);\n      let activeScoreCompetitor = "visa";\n      const expandedCategories = new Set(["share"]);', 'active compact competitor state');
}

if (!text.includes('const scoreRadarSubtitle = document.querySelector("#scoreRadarSubtitle");')) {
  replaceOnce('      const scoreRadarChart = document.querySelector("#scoreRadarChart");\n      const scoreCompetitorToggles = document.querySelector("#scoreCompetitorToggles");', '      const scoreRadarChart = document.querySelector("#scoreRadarChart");\n      const scoreRadarSubtitle = document.querySelector("#scoreRadarSubtitle");\n      const scoreCompetitorToggles = document.querySelector("#scoreCompetitorToggles");', 'compact radar subtitle selector');
}

const helpers = [
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
  insertBefore('      function renderToggles() {', helpers, 'compact competitor helpers');
}

replaceAll('      function renderToggles() {\n        renderToggleSet(competitorToggles);\n        renderToggleSet(scoreCompetitorToggles);\n      }', '      function renderToggles() {\n        renderToggleSet(competitorToggles);\n        renderScoreCompetitorToggles();\n      }');
replaceAll('        renderToggles();\n        renderMatrix(matrixBody);', '        renderToggles();\n        renderCompactScoreDetails();\n        renderMatrix(matrixBody);');

insertBefore('      @media (max-width: 1180px)', '      .home-score-card .score-model { display: none !important; }\n', 'hide top model');

fs.writeFileSync(path, text);
