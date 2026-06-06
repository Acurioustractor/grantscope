# Community Finder / Directory Pipeline — Continuity Ledger

**Updated:** 2026-06-07 · **Branch:** `claude/scraping-funding-orgs-TeFjK` (pushed, 6 commits ahead of its base)
**Worktree:** `/Users/benknight/Code/grantscope-scraping` (main checkout holds another session's `codex/australian-giving-data-commons` work — do not disturb)

## What this workstream is
Build the "local community everything finder" (community orgs, philanthropy, grants, legal help, youth justice). Strategy + evidence live in two docs on this branch:
- `thoughts/shared/research/community-finder-landscape-2026-06-06.md` — external landscape, incumbent data-sourcing playbook, phased build plan
- `thoughts/shared/research/data-asset-inventory-2026-06-06.md` — full DB census; corrects the plan: data layer is largely ready, the gap is the public surface

## Shipped + applied (all verified against live DB)
- **MyCommunityDirectory scraper rewritten to its public JSON API** (`/api/councils` 563 regions + paged council search, PageSize=100, IsLocal filter). HTML scraping is dead — listings are JS-rendered.
- **Staging upsert index fix** (migration `20260606161000`): partial unique index → non-partial; PostgREST ON CONFLICT now works. (Memory saved: PostgREST can't target partial/expression indexes.)
- **SA Community Directory ingested**: 14,439 orgs (CC-BY, data.sa.gov.au) via `ingest-open-community-directories.mjs`.
- **Bridge applied for SA**: 7,450 linked into gs_entities (5,351 ABN-exact + fuzzy), 7,117 entities contact-enriched. Bridge fuzzy matcher optimized 19min→18s (token inverted index + precomputed trigrams). Known cosmetic: final "linked=" log line double-counts ABN phase.
- **Contact backfill v2 applied** (`enrich-entity-contacts-v2.mjs`): gs_entities website 58,328→74,296 (+27%), email→7,639, phone→6,145. Pre-state snapshot: `_backup_entity_contacts_20260606` (16,664 rows) — rollback is one UPDATE-from-join.
- **ACNC programs delta-refreshed** (`ingest-acnc-ais.mjs --programs-only --delta`): +185 → 98,381 programs, all but 9 graph-linked. 2023 is the latest published AIS year; ACNC re-publishes monthly.
- **Grant-deadline repair**: 65 closes_at→deadline, 179 stale-"open" closed. 4,601 live grants, 0 stale-opens. 14.4K no-deadline rows are correctly-labelled `historical_award` — not broken.
- **ABR exact-name resolution**: 155 SA orgs got verified ABNs (state/postcode-guarded, unique-match only), 19 linked.
- **Schedules enabled** (`agent_schedules`): scraper weekly, bridge weekly, infoxchange weekly (no-op until ISS key), open-data ingest monthly. Registry timeout for scraper raised to 3h.

## In flight
- **MCD national crawl** running detached on the Mac: `tail -2 /tmp/mcd-national.log` (PID was 68329; started ~06:40 2026-06-07, ~90 min expected). It upserts ONCE at the end — staging shows 30 MCD rows until it completes. When done: verify `SELECT source, COUNT(*) FROM community_directory_orgs GROUP BY source`, then `node --env-file=.env scripts/bridge-community-directories.mjs --source=mycommunitydirectory --apply`. If the process died mid-crawl, just re-run it (idempotent upserts). Future hardening: per-council flush.

## Open decisions (user calls, not started)
1. **`--create-unmatched` for SA**: 1,854 staged orgs now hold verified ABNs but aren't in the graph (small orgs, e.g. RSL sub-branches). `bridge-community-directories --source=sacommunity --apply --create-unmatched` would mint ABN-keyed entities. 5,135 remain name-only (need trigram-vs-ABR infra — separate build; exact-match yield was only 155/5,291).
2. **Phase 0 `/find` surface**: public search over acnc_programs (98K, 25 target facets, 94% located) ∪ ndis_registered_providers (48.5K) ∪ community_directory_orgs ∪ justice signals MVs. Data is ready; this is the highest-leverage build.
3. Whether the cloud scheduler's datacenter IP can reach the MCD JSON API — first scheduled run of `scrape-community-directories` will tell (check `agent_runs`).

## Key facts rediscovered this session
- gsql.mjs for SELECTs; psql -f for DDL/bulk writes; ~8s statement timeout on gsql, set `statement_timeout` in psql sessions.
- `mv_abr_name_lookup` (9M rows) norm rule: strip (Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc|The|Of), strip non-alphanum, lower, trim. Btree on norm_name — exact joins only.
- `acnc_ais` financials (360K rows incl. revenue_from_government) already ingested — landscape plan's "Phase 1 AIS ingest" is done; it's loaded by `import-acnc-financials`, NOT the broken AIS half of `ingest-acnc-ais.mjs`.
- Worktree needs `ln -s ../grantscope/node_modules` and a copied `.env`.
