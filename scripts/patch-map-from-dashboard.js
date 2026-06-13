const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

function replaceAll(oldValue, newValue) {
  text = text.split(oldValue).join(newValue);
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

fs.writeFileSync(path, text);
