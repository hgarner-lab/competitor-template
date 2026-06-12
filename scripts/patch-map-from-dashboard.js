const fs = require('fs');

const path = 'index.html';
let text = fs.readFileSync(path, 'utf8');

const before = '.home-score-card .score-actions { order: 1; }\n      .home-score-card .stat-row { order: 2; }\n      .home-score-card .score-radar-panel { order: 3; }';
const after = '.home-score-card .score-actions { order: 1; }\n      .home-score-card .score-radar-panel { order: 2; }\n      .home-score-card .stat-row { order: 3; }';
text = text.split(before).join(after);

const marker = '      @media (max-width: 1180px)';
const fallback = '      .home-score-card .score-actions { order: 1; }\n      .home-score-card .score-radar-panel { order: 2; }\n      .home-score-card .stat-row { order: 3; }\n';
if (!text.includes(after) && text.includes(marker)) {
  text = text.replace(marker, fallback + marker);
}

fs.writeFileSync(path, text);
