# Agent run inputs

Drop recent agent outputs in this folder as `.json` files. The calibrated workflow will normalise them into `data/evidence-feed.json`, merge them into `data/dashboard.json`, and use them for ranked-bet expansion.

Each file can be:

- a single evidence object
- an array of evidence objects
- an object with `runs`, `results`, `items`, `evidence`, `findings`, or `signals`

Recommended object shape:

```json
{
  "run_id": "2026-06-13-competitor-pr-agent",
  "agent": "competitor-pr-agent",
  "brand": "Visa",
  "topic": "B2B payables",
  "source_url": "https://example.com/source",
  "source_title": "Source title",
  "source_type": "press_release",
  "published_at": "2026-06-10",
  "observed_at": "2026-06-13T09:00:00Z",
  "claim": "Short claim the agent found.",
  "evidence": "Short proof point or extracted summary.",
  "metrics": {
    "buyer_relevance": 72,
    "proof_strength": 81,
    "differentiation": 65,
    "share_of_model": 76
  },
  "confidence": 0.84,
  "dedupe_key": "visa|b2b-payables|https://example.com/source"
}
```

Fields that matter most:

- `brand`: competitor/client brand name used by the dashboard
- `topic`: ranked-bet or evidence theme
- `source_url` / `source_title` / `source_type`: provenance
- `claim` or `evidence`: proof text
- `observed_at`: freshness check; default window is 45 days
- `confidence`: 0-1 or 0-100 accepted
- `dedupe_key`: optional, but useful when several agents see the same item

The import script writes:

- `data/evidence-feed.json`
- `memory/evidence-ledger.json`
- `memory/source-health.json`
- `output/agent-ingestion-summary.md`
