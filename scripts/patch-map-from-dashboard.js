const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

function replaceOnce(oldValue, newValue, label) {
  if (text.includes(newValue)) return;
  if (!text.includes(oldValue)) {
    throw new Error(`Could not find patch marker: ${label}`);
  }
  text = text.replace(oldValue, newValue);
}

function replaceText(oldValue, newValue) {
  text = text.split(oldValue).join(newValue);
}

function insertAfter(marker, value, label) {
  if (!text.includes(marker)) throw new Error(`Could not find insertion marker: ${label}`);
  text = text.replace(marker, marker + value);
}

replaceText('>Enterprise-cold</text>', '>Broad corporate jargon</text>');
replaceText('>Corporate</text>', '>Broad corporate jargon</text>');
replaceText('>Lower buyer relevance</text>', '>Broad corporate jargon</text>');
replaceText('>Human-warm</text>', '>Specific buyer pain</text>');
replaceText('>Human</text>', '>Specific buyer pain</text>');
replaceText('>Higher buyer relevance</text>', '>Specific buyer pain</text>');
replaceText('>Market communication style</text>', '>Broad corporate jargon ↔ Specific buyer pain</text>');
replaceText('>Corporate ↔ Human</text>', '>Broad corporate jargon ↔ Specific buyer pain</text>');
replaceText('>Buyer relevance + proof signal</text>', '>Broad corporate jargon ↔ Specific buyer pain</text>');
replaceText('>Market message posture</text>', '>Product capability ↔ Business outcome</text>');
replaceText('>Needs ↔ Features</text>', '>Product capability ↔ Business outcome</text>');
replaceText('>Calibrated competitive strength</text>', '>Product capability ↔ Business outcome</text>');
replaceText('>Friction-focused</text>', '>Product capability</text>');
replaceText('>Needs</text>', '>Product capability</text>');
replaceText('>Lower strength</text>', '>Product capability</text>');
replaceText('>Confidence-focused</text>', '>Business outcome</text>');
replaceText('>Features</text>', '>Business outcome</text>');
replaceText('>Higher strength</text>', '>Business outcome</text>');

replaceText(
  'const xScore = clampScore(metrics.buyer * 0.5 + metrics.proof * 0.3 + metrics.difference * 0.2);',
  'const xScore = clampScore(metrics.buyer * 0.65 + metrics.proof * 0.2 + metrics.difference * 0.15);'
);
replaceText(
  'yScore: score,',
  'yScore: clampScore(metrics.buyer * 0.4 + metrics.proof * 0.35 + metrics.share * 0.15 + metrics.difference * 0.1),'
);

replaceText(
  '<article class="card">\n                <div class="card-header"><p class="eyebrow">Whitespace Opportunity Map</p>',
  '<article class="card home-map-card">\n                <div class="card-header"><p class="eyebrow">Whitespace Opportunity Map</p>'
);
replaceText(
  '<article class="card">\n                <div class="card-header"><p class="eyebrow">Competitiveness Score</p><span class="helper">Current market strength</span></div>',
  '<article class="card home-score-card">\n                <div class="card-header"><p class="eyebrow">At-a-glance Score</p><span class="helper">How are we doing?</span></div>'
);
replaceText(
  '<article class="card">\n                <div class="card-header"><p class="eyebrow">At-a-glance Score</p><span class="helper">How are we doing?</span></div>',
  '<article class="card home-score-card">\n                <div class="card-header"><p class="eyebrow">At-a-glance Score</p><span class="helper">How are we doing?</span></div>'
);
replaceText(
  '<article class="card">\n                <div class="card-header"><p class="eyebrow">Competitor Comparison Matrix</p><span class="helper">Same data as score</span></div>',
  '<article class="card home-matrix-card">\n                <div class="card-header"><p class="eyebrow">Competitor Comparison Matrix</p><span class="helper">Detailed score inputs</span></div>'
);
replaceText(
  '<article class="card">\n                <div class="card-header"><p class="eyebrow">Creative Brief Builder</p><span class="helper">Turn a bet into action</span></div>',
  '<article class="card home-activation-card">\n                <div class="card-header"><p class="eyebrow">Activate Selected Bet</p><span class="helper">Brief generated from the selected ranked bet</span></div>'
);
replaceText(
  '<article class="card">\n                <div class="card-header"><p class="eyebrow">Activate Selected Bet</p><span class="helper">Brief generated from the selected ranked bet</span></div>',
  '<article class="card home-activation-card">\n                <div class="card-header"><p class="eyebrow">Activate Selected Bet</p><span class="helper">Brief generated from the selected ranked bet</span></div>'
);

