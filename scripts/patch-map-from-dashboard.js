const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

function replaceAll(oldValue, newValue) {
  text = text.split(oldValue).join(newValue);
}

function replacePattern(pattern, replacement, label) {
  if (!pattern.test(text)) {
    console.log(`No ${label} patch target found.`);
    return;
  }
  text = text.replace(pattern, replacement);
  console.log(`Patched ${label}.`);
}

const wedgeVarBlock = [
  '        const evidenceBrands = Array.isArray(opportunity.distinct_brands) && opportunity.distinct_brands.length',
  '          ? opportunity.distinct_brands.join(", ")',
  '          : (Array.isArray(opportunity.supporting_evidence) ? [...new Set(opportunity.supporting_evidence.map((item) => item.brand).filter(Boolean))].slice(0, 4).join(", ") : "");',
  '        const evidenceCount = opportunity.source_count || (Array.isArray(opportunity.supporting_evidence) ? opportunity.supporting_evidence.length : 0);',
  '        const snapshotScore = opportunity.opportunity_score || opportunity.confidence || 0;',
  '        const confidence = opportunity.confidence || snapshotScore;',
  '        const noiseLabel = opportunity.noise != null ? opportunity.noise + "% crowding" : "Crowding unknown";'
].join('\n');

while (text.includes(wedgeVarBlock + '\n' + wedgeVarBlock)) {
  replaceAll(wedgeVarBlock + '\n' + wedgeVarBlock, wedgeVarBlock);
}

// Guard against the earlier matrix-title duplication issue as well.
replaceAll(
  'function renderMatrix(target) {      function renderMatrix(target) {',
  'function renderMatrix(target) {'
);

const topControlCss = `
      .dashboard-controls {
        align-items: end;
        gap: 12px;
      }

      .filter-note {
        color: var(--quiet);
        flex: 1 1 100%;
        font-size: 11px;
        line-height: 1.35;
        margin: 0;
        text-align: right;
      }

      .mini-field small {
        color: var(--quiet);
        font-size: 10px;
        line-height: 1.25;
        margin-top: -2px;
      }

      .dashboard-controls .mini-field {
        min-width: 170px;
      }
`;

if (!text.includes('.filter-note {')) {
  replaceAll(
    '      .filters option {\n        background: #111722;\n        color: var(--text);\n      }',
    '      .filters option {\n        background: #111722;\n        color: var(--text);\n      }\n' + topControlCss
  );
}

const dashboardControls = `              <div class="filters dashboard-controls">
                <p class="filter-note">Dashboard controls only: change the analysis lens, trend window and map confidence filter. Brief settings sit in the brief module.</p>
                <label class="mini-field">
                  <span>Dashboard lens</span>
                  <small>Changes the competitive landscape view</small>
                  <select id="focusSelect" aria-label="Dashboard lens">
                    <option value="b2b">B2B payments</option>
                    <option value="commercial">Commercial payments</option>
                    <option value="movement">Money movement</option>
                    <option value="openfinance">Open finance and AI</option>
                  </select>
                </label>
                <label class="mini-field">
                  <span>Trend window</span>
                  <small>Changes score movement context</small>
                  <select id="periodSelect" aria-label="Trend window"><option>Last 90 Days</option><option>Last 30 Days</option><option>Last 12 Months</option></select>
                </label>
                <label class="mini-field">
                  <span>Map confidence floor</span>
                  <small>Hides lower-confidence map bubbles</small>
                  <input id="confidenceFloor" aria-label="Map confidence floor" type="number" min="50" max="95" value="51" />
                </label>
                <button class="action-button" id="shareButton" type="button"><span id="shareLabel">Share</span></button>
              </div>`;

if (!text.includes('class="filters dashboard-controls"')) {
  replacePattern(
    /              <div class="filters">[\s\S]*?              <\/div>\n            <\/header>/,
    dashboardControls + '\n            </header>',
    'top dashboard controls'
  );
}

const regionField = '<label class="field"><span>Region for brief</span><select id="regionSelect" aria-label="Brief region"><option>Global</option><option>North America</option><option>Europe</option><option>Asia Pacific</option></select></label>';
if (!text.includes('id="regionSelect"')) {
  replaceAll(
    '<label class="field"><span>Audience</span><select id="briefAudience"><option>Head of Payments at an enterprise</option><option>VP Finance / Treasurer</option><option>Procurement / AP leader</option><option>Platform partnerships lead</option><option>Merchant acquiring leader</option></select></label>',
    '<label class="field"><span>Audience</span><select id="briefAudience"><option>Head of Payments at an enterprise</option><option>VP Finance / Treasurer</option><option>Procurement / AP leader</option><option>Platform partnerships lead</option><option>Merchant acquiring leader</option></select></label>' + regionField
  );
}

