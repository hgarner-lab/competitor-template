# Patched Mastercard Competitor Dashboard

This package contains your uploaded `index.html` patched to read from `data/dashboard.json`.

## What changed

- The dashboard now tries to load `data/dashboard.json` on page load.
- If the JSON exists, it updates the scorecard, radar/matrix values, whitespace topics, brief builder inputs, Evidence tab feed and recommendations.
- If the JSON is missing or broken, the page falls back to the original static sample data.
- The Evidence tab now shows live evidence and recommendations from the JSON file.
- The backend-style starter files are included: `data/sources.json`, `config/scoring-rubric.json`, `scripts/research-worker.js`, `memory/`, and `.github/workflows/weekly-research.yml`.

## Run locally on your Mac

From this folder:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Do not double-click `index.html`, because browser file rules can block `data/dashboard.json`.

## Run the research worker

```bash
npm install
npm run research
```

This updates:

```text
data/dashboard.json
memory/weekly-change-log.md
output/review-this-week.md
```

## First real test

1. Open `data/sources.json`.
2. Replace one placeholder URL for each brand with a real public product, campaign, customer, press or partner page.
3. Set those source entries to `"enabled": true`.
4. Run `npm run research`.
5. Refresh `http://localhost:8080` and check the Evidence tab.

## GitHub Pages

Copy the files into the root of your GitHub Pages repo, commit and push. The dashboard can remain static. The worker can be run manually through GitHub Actions first, then weekly later.
