# Foundation Description Generation

## Task
Given a foundation's name, ABN, ACNC data (revenue, assets, charity size, beneficiary groups),
and any grant programs they run — generate a 2-4 sentence description of the foundation.

## Ground Truth
Top 160 foundations that already have enriched descriptions in `gs_entities.description`.
These were manually reviewed or LLM-enriched from foundation websites.

## Input
```json
{
  "canonical_name": "The Ian Potter Foundation",
  "abn": "12345678901",
  "acnc": {
    "total_revenue": 50000000,
    "total_assets": 1000000000,
    "charity_size": "Large",
    "staff_fte": 25
  },
  "grant_programs": ["Arts", "Environment", "Health & Disability"],
  "state": "VIC"
}
```

## Expected Output
A 2-4 sentence description that captures:
- What the foundation does (grantmaking focus areas)
- Scale (size indicators)
- Geographic focus (if any)

## Metric
Semantic similarity between generated description and ground truth.
Using simple word overlap (Jaccard) as a baseline, with option to upgrade to embedding cosine similarity.

## Scoring
- Score >= 0.5: PASS (captures main themes)
- Score >= 0.7: GOOD (accurate and comprehensive)
- Score >= 0.9: EXCELLENT (near-identical to ground truth)
