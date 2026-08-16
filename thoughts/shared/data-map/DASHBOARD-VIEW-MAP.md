# Dashboard View Map — data model → surfaces

**Written 2026-08-16**, for the softened-Bauhaus dashboard shell rebuild (Pencil mock:
"CG Dashboard Shell — Softened Bauhaus"). Distils `CANONICAL-DATA-MAP.md` + `OPPORTUNITY-MAP.md`
into the thing the shell needs: which rail destination shows which data, backed by which objects,
with which mandatory guardrails. Every number below is VERIFIED in the census docs unless marked.

## The data model in one screen

Four spines meet on one key (`gs_entities`, 609,448 rows, reached by uuid stamp → ABN →
normalised name → place code). Nobody else in Australia joins any two of them.

| Spine | What it holds | Anchor objects | Health |
|---|---|---|---|
| **Money** | contracts + grants + donations + philanthropy | `austender_contracts` 824K · `justice_funding` 157K · `grantconnect_awards` 291K · `political_donations` 2.55M · `foundations` 11K | Rich but booby-trapped: three mandatory filters (below) |
| **Governance / people** | who sits on which boards | `person_roles` 340K · `mv_board_interlocks` 39.8K · `person_identities` 230K | Count-only rule for people; MAX_PLAUSIBLE_BOARDS cap stays |
| **Place** | where entities and money actually are | `postcode_geo` 12K · `mv_funding_by_lga` · LGA stamps reason-coded (`lga_source`) | 40.5K placements added Aug-09; ~28.5K unplaced-with-postcode, every row reason-coded |
| **Evidence** | what works | `alma_interventions` 2.1K · `alma_evidence` 631 · `alma_outcomes` 2.9K | Small but unique; 85% of yj-funded orgs have NO evidence link — that gap IS a view |

Weak fifth spine: **story/media** — 77 objects, 4,501 rows total. Do not design views that
depend on it carrying weight.

Not civic data at all: **29% of objects (237)** are ACT's private business systems (Xero, GHL,
email). The shell must never mix these into civic surfaces — separation at line one, not a filter.

## Rail destination → data backing

| Rail item | Backed by | State |
|---|---|---|
| **Dashboard** | stat tiles + 2–3 headline views from the list below | new — this build |
| **Search** | `/api/global-search` 9 lanes (slice D, shipped) | live |
| **Clarity** | 26-question registry, 17/19 answers running | live |
| **Themes** | `topics @>` GIN over justice_funding (hyphenated tags) | live pages |
| **Entities** | `gs_entities` + `entity_xref` (91.9% crosswalk) | live pages |
| **People** | `mv_board_interlocks` / `mv_person_influence` — **counts only, no $ rollups** | partial; person trio fixes pending |
| **Places** | Atlas steps 1–4 (layer registry w/ consent tiers) | live |
| **Reports** | `report-service.ts` snapshot-backed pages | live |
| **Saved views** | new object: named query + scope + filters, per user | new — this build |

## The view inventory (verified runnable, from OPPORTUNITY-MAP)

Ship-now views, each verified by an actually-run query. These are the candidates for dashboard
cards and the seed set for "saved views":

1. **Watchhouse tonight** — QLD watchhouse children, facility-level, ~daily. Self-contained.
   Caveat ships with it: person-observations, not distinct children; coverage starts 2026-04-28.
2. **Money vs evidence gap** — $ to orgs with no recorded evidence, by topic. The 85% headline.
3. **Interlocked boards** — orgs governed by multi-board people + public money held. Band by
   board_count, cap at 10 (nominee-block artefact above that).
4. **Charity contract survivability** — `mv_justice_charity_financial_health` (5.9K).
5. **ACCO share by theme/place** — the 11.5% headline, `is_community_controlled` × topic × LGA.
6. **Funding deserts** — `mv_funding_deserts` (grain is NOT unique per LGA — dedupe by name|state).
7. **Donor-contractors** — `mv_gs_donor_contractors`; donations filtered to `receipt_type='donation received'`.
8. **Remoteness allocation** — mv_funding_by_lga × SEIFA × remoteness (the mock's chart).
9. **Power concentration** — `mv_entity_power_index` top 1% hold 86.9% of $1.287T (entity-level
   only; person-level stays count-only).

## Guardrails that bind every view (non-negotiable)

- `justice_funding`: `measure_kind='grant'` AND `is_aggregate IS NOT TRUE` AND the
  aggregate-name blocklist — use `isRealRecipient()`/`themeMoney()` from
  `apps/web/src/lib/justice-money.ts`, never re-derive. Omission = 26% overstatement.
- `political_donations`: `receipt_type='donation received'` (89% of rows are not donations).
- Topic tags are hyphenated; tag-by-tag concatenation double-counts — dedupe by id.
- `NULLS LAST` on every amount ordering.
- Sentinels ship with cross-sections or the cross-section doesn't ship (the $121bn law-firm
  contract row exists; 29.4% of contract value sits in 13 rows).
- Drill-through from graph edges to `justice_funding` source rows is **100% broken**
  (`source_record_id` dead namespace) — views must query source tables, not `gs_relationships`,
  until the edge rebuild lands.
- Matview trust: `mv_funding_by_disadvantage` (1 row) and `mv_indigenous_funding_by_disadvantage`
  (0 rows) refresh garbage nightly; `mv_person_identity_influence_v2` (the corrected one) is NOT
  scheduled while superseded v1 is. Check before wiring any matview into a card.

## What "saved views" are (the new model object)

A saved view = `{name, destination, query params, colour}` pinned to the rail. The four in the
mock (Youth justice money · ACCO suppliers · Alice Springs · Power: top 1%) map to views 5, 5-by-
supplier, a place scope, and 9 above. Start as a typed registry in code (like the Atlas layer
registry) — user-created persistence can come later; the registry alone gets the UX.