if (!text.includes('data-export-brief')) {
  replaceAll(
    '<div class="generate-row"><button class="generate-button" id="generateButton" type="button">Generate Brief</button><button class="secondary-button" id="copyButton" type="button">Copy Markdown</button></div>',
    '<div class="generate-row"><button class="generate-button" id="generateButton" type="button">Generate Brief</button><button class="secondary-button" id="copyButton" type="button">Copy Markdown</button><button class="secondary-button" data-export-brief type="button">Export Brief</button></div>'
  );
  replaceAll(
    '<div class="generate-row"><button class="generate-button" id="generateButtonDeep" type="button">Generate Brief</button><button class="secondary-button" id="copyButtonDeep" type="button">Copy Markdown</button></div>',
    '<div class="generate-row"><button class="generate-button" id="generateButtonDeep" type="button">Generate Brief</button><button class="secondary-button" id="copyButtonDeep" type="button">Copy Markdown</button><button class="secondary-button" data-export-brief type="button">Export Brief</button></div>'
  );
}

replaceAll(
  '      const exportButton = document.querySelector("#exportButton");',
  '      const exportButtons = document.querySelectorAll("[data-export-brief]");'
);

replaceAll(
  '      document.querySelector("#newReviewButton").addEventListener("click", () => setView("settings"));',
  '      const newReviewButton = document.querySelector("#newReviewButton");\n      if (newReviewButton) newReviewButton.addEventListener("click", () => setView("settings"));'
);

replaceAll(
  '      [buyerSelect, regionSelect, periodSelect, confidenceFloor, briefObjective, briefAudience, briefTone, briefPriority].forEach((element) => element.addEventListener("input", () => renderAll()));',
  '      [regionSelect, periodSelect, confidenceFloor, briefObjective, briefAudience, briefTone, briefPriority].filter(Boolean).forEach((element) => element.addEventListener("input", () => renderAll()));'
);

replaceAll(
  '      exportButton.addEventListener("click", () => downloadFile("mastercard-b2b-creative-brief.md", latestBrief));',
  '      exportButtons.forEach((button) => button.addEventListener("click", () => downloadFile("mastercard-b2b-creative-brief.md", latestBrief)));'
);

const radarControlCss = `
      .radar-control-panel {
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid var(--line);
        border-radius: 10px;
        display: grid;
        gap: 8px;
        margin-bottom: 10px;
        padding: 10px;
      }

      .radar-control-panel strong {
        color: var(--text);
        font-size: 12px;
      }

      .radar-control-panel .body-copy {
        margin: 0;
      }
`;

if (!text.includes('.radar-control-panel {')) {
  replaceAll(
    '      .matrix-scroll {\n        overflow-x: auto;\n      }',
    radarControlCss + '\n      .matrix-scroll {\n        overflow-x: auto;\n      }'
  );
}

const deepRadarControls = [
  '                  <svg class="radar-svg" id="radarChartDeep" viewBox="0 0 300 270" role="img" aria-label="Deep capability radar"></svg>',
  '                  <div class="radar-control-panel">',
  '                    <strong>Compare competitors</strong>',
  '                    <div class="toggle-row" id="competitorTogglesDeep"></div>',
  '                    <p class="body-copy">Mastercard stays fixed. Select or deselect competitor shapes to isolate the comparison.</p>',
  '                  </div>',
  '                  <div class="body-copy">The radar compares Mastercard and visible competitors on the same four inputs that create the competitiveness score: share of model, differentiation, buyer relevance and proof strength.</div>'
].join('\n');

if (!text.includes('id="competitorTogglesDeep"')) {
  replaceAll(
    '                  <svg class="radar-svg" id="radarChartDeep" viewBox="0 0 300 270" role="img" aria-label="Deep capability radar"></svg>\n                  <div class="body-copy">The radar compares Mastercard and visible competitors on the same four inputs that create the competitiveness score: share of model, differentiation, buyer relevance and proof strength.</div>',
    deepRadarControls
  );
}

