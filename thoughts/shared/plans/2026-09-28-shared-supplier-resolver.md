# One supplier resolver for every procurement source

**Status:** plan, 2026-09-28. Nothing built beyond WA v2 (`20260928090000_wa_supplier_resolver_abr.sql`, unapplied).
**Why:** WA got its own resolver in a week. Every other state would repeat it, and the decisions a human makes (Integrity Staffing is Agility Staffing Pty Ltd, 278 lines) would be made again per state.

## What the data looks like now (measured 2026-09-28, `state_tenders`)

| source | rows | publishes ABN | linked to entity |
|---|---|---|---|
| QLD disclosures (8 departments) | 199,671 | 64-100% | 0-100% |
| WA (Tenders WA + Data WA) | 17,055 | 0% | 34-36% (v2 trial: ~44%) |
| VIC, NSW, QLD QTenders | 48 | 0% | 0% |

AusTender (`austender_contracts`, 824K) publishes ABNs and has its own backfill (`scripts/backfill-austender-entities.mjs`).
QLD DCSYW: 92% carry an ABN, 34% link to an entity. Same shape as WA's 5,095: the ABN is known, the graph does not hold the organisation.

## The design

One ledger, one function, one decision store. States become inputs, not code.

**1. `supplier_components`**: one row per (source, record, supplier ordinal). Generalises `wa_supplier_entity_matches`: `published_name`, `published_abn`, `identified_abn`, `abn_method`, `matched_entity_id`, `match_status`, `match_method`, `candidate_entity_ids`, `evidence`, `resolver_version`.

**2. `resolve_supplier_components(p_source text)`** runs the steps in a fixed order, each only on what the previous left:

| step | settles | rule |
|---|---|---|
| a. published ABN | QLD, AusTender | ABN is active in `abr_registry`; entity by ABN, exactly one |
| b. confirmed decision | everything | a row in `supplier_identity_decisions` wins, before any matching |
| c. register names | WA, VIC, NSW | exact normalised name vs gs_entities / ACNC / ORIC / social enterprise / sourced aliases (WA v1) |
| d. ABN register | name-only sources | exact upper legal name, unique active ABN (WA v2) |
| e. ABN tiebreak / conflict | ambiguous and contradicted links | WA v2 rules: trust the source-named legal name; otherwise review |
| f. Jev | the residue of e only | label the relationship, review-only (`scripts/wa/review-supplier-conflicts-jev.mjs`) |

**3. `supplier_identity_decisions`**: keyed on (normalised published name, identified ABN), not on a contract line. A human confirming "Integrity Staffing (Agility Staffing Pty Ltd) = ABN x" settles all 278 WA lines and every future line in any state. `decided_by`, `decided_at`, `basis`, `jev_label` (advisory).

**4. Per-state code shrinks to ingest.** Each ingest writes `supplier_components`; the WA function becomes a call with `p_source = 'wa'`, and the `wa_transition_candidates` update moves into a WA-only follow-on.

## Rules that do not bend

- Exact only. No fuzzy link is ever written; fuzzy may only nominate for review.
- An ABN is published or identified; never a mode or a guess.
- Identity is not ACCO status. `is_community_controlled` comes from ORIC/ACNC and named-provider sources, never from Jev or a name.
- Jev labels, humans decide, confirmed rows survive every rerun.

## Found while planning: a guessed-ABN backfill

`scripts/sql/backfill-state-tenders-abn.sql` writes into `state_tenders.supplier_abn` and, for names with several ABNs, **picks the most frequent**. That is a guess stored in the column that otherwise means "published". Before the shared resolver treats `published_abn` as step a, measure which rows it wrote (no provenance column today) and move them to `identified_abn` with `abn_method = 'legacy_mode_backfill'`, or re-derive.

## Also needed: entity ABN hygiene

WA v2 found about 25 names where gs_entities holds a different ABN from the active register record for the same legal name. A periodic job comparing `gs_entities.abn` with `abr_registry` status (cancelled, replaced) stops these conflicts at the source.

## Order

1. Apply WA v2, measure live (blocked on merge + Ben's verb).
2. `supplier_identity_decisions` table + step b, fed by the WA review queue.
3. Generalise the ledger and function; port WA onto it with no behaviour change (compare counts).
4. Port QLD (step a heavy), then AusTender's backfill.
5. Audit the mode backfill; entity ABN hygiene job.

## Audit of the guessed-ABN backfill (2026-09-28, read-only)

`backfill-state-tenders-abn.sql` (commit f01cbe01, 2026-03-27) reported +31,450 state-tender ABNs (82.2% -> 98.0%). Phase 1 copies the most frequent ABN per upper-case name; phases 2 and 3 take the alphabetically first ABN when a name has several. No provenance column exists, and a later process restamped `updated_at` on 2026-08-08, so the backfilled rows cannot be isolated directly (only 405 DOE rows still carry the 2026-03-27 stamp).

Measured instead (queries: temp tables + ROLLBACK):

| source | rows with a valid-shape ABN | name has several active register ABNs | stored ABN contradicts the name's only register ABN |
|---|---|---|---|
| qld_doe_disclosure | 72,321 | 1,557 | 3,292 (3,212 are `#N/A`, 77 an active ABN of another name, 3 cancelled) |
| other 7 QLD sources | 103,229 | 2,165 | 229 |

- The alphabetical-first signature is not above chance (337 of 1,557 DOE rows), so there is no evidence phases 2-3 wrote many guesses. The realistic exposure is the ~3.7K rows on multi-ABN names, plus a handful of wrong-company ABNs (e.g. BUYEQUIP PTY LTD stored under EQUIPMENTOR PTY LTD's ABN).
- **The bigger defect is junk in `supplier_abn`:** 20,314 non-null values that are not an 11-digit ABN, 20,093 of them in DOE. Examples: `#N/A`, `0`, `Notassigned`, `#VALUE!`, `NoABN`, plus comma-separated lists of joint suppliers. Phase 1 counted any non-null value as an ABN, so it could have spread `#N/A` to same-name rows (Logan City Council: 192 rows of `#N/A`, while the register gives it one ABN).
- The QLD ingest is JusticeHub's; the fix belongs there (validate shape + checksum, split lists, null the rest) and in step a of the shared resolver: treat `published_abn` as an ABN only if it is 11 digits, passes the checksum and exists in `abr_registry`.
