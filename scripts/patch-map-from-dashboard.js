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

replaceAll('function renderMatrix(target) {      function renderMatrix(target) {', 'function renderMatrix(target) {');
replaceAll('\n\n\n\n\n\n      .home-map-card', '\n\n      .home-map-card');
replaceAll('<article class="card home-matrix-card">', '<article class="card home-matrix-card" id="fullComparisonDetails">');

if (!text.includes('id="scoreModeCompact"')) {
  replaceOnce(
    '<div class="score-radar-top"><strong>Competitor shape</strong><span>Toggle competitors against Mastercard</span></div>\n                  <div class="toggle-row score-toggle-row" id="scoreCompetitorToggles"></div>\n                  <svg class="radar-svg score-radar-svg" id="scoreRadarChart" viewBox="0 0 220 220" role="img" aria-label="Compact competitor radar"></svg>',
    '<div class="score-radar-top"><strong>Competitor shape</strong><span>Overview radar</span></div>\n                  <div class="score-mode score-mode-compact" id="scoreModeCompact">\n                    <button class="is-active" data-mode="strategic" type="button">Strategic</button>\n                    <button data-mode="evidence" type="button">Evidence-backed</button>\n                    <button data-mode="adjusted" type="button">User-adjusted</button>\n                  </div>\n                  <div class="toggle-row score-toggle-row" id="scoreCompetitorToggles"></div>\n                  <svg class="radar-svg score-radar-svg" id="scoreRadarChart" viewBox="0 0 200 200" role="img" aria-label="Compact competitor radar"></svg>\n                  <button class="secondary-button score-detail-cta" id="scoreDetailsButton" type="button">Jump to full score details</button>',
    'compact radar controls'
  );
}

replaceAll('        if (scoreRadarChart) renderRadar(scoreRadarChart, 220);', '        if (scoreRadarChart) renderRadar(scoreRadarChart, 200, true);');
replaceAll('      function renderRadar(svg, size) {\n        const activeCategory = scoreModel.find((category) => category.key === activeRadarCategory && expandedCategories.has(category.key));', '      function renderRadar(svg, size, forceOverview = false) {\n        const activeCategory = forceOverview ? null : scoreModel.find((category) => category.key === activeRadarCategory && expandedCategories.has(category.key));');

if (!text.includes('const scoreDetailsButton = document.querySelector("#scoreDetailsButton");')) {
  replaceOnce(
    '      const scoreModeEl = document.querySelector("#scoreMode");\n',
    '      const scoreModeEl = document.querySelector("#scoreMode");\n      const scoreDetailsButton = document.querySelector("#scoreDetailsButton");\n      const fullComparisonDetails = document.querySelector("#fullComparisonDetails");\n',
    'score CTA selectors'
  );
}

replaceAll('      scoreModeEl.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { scoreMode = button.dataset.mode; scoreModeEl.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button)); renderAll(); }));', '      function syncScoreModeButtons() {\n        document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === scoreMode));\n      }\n      document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { scoreMode = button.dataset.mode; syncScoreModeButtons(); renderAll(); }));\n      if (scoreDetailsButton && fullComparisonDetails) scoreDetailsButton.addEventListener("click", () => {\n        setView("dashboard");\n        window.setTimeout(() => fullComparisonDetails.scrollIntoView({ behavior: "smooth", block: "start" }), 0);\n      });\n      syncScoreModeButtons();');