if (!text.includes('competitorTogglesDeep = document.querySelector')) {
  replaceAll(
    '      const competitorToggles = document.querySelector("#competitorToggles");',
    '      const competitorToggles = document.querySelector("#competitorToggles");\n      const competitorTogglesDeep = document.querySelector("#competitorTogglesDeep");'
  );
}

const radarBlock = `      function radarDomainFor(valueSets) {
        const values = valueSets.flat().map(Number).filter(Number.isFinite);
        if (!values.length) return { min: 0, max: 100, label: "Absolute 0-100 scale" };
        const minRaw = Math.min(...values);
        const maxRaw = Math.max(...values);
        const center = (minRaw + maxRaw) / 2;
        const spread = Math.max(maxRaw - minRaw, 18);
        let min = Math.max(0, Math.floor(center - spread * 0.7 - 3));
        let max = Math.min(100, Math.ceil(center + spread * 0.7 + 3));
        if (max - min < 18) {
          min = Math.max(0, Math.floor(center - 9));
          max = Math.min(100, Math.ceil(center + 9));
        }
        if (min <= 5 && max >= 95) return { min: 0, max: 100, label: "Absolute 0-100 scale" };
        return { min, max, label: \`Zoomed scale \${min}-\${max}\` };
      }

      function scaleRadarValue(value, domain) {
        if (!domain || domain.max <= domain.min) return Number(value) || 0;
        const ratio = (Number(value) - domain.min) / (domain.max - domain.min);
        return Math.max(10, Math.min(100, 10 + ratio * 90));
      }

      function pointsFor(values, size, domain = null) {
        const cx = size / 2;
        const cy = size / 2 - 5;
        const maxR = size * 0.32;
        return values.map((value, index) => {
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;
          const scaledValue = domain ? scaleRadarValue(value, domain) : value;
          const r = (scaledValue / 100) * maxR;
          return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
        });
      }

      function polygon(points) {
        return points.map(([x, y]) => \`\${x.toFixed(1)},\${y.toFixed(1)}\`).join(" ");
      }

      function radarLabel(label) {
        const labels = {
          "Narrative depth when present": "Narrative depth",
          "Displacement resistance": "Displace risk",
          "Prompt outcome": "Outcome",
          "Message variation from category": "Message var.",
          "Product-offer coherence": "Offer coherence",
          "GTM distinctiveness": "GTM",
          "Innovation signal": "Innovation",
          "Pricing and packaging clarity": "Pricing",
          "Segmented messaging": "Segmented msg.",
          "Buyer pain fit": "Pain fit",
          "Content sophistication": "Content soph.",
          "User journey fit": "Journey",
          "Decision-stage coverage": "Stage coverage",
          "Demo and product proof": "Demo proof",
          "Content variation": "Content var.",
          "Evidence specificity": "Evidence spec.",
          "Third-party validation": "3rd-party"
        };
        return labels[label] || label;
      }

      function renderRadar(svg, size, forceOverview = false) {
        const activeCategory = forceOverview ? null : scoreModel.find((category) => category.key === activeRadarCategory && expandedCategories.has(category.key));
        const showingParents = !activeCategory;
        const dimensions = showingParents ? scoreModel.map((category) => ({ label: category.short })) : activeCategory.children;
        const rings = [25, 50, 75, 100].map((level) => \`<polygon points="\${polygon(pointsFor(Array(dimensions.length).fill(level), size))}" fill="none" stroke="rgba(255,255,255,0.08)"/>\`).join("");
        const axes = dimensions.map((dimension, index) => {
          const end = pointsFor(Array(dimensions.length).fill(100), size)[index];
          const label = pointsFor(Array(dimensions.length).fill(118), size)[index];
          return \`<line x1="\${size / 2}" y1="\${size / 2 - 5}" x2="\${end[0]}" y2="\${end[1]}" stroke="rgba(255,255,255,0.07)"/><text class="svg-small" x="\${label[0] - 24}" y="\${label[1] + 4}">\${radarLabel(dimension.label)}</text>\`;
        }).join("");
        const valuesFor = (brand) => showingParents ? categoryScoresFor(brand) : dimensions.map((dimension, index) => childScore(brand, activeCategory, index));
        const series = [["mastercard", valuesFor("mastercard")], ...Array.from(activeCompetitors).map((key) => [key, valuesFor(key)])];
        const domain = radarDomainFor(series.map(([, values]) => values));
        const overlays = series.map(([key, values]) => {
          const pts = polygon(pointsFor(values, size, domain));
          return \`<polygon points="\${pts}" fill="\${colors[key]}" fill-opacity="\${key === "mastercard" ? 0.2 : 0.065}" stroke="\${colors[key]}" stroke-width="\${key === "mastercard" ? 2.4 : 1.6}"/>\`;
        }).join("");
        const scaleNote = \`<text class="svg-small" x="\${size - 12}" y="\${size - 12}" text-anchor="end">\${domain.label}</text>\`;
        svg.setAttribute("viewBox", \`0 0 \${size} \${size}\`);
        svg.innerHTML = \`<rect width="\${size}" height="\${size}" rx="10" fill="rgba(255,255,255,0.025)"/>\${rings}\${axes}\${overlays}\${scaleNote}\`;
      }
`;

