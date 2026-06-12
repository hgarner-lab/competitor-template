const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

function replaceAll(oldValue, newValue) {
  text = text.split(oldValue).join(newValue);
}

// Repair a duplicate function header introduced by a previous layout patch.
// This duplicate stops the render chain, leaving the layout present but the dynamic content blank.
replaceAll(
  'function renderMatrix(target) {      function renderMatrix(target) {',
  'function renderMatrix(target) {'
);

// Keep whitespace tidy around the injected home-layout CSS. This is presentational only.
replaceAll('\n\n\n\n\n\n      .home-map-card', '\n\n      .home-map-card');

fs.writeFileSync(path, text);
