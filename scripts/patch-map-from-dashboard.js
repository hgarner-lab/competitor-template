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
    /\s*<div class="filters">[\s\S]*?<button class="action-button primary-action" id="exportButton" type="button">Export Brief<\/button>\n\s*<\/div>/,
    '\n' + dashboardControls,
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

const betActionCss = `
      .bet-action {
        background: rgba(101, 115, 236, 0.12);
        border: 1px solid rgba(101, 115, 236, 0.28);
        border-radius: 9px;
        color: #dce3ee !important;
        display: block;
        font-size: 12px !important;
        line-height: 1.35 !important;
        padding: 9px 10px;
      }

      .bet-action strong {
        color: #ffffff;
        display: block;
        font-size: 10px;
        letter-spacing: 0.03em;
        margin-bottom: 3px;
        text-transform: uppercase;
      }
`;

if (!text.includes('.bet-action {')) {
  replaceAll(
    '      .bet-card p {\n        font-size: 12px;\n      }',
    '      .bet-card p {\n        font-size: 12px;\n      }\n' + betActionCss
  );
}

if (!text.includes('function opportunityActionLine')) {
  replaceAll(
    '      function renderOpportunityCards() {',
    `      function opportunityActionLine(opportunity) {
        return opportunity.opportunity_line || opportunity.move || opportunity.activation_idea || \`Build a buyer-facing proof story for \${String(opportunity.title || "this opportunity").toLowerCase()} that gives \${String(opportunity.buyer || "the buyer").toLowerCase()} a clear reason to act.\`;
      }

      function renderOpportunityCards() {`
  );
}

if (!text.includes('class="bet-action"')) {
  replaceAll(
    '            <p>${opportunity.thesis}</p>\n            <span class="bet-meta">',
    '            <p>${opportunity.thesis}</p>\n            <span class="bet-action"><strong>Opportunity</strong>${escapeHtml(opportunityActionLine(opportunity))}</span>\n            <span class="bet-meta">'
  );
}

replaceAll(
  'selectedBetSummary.innerHTML = `<span>Selected ranked bet</span><strong>${escapeHtml(opportunity.title)}</strong><p>${escapeHtml(opportunity.buyer)} | ${escapeHtml(opportunity.horizon)}</p><small>${escapeHtml(opportunity.thesis)}</small>`;',
  'selectedBetSummary.innerHTML = `<span>Selected ranked bet</span><strong>${escapeHtml(opportunity.title)}</strong><p>${escapeHtml(opportunity.buyer)} | ${escapeHtml(opportunity.horizon)}</p><small>${escapeHtml(opportunity.thesis)}</small><small><strong>Opportunity:</strong> ${escapeHtml(opportunityActionLine(opportunity))}</small>`;'
);

replaceAll(
  '<div class="wedge-grid"><div><strong>The opening</strong><span>${escapeHtml(opportunity.thesis)}</span></div>',
  '<div class="wedge-grid"><div><strong>Action to take</strong><span>${escapeHtml(opportunityActionLine(opportunity))}</span></div><div><strong>The opening</strong><span>${escapeHtml(opportunity.thesis)}</span></div>'
);

replaceAll(
  '## Opportunity to action\n${opportunity.thesis}',
  '## Opportunity to action\n${opportunityActionLine(opportunity)}\n\n## Why this bet exists\n${opportunity.thesis}'
);

fs.writeFileSync(path, text);