replacePattern(
  /      function pointsFor\(values, size\) \{[\s\S]*?      function renderToggleSet\(container\) \{/,
  radarBlock + `
      function renderToggleSet(container) {`,
  'zoomed comparison radar'
);

const compactRadarBlock = `      function compactRadarPoints(values, size, domain = null) {
        const cx = size / 2;
        const cy = size / 2 + 2;
        const maxR = size * 0.28;
        return values.map((value, index) => {
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;
          const scaledValue = domain ? scaleRadarValue(value, domain) : value;
          const r = (scaledValue / 100) * maxR;
          return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
        });
      }

      function renderCompactScoreRadar(svg) {
        if (!svg) return;
        const brand = ensureActiveScoreCompetitor();
        const size = 200;
        const masterValues = categoryScoresFor("mastercard");
        const selectedValues = categoryScoresFor(brand);
        const domain = radarDomainFor([masterValues, selectedValues]);
        const rings = [25, 50, 75, 100].map((level) => \`<polygon points="\${polygon(compactRadarPoints(Array(4).fill(level), size))}" fill="none" stroke="rgba(255,255,255,0.08)"/>\`).join("");
        const axisEnds = compactRadarPoints(Array(4).fill(100), size);
        const axes = axisEnds.map(([x, y]) => \`<line x1="100" y1="102" x2="\${x}" y2="\${y}" stroke="rgba(255,255,255,0.08)"/>\`).join("");
        const labels = [
          \`<text class="svg-small" x="100" y="26" text-anchor="middle">Share</text>\`,
          \`<text class="svg-small" x="174" y="106" text-anchor="middle">Difference</text>\`,
          \`<text class="svg-small" x="100" y="184" text-anchor="middle">Buyer fit</text>\`,
          \`<text class="svg-small" x="26" y="106" text-anchor="middle">Proof</text>\`
        ].join("");
        const selectedColor = colors[brand] || colors.visa;
        const masterPoly = polygon(compactRadarPoints(masterValues, size, domain));
        const selectedPoly = polygon(compactRadarPoints(selectedValues, size, domain));
        const overlays = [
          \`<polygon points="\${masterPoly}" fill="\${colors.mastercard}" fill-opacity="0.12" stroke="\${colors.mastercard}" stroke-width="1.5"/>\`,
          \`<polygon points="\${selectedPoly}" fill="\${selectedColor}" fill-opacity="0.24" stroke="\${selectedColor}" stroke-width="2.7"/>\`
        ].join("");
        const scaleNote = \`<text class="svg-small" x="188" y="192" text-anchor="end">\${domain.label}</text>\`;
        svg.setAttribute("viewBox", \`0 0 \${size} \${size}\`);
        svg.innerHTML = \`<rect width="\${size}" height="\${size}" rx="10" fill="rgba(255,255,255,0.025)"/>\${rings}\${axes}\${labels}\${overlays}\${scaleNote}\`;
      }
`;

replacePattern(
  /      function compactRadarPoints\(values, size\) \{[\s\S]*?      function renderToggles\(\) \{/,
  compactRadarBlock + `
      function renderToggles() {`,
  'compact zoomed competitor radar'
);

replacePattern(
  /      function renderToggles\(\) \{\n        renderToggleSet\(competitorToggles\);\n        renderScoreCompetitorToggles\(\);\n      \}/,
  `      function renderToggles() {
        renderToggleSet(competitorToggles);
        renderToggleSet(competitorTogglesDeep);
        renderScoreCompetitorToggles();
      }`,
  'deep radar competitor toggles'
);

fs.writeFileSync(path, text);