if (!text.includes('id="selectedBetSummary"')) {
  replaceOnce(
    '                <div class="wedge-card" id="wedgeCard"></div>',
    '                <div class="selected-bet-summary" id="selectedBetSummary"></div>\n                <div class="wedge-card" id="wedgeCard"></div>',
    'selected bet summary panel'
  );
}

if (!text.includes('id="scoreRadarChart"')) {
  replaceOnce(
`                <div class="score-context">
                  <div><span id="scoreWindow">Last 90 Days</span><strong id="scoreTrend">+3 pts</strong></div>
                  <div><span>Industry average</span><strong id="industryAverage">68</strong></div>
                </div>
                <div class="stat-row">`,
`                <div class="score-context">
                  <div><span id="scoreWindow">Last 90 Days</span><strong id="scoreTrend">+3 pts</strong></div>
                  <div><span>Industry average</span><strong id="industryAverage">68</strong></div>
                </div>
                <div class="score-radar-panel">
                  <div class="score-radar-top"><strong>Competitor shape</strong><span>Toggle competitors against Mastercard</span></div>
                  <div class="toggle-row score-toggle-row" id="scoreCompetitorToggles"></div>
                  <svg class="radar-svg score-radar-svg" id="scoreRadarChart" viewBox="0 0 220 220" role="img" aria-label="Compact competitor radar"></svg>
                </div>
                <div class="stat-row">`,
    'compact score radar panel'
  );
}

const homeFlowCss = `

      .home-map-card {
        grid-column: 1;
        grid-row: 1;
      }

      .home-score-card {
        align-self: start;
        display: grid;
        gap: 12px;
        grid-column: 2;
        grid-row: 1;
        padding: 18px;
      }

      .home-activation-card {
        display: grid;
        gap: 12px;
        grid-column: 1 / -1;
        grid-row: 2;
        grid-template-columns: minmax(300px, 0.72fr) minmax(0, 1.28fr);
        grid-template-rows: auto auto minmax(320px, 1fr) auto;
      }

      .home-matrix-card {
        grid-column: 1 / -1;
        grid-row: 3;
      }

      .home-activation-card .card-header,
      .home-activation-card .generate-row {
        grid-column: 1 / -1;
      }

      .home-activation-card .selected-bet-summary {
        grid-column: 1;
        grid-row: 2;
      }

      .home-activation-card .wedge-card {
        grid-column: 1;
        grid-row: 3;
      }

      .home-activation-card .brief-preview {
        align-self: stretch;
        grid-column: 2;
        grid-row: 2 / 4;
        height: 100%;
        max-height: none;
        min-height: 420px;
      }

      .home-activation-card .wedge-grid {
        grid-template-columns: 1fr;
      }

      .selected-bet-summary {
        background: rgba(223, 106, 167, 0.08);
        border: 1px solid rgba(223, 106, 167, 0.24);
        border-radius: 10px;
        display: grid;
        gap: 6px;
        margin-bottom: 0;
        padding: 12px;
      }

      .selected-bet-summary span {
        color: var(--pink-2);
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .selected-bet-summary strong {
        color: var(--text);
        font-size: 15px;
        line-height: 1.25;
      }

      .selected-bet-summary p,
      .selected-bet-summary small {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
        margin: 0;
      }

      .selected-bet-summary small {
        color: var(--quiet);
      }

      .bet-cta {
        color: #f5f7fb !important;
        font-size: 11px !important;
        font-weight: 800;
        margin-top: 2px;
      }

      .home-score-card .card-header {
        margin-bottom: 0;
      }

      .home-score-card .gauge-wrap {
        justify-items: center;
        margin-top: -4px;
      }

      .home-score-card .gauge {
        height: 126px;
        width: 208px;
      }

      .home-score-card .gauge-score {
        top: 42px;
      }

      .home-score-card .gauge-score strong {
        font-size: 42px;
      }

      .home-score-card .gauge-score span {
        font-size: 12px;
        margin-top: 5px;
      }

      .home-score-card .gauge-copy {
        font-size: 12px;
        margin: -22px 0 0;
        max-width: none;
        text-align: left;
      }

      .home-score-card .stat-row,
      .home-score-card .score-model,
      .home-score-card .score-actions {
        display: none;
      }

      .home-score-card .score-context {
        margin-bottom: 0;
      }

      .home-score-card .score-context div {
        padding: 9px;
      }

      .score-radar-panel {
        border-top: 1px solid var(--line);
        display: grid;
        gap: 8px;
        padding-top: 12px;
      }

      .score-radar-top {
        align-items: baseline;
        display: flex;
        gap: 8px;
        justify-content: space-between;
      }

      .score-radar-top strong {
        font-size: 12px;
      }

      .score-radar-top span {
        color: var(--quiet);
        font-size: 10px;
      }

      .score-toggle-row {
        gap: 6px;
      }

      .score-toggle-row button {
        font-size: 10px;
        min-height: 25px;
        padding: 0 8px;
      }

      .score-radar-svg {
        margin: 0 auto;
        max-height: 230px;
        max-width: 245px;
      }

      @media (max-width: 1180px) {
        .home-map-card,
        .home-activation-card,
        .home-score-card,
        .home-matrix-card {
          grid-column: auto;
          grid-row: auto;
        }

        .home-activation-card {
          grid-template-columns: 1fr;
          grid-template-rows: auto;
        }

        .home-activation-card .selected-bet-summary,
        .home-activation-card .wedge-card,
        .home-activation-card .brief-preview {
          grid-column: auto;
          grid-row: auto;
        }
      }
`;

