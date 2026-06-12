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
