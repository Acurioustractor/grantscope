# Recipient-Entity Matching (Cross-Platform)

## Task
Match justice funding recipient names (from JusticeHub `justice_funding` table) to entities
in the GrantScope entity graph (`gs_entities`).

This is the same entity resolution problem as donor matching, but across platforms.
Recipients may be listed by different name variants, abbreviations, or trading names.

## Ground Truth
Justice funding records where `recipient_abn` is present AND matches a `gs_entities.abn`.
These are confirmed matches we can use to evaluate name-based matching accuracy.

## Input
```json
{
  "recipient_name": "Youth Advocacy Centre Inc",
  "recipient_abn": "12345678901",
  "state": "QLD",
  "sector": "youth_justice"
}
```

## Expected Output
```json
{
  "matched_abn": "12345678901",
  "matched_name": "Youth Advocacy Centre Incorporated",
  "confidence": "high",
  "method": "normalized_match"
}
```

## Metric
- Precision: correct matches / total matches returned
- Recall: correct matches / total matchable records
- F1: harmonic mean of precision and recall

Same scoring methodology as entity-resolution task.

## Why This Matters
Cross-platform matching directly powers the entity dossier justice funding section.
Better matching = more complete dossiers = more value for paying users.