const homeStart = text.indexOf('\n      .home-map-card {');
const homeEnd = homeStart === -1 ? -1 : text.indexOf('\n      .opportunity-strip,', homeStart);
if (homeStart !== -1 && homeEnd !== -1) {
  text = text.slice(0, homeStart) + homeFlowCss + text.slice(homeEnd);
} else {
  insertAfter(
    '      .map-layout {\n        display: grid;\n        gap: 12px;\n      }\n',
    homeFlowCss,
    'home flow css'
  );
}

if (!text.includes('const selectedBetSummary = document.querySelector("#selectedBetSummary");')) {
  replaceOnce(
    '      const selectedOpportunityScore = document.querySelector("#selectedOpportunityScore");\n',
    '      const selectedOpportunityScore = document.querySelector("#selectedOpportunityScore");\n      const selectedBetSummary = document.querySelector("#selectedBetSummary");\n',
    'selected bet summary selector'
  );
}

if (!text.includes('const scoreRadarChart = document.querySelector("#scoreRadarChart");')) {
  replaceOnce(
    '      const radarChartDeep = document.querySelector("#radarChartDeep");\n',
    '      const radarChartDeep = document.querySelector("#radarChartDeep");\n      const scoreRadarChart = document.querySelector("#scoreRadarChart");\n      const scoreCompetitorToggles = document.querySelector("#scoreCompetitorToggles");\n',
    'score radar selectors'
  );
}

if (!text.includes('class="bet-cta"')) {
  replaceOnce(
    '            <span class="metric-grid">${metric("Fit", opportunity.fit)}${metric("Urgency", opportunity.urgency)}${metric("Crowding", opportunity.noise)}</span>\n          </button>`;',
    '            <span class="metric-grid">${metric("Fit", opportunity.fit)}${metric("Urgency", opportunity.urgency)}${metric("Crowding", opportunity.noise)}</span>\n            <span class="bet-cta">Use this bet for the brief -&gt;</span>\n          </button>`;',
    'ranked bet cta'
  );
}

if (!text.includes('selectedBetSummary.innerHTML')) {
  replaceOnce(
    '      function renderWedge() {\n        const opportunity = activeOpportunity();\n        wedgeCard.innerHTML =',
    '      function renderWedge() {\n        const opportunity = activeOpportunity();\n        if (selectedBetSummary) {\n          selectedBetSummary.innerHTML = `<span>Selected ranked bet</span><strong>${escapeHtml(opportunity.title)}</strong><p>${escapeHtml(opportunity.buyer)} | ${escapeHtml(opportunity.horizon)}</p><small>${escapeHtml(opportunity.thesis)}</small>`;\n        }\n        wedgeCard.innerHTML =',
    'selected bet summary renderer'
  );
}

if (!text.includes('function renderToggleSet(container)')) {
  replaceOnce(
`      function renderToggles() {
        competitorToggles.innerHTML = Object.keys(b2bScoreProfile).filter((key) => key !== "mastercard").map((key) => `<button class="${activeCompetitors.has(key) ? "is-active" : ""}" data-competitor="${key}" type="button">${brandNames[key]}</button>`).join("");
        competitorToggles.querySelectorAll("[data-competitor]").forEach((button) => {
          button.addEventListener("click", () => {
            if (activeCompetitors.has(button.dataset.competitor)) activeCompetitors.delete(button.dataset.competitor);
            else activeCompetitors.add(button.dataset.competitor);
            renderAll();
          });
        });
      }
`,
`      function renderToggleSet(container) {
        if (!container) return;
        container.innerHTML = Object.keys(b2bScoreProfile).filter((key) => key !== "mastercard").map((key) => `<button class="${activeCompetitors.has(key) ? "is-active" : ""}" data-competitor="${key}" type="button">${brandNames[key]}</button>`).join("");
        container.querySelectorAll("[data-competitor]").forEach((button) => {
          button.addEventListener("click", () => {
            if (activeCompetitors.has(button.dataset.competitor)) activeCompetitors.delete(button.dataset.competitor);
            else activeCompetitors.add(button.dataset.competitor);
            renderAll();
          });
        });
      }

      function renderToggles() {
        renderToggleSet(competitorToggles);
        renderToggleSet(scoreCompetitorToggles);
      }
`,
    'shared competitor toggle renderer'
  );
}

