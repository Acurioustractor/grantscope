# Method — inventory, mining, scoring

All queries are read-only. Use `node --env-file=.env scripts/gsql.mjs "<SELECT>"`. Keep outputs tiny
(counts, not rows). Verify schema before guessing columns (`data/schema-cache.md` or `information_schema`
for tables; `pg_attribute` for MVs — matviews are NOT in `information_schema.columns`).

## 1. Inventory — "see everything we have"

```sql
-- Tables by size
SELECT relname, reltuples::bigint AS rows FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relkind='r' ORDER BY reltuples DESC LIMIT 40;

-- Materialised views (the connections already built) + populated state
SELECT matviewname, ispopulated FROM pg_matviews WHERE schemaname='public' ORDER BY matviewname;

-- Freshness of the built connections
SELECT MAX(finished_at) FROM mv_refresh_log WHERE status='success';
```

Cache the result in the map header (`Inventory snapshot: <date>`). Re-run when stale or after new state
(crawl finish, MV refresh, enrichment run).

## 2. The join-key map (the spine of every connection)

The estate connects on five keys. This is where latent value lives.

| Key | Carriers (table.column) |
|-----|-------------------------|
| **ABN** | `gs_entities.abn` · `acnc_charities.abn` · `ato_tax_transparency.abn` · `austender_contracts.supplier_abn` · `political_donations.donor_abn` · `foundations.acnc_abn` · `justice_funding.recipient_abn` · `oric_corporations.abn` · `entity_identifiers` (type=abn) |
| **gs_entity_id** | `gs_relationships.source/target_entity_id` · `justice_funding.gs_entity_id` · `alma_interventions.gs_entity_id` |
| **postcode** | `gs_entities.postcode` · `seifa_2021.postcode` · `postcode_geo.postcode` · `mv_funding_by_postcode` |
| **lga** | `gs_entities.lga_code` · `mv_funding_by_lga.lga_code` · `mv_funding_deserts.lga_name` |
| **person/name** | `mv_board_interlocks.person_name` · `mv_person_entity_network` · `mv_person_influence` · `political_donations.donor_name` |
| **intervention_id** | `alma_interventions` ↔ `alma_evidence` ↔ `alma_outcomes` |

## 3. Connection mining (per iteration, one key or one goal)

For the chosen key K:
1. **List carriers** of K (table above) and which MVs already join them (scan `pg_matviews` + names like
   `mv_*crossref*`, `mv_*_donor_*`, `mv_entity_*`). Those are **already-built** — don't re-propose.
2. **Enumerate latent pairs/triples** A × B on K that have NO MV.
3. **Prove coverage** with ONE count (the gate between "idea" and "dead lead"):
   ```sql
   -- e.g. how many distinct justice recipients also appear in ATO tax-transparency, by ABN
   WITH a AS (SELECT DISTINCT recipient_abn k FROM justice_funding WHERE recipient_abn IS NOT NULL)
   SELECT COUNT(*) total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM ato_tax_transparency b WHERE b.abn=a.k)) overlap FROM a;
   ```
   Low overlap (<~10%) → mark `blocked` (not worth an MV). Healthy overlap → `latent`.
4. **Name the connection** in terms of the *question it answers*, not the tables. "Which youth-justice
   recipients are well-resourced vs struggling" beats "join justice_funding to ato".

## 4. Scoring + tagging

`score = readiness × alignment × novelty`, then attach the wedge tag.

- **readiness** 0–3: join coverage (0 = <10%, 1 = 10–40%, 2 = 40–70%, 3 = >70%) − 1 if a feeding MV is stale.
- **alignment** 0–3: 3 = serves G1 (buyer wedge) directly; 2 = serves a mission goal G3–G5; +1 quadrant
  bonus if it serves a mission goal **and** feeds the wedge (the best quadrant); 0 = serves no goal → drop.
- **novelty** 0–2: 2 = no MV/product exploits it yet; 1 = partially built; 0 = already-built (don't list).
- **wedge tag** (from `goals-register.md`): green / supply-magnet / widening-paused / not-building.
  `widening-paused` → score forced low, listed only as a flagged note.

Sort the map by score. The top of the map is the next thing worth building.

## 5. Seed connections to check first (highest-prior)

Already surfaced by the health loop / known-valuable — verify coverage, then rank:
- `justice_funding × ato_tax_transparency × acnc` (ABN) → resourced-vs-struggling justice recipients (G3).
- new VIC suppliers × `se_search_index`/registry × buyer obligations → lighthouse matches (G1) — feeds `scout-se-buyers`.
- `oric_corporations × austender_contracts × gs_entities` (ABN) → Indigenous procurement capability (G4∩G1, best quadrant).
- `mv_funding_deserts × gs_entities (community_controlled)` (lga/postcode) → community-controlled orgs in deserts (G5∩G4).
- `political_donations × austender_contracts` (ABN) → donor-contractors (already `mv_gs_donor_contractors` — confirm, likely already-built).