const cssStart = text.indexOf('\n      .home-map-card {');
const cssEnd = cssStart === -1 ? -1 : text.indexOf('\n      .opportunity-strip,', cssStart);
if (cssStart !== -1 && cssEnd !== -1) {
  const css = '\n\n      .home-map-card { grid-column: 1; grid-row: 1; }\n      .home-score-card { align-self: start; display: grid; gap: 14px; grid-column: 2; grid-row: 1; padding: 18px; }\n      .home-activation-card { display: grid; gap: 12px; grid-column: 1 / -1; grid-row: 2; grid-template-columns: minmax(300px, 0.72fr) minmax(0, 1.28fr); grid-template-rows: auto auto minmax(320px, 1fr) auto; }\n      .home-matrix-card { grid-column: 1 / -1; grid-row: 3; scroll-margin-top: 24px; }\n      .home-activation-card .card-header, .home-activation-card .generate-row { grid-column: 1 / -1; }\n      .home-activation-card .selected-bet-summary { grid-column: 1; grid-row: 2; }\n      .home-activation-card .wedge-card { grid-column: 1; grid-row: 3; }\n      .home-activation-card .brief-preview { align-self: stretch; grid-column: 2; grid-row: 2 / 4; height: 100%; max-height: none; min-height: 420px; }\n      .home-activation-card .wedge-grid { grid-template-columns: 1fr; }\n      .selected-bet-summary { background: rgba(223, 106, 167, 0.08); border: 1px solid rgba(223, 106, 167, 0.24); border-radius: 10px; display: grid; gap: 6px; margin-bottom: 0; padding: 12px; }\n      .selected-bet-summary span { color: var(--pink-2); font-size: 10px; font-weight: 900; text-transform: uppercase; }\n      .selected-bet-summary strong { color: var(--text); font-size: 15px; line-height: 1.25; }\n      .selected-bet-summary p, .selected-bet-summary small { color: var(--muted); font-size: 11px; line-height: 1.35; margin: 0; }\n      .selected-bet-summary small { color: var(--quiet); }\n      .bet-cta { color: #f5f7fb !important; font-size: 11px !important; font-weight: 800; margin-top: 2px; }\n      .home-score-card .card-header { margin-bottom: 0; }\n      .home-score-card .gauge-wrap { justify-items: center; margin-top: -6px; }\n      .home-score-card .gauge { height: 118px; width: 196px; }\n      .home-score-card .gauge-score { top: 38px; }\n      .home-score-card .gauge-score strong { font-size: 40px; }\n      .home-score-card .gauge-score span { font-size: 12px; margin-top: 4px; }\n      .home-score-card .gauge-copy { font-size: 12px; line-height: 1.38; margin: -20px 0 0; max-width: none; text-align: left; }\n      .home-score-card .score-context { gap: 8px; margin-bottom: 0; }\n      .home-score-card .score-context div { padding: 9px; }\n      .home-score-card .stat-row { border-top: 1px solid var(--line); display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding-top: 12px; }\n      .home-score-card .stat { background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-radius: 9px; display: grid; gap: 3px; min-height: auto; padding: 9px; text-align: left; }\n      .home-score-card .stat strong { font-size: 17px; }\n      .home-score-card .stat span, .home-score-card .stat em { font-size: 10px; line-height: 1.25; }\n      .home-score-card .score-actions { display: grid; gap: 8px; grid-template-columns: 1fr; }\n      .home-score-card .score-actions div { padding: 10px; }\n      .home-score-card .score-actions strong { font-size: 13px; }\n      .home-score-card .score-actions span { font-size: 11px; line-height: 1.35; }\n      .home-score-card .score-model { border: 1px solid var(--line); border-radius: 9px; display: grid; gap: 3px; margin: 0; padding: 10px; text-align: left; }\n      .home-score-card .score-model span { font-size: 11px; line-height: 1.35; }\n      .score-radar-panel { background: rgba(255,255,255,0.025); border: 1px solid var(--line); border-radius: 10px; display: grid; gap: 8px; padding: 12px; }\n      .score-radar-top { align-items: baseline; display: flex; gap: 8px; justify-content: space-between; }\n      .score-radar-top strong { font-size: 12px; }\n      .score-radar-top span { color: var(--quiet); font-size: 10px; }\n      .score-mode-compact { gap: 6px; margin-bottom: 0; }\n      .score-mode-compact button, .score-toggle-row button { font-size: 10px; min-height: 25px; padding: 0 8px; }\n      .score-toggle-row { gap: 6px; }\n      .score-radar-svg { margin: -2px auto 0; max-height: 190px; max-width: 210px; }\n      .score-radar-svg .tooltip-title { font-size: 10px; }\n      .score-radar-svg .svg-small { font-size: 9px; }\n      .score-detail-cta { justify-self: stretch; min-height: 34px; }\n      @media (max-width: 1180px) { .home-map-card, .home-activation-card, .home-score-card, .home-matrix-card { grid-column: auto; grid-row: auto; } .home-activation-card { grid-template-columns: 1fr; grid-template-rows: auto; } .home-activation-card .selected-bet-summary, .home-activation-card .wedge-card, .home-activation-card .brief-preview { grid-column: auto; grid-row: auto; } }\n';
  text = text.slice(0, cssStart) + css + text.slice(cssEnd);
}

fs.writeFileSync(path, text);