replaceText(
  '        renderRadar(radarChart, 260);\n        renderRadar(radarChartDeep, 300);',
  '        renderRadar(radarChart, 260);\n        if (scoreRadarChart) renderRadar(scoreRadarChart, 220);\n        renderRadar(radarChartDeep, 300);'
);

const helperMarker = '      function flattenEvidence(payload) {';
const helperCode = `      function scaleBetween(value, min, max, outMin, outMax) {
        const number = Number(value);
        if (!Number.isFinite(number)) return Math.round((outMin + outMax) / 2);
        if (min === max) return Math.round((outMin + outMax) / 2);
        const ratio = (number - min) / (max - min);
        return Math.round(outMin + ratio * (outMax - outMin));
      }

      function updateMapBubblePositions(payload) {
        const clientName = String(payload?.client_brand || "Mastercard").toLowerCase();
        const mappedBrands = (payload?.brand_scores || [])
          .filter((brand) => brand && brand.name)
          .map((brand) => {
            const metrics = normaliseDashboardMetrics(brand.metrics || {});
            const score = clampScore(brand.competitiveness_score);
            const xScore = clampScore(metrics.buyer * 0.65 + metrics.proof * 0.2 + metrics.difference * 0.15);
            return {
              name: brand.name,
              score,
              xScore,
              yScore: clampScore(metrics.buyer * 0.4 + metrics.proof * 0.35 + metrics.share * 0.15 + metrics.difference * 0.1),
              isClient: String(brand.name).toLowerCase() === clientName,
              claim: brand.summary || brand.name + " scored " + score + "/100 in the latest calibrated run.",
              evidence: Math.max(10, (brand.evidence || []).length * 8 + Math.round(score / 4))
            };
          });

        if (!mappedBrands.length) return;

        const xValues = mappedBrands.map((brand) => brand.xScore);
        const yValues = mappedBrands.map((brand) => brand.yScore);
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const ranked = [...mappedBrands].sort((a, b) => b.yScore - a.yScore || b.xScore - a.xScore || a.name.localeCompare(b.name));

        ranked.forEach((brand, index) => {
          const x = scaleBetween(brand.xScore, xMin, xMax, 185, 615);
          const baseY = scaleBetween(brand.yScore, yMin, yMax, 248, 92);
          const tieNudge = ((index % 3) - 1) * 7;
          const y = Math.max(62, Math.min(278, baseY + tieNudge));
          const labelLeft = index % 2 === 1;
          const bubbleUpdate = {
            name: brand.name,
            x,
            y,
            r: Math.max(13, Math.min(22, Math.round(8 + brand.score / 7))),
            lx: Math.max(92, Math.min(674, x + (labelLeft ? -92 : 26))),
            ly: Math.max(54, Math.min(306, y + ((index % 3) - 1) * 18 + 8)),
            type: brand.isClient ? "client" : "competitor",
            claim: brand.claim,
            evidence: brand.evidence,
            confidence: Math.max(40, brand.score)
          };

          ["b2b", "commercial", "movement", "openfinance"].forEach((segment) => {
            const data = segmentData[segment];
            if (!data) return;
            data.bubbles = data.bubbles || [];
            let bubble = data.bubbles.find((item) => item.name === brand.name);
            if (!bubble) {
              bubble = { ...bubbleUpdate };
              data.bubbles.push(bubble);
            } else {
              Object.assign(bubble, bubbleUpdate);
            }
          });
        });
      }

`;

if (!text.includes('function updateMapBubblePositions(payload)')) {
  const markerIndex = text.indexOf(helperMarker);
  if (markerIndex === -1) throw new Error('Could not find map helper insertion point');
  text = text.slice(0, markerIndex) + helperCode + text.slice(markerIndex);
}

replaceOnce(
`        updateBrandScores(payload);
        updateSegmentSummary(payload);
        updateWhitespace(payload);
`,
`        updateBrandScores(payload);
        updateMapBubblePositions(payload);
        updateSegmentSummary(payload);
        updateWhitespace(payload);
`,
'apply external dashboard map positions'
);

fs.writeFileSync(path, text);
