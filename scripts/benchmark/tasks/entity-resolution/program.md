# Entity Resolution: Donor → Entity Matching

## Task

Match Australian political donation donor names to entities in the GrantScope entity graph (gs_entities table, ~80K entries).

## Current Approach

The resolver in `resolve.mjs` uses tiered matching:

1. **Exact match** (confidence 1.0) — case-insensitive canonical_name lookup
2. **Alias exact match** (confidence 0.95) — match against gs_entity_aliases
3. **Normalized match** (confidence 0.85) — strip legal suffixes (Pty, Ltd, etc.), trust structures, punctuation
4. **Alias normalized match** (confidence 0.80) — normalized alias comparison

## Entity Index Structure

The evaluator pre-loads and passes an `entityIndex` object:
- `byExact: Map<string, Entity>` — uppercase canonical_name → entity
- `byNormalized: Map<string, Entity>` — normalized name → entity
- `byAlias: Map<string, Entity>` — uppercase alias → entity

Each Entity has: `{ abn, canonical_name, entity_type, state }`

## Known Failure Modes

- **Abbreviated names:** "BHP" vs "BHP Group Limited"
- **Trust structures:** "Smith Family ATF Smith Discretionary Trust" — need to extract principal name
- **Political party branches:** "Liberal Party of Australia - Victorian Division" vs "Liberal Party of Australia"
- **Individuals as directors:** Donor "JOHN SMITH" who is a director of "Smith Holdings Pty Ltd"
- **Trading names vs registered names:** "Coles" vs "Coles Group Limited"
- **Franchisees vs parent companies:** Similar names, different ABNs
- **Acronyms:** "CFMEU" vs "Construction, Forestry and Maritime Employees Union"
- **Name variations with state:** "ANZ Bank" vs "Australia and New Zealand Banking Group Ltd"

## Constraints

- Must run WITHOUT LLM calls (evaluation needs to be fast, <10s for 1000 pairs)
- Entity index is pre-loaded in memory (~80K entries)
- Confidence must be 0-1 (1.0 = certain, 0.5 = unsure)
- The `resolve(donorName, entityIndex)` function signature must not change
- Return `{ matched_abn, matched_name, confidence, method }` or `null`

## Data Available

- `gs_entities`: canonical_name, abn, acn, entity_type, state, sector, tags
- `gs_entity_aliases`: alias_type, alias_value (multiple names per entity)
- `donor_entity_matches`: historical verified matches with match_method and confidence
- ~5,600 exact matches and ~750 normalized matches exist in production

## Improvement Ideas

- Add trigram similarity matching for near-misses (threshold tuning)
- Build abbreviation → full name mapping from known aliases
- Handle "THE" prefix more aggressively (e.g., "The Smith Family" → "Smith Family")
- Strip state/branch suffixes ("- Victorian Division", "(NSW)")
- Reverse word matching ("KNIGHT BENJAMIN" → "BENJAMIN KNIGHT")
- Token-set matching (all tokens present regardless of order)
- Prefix matching for long names truncated in donation records
- Use entity_type as a signal (individuals rarely match to companies)
