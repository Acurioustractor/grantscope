---
date: 2026-09-22T12:00:00Z
session_name: jev-system-alignment
branch: main
status: active
---

# Work Stream: jev-system-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-23T06:50:00Z
**Goal:** SUPERSEDED. This work stream is backlog. The live work is `thoughts/shared/handoffs/community-money-finder/current.md` (power-and-philanthropy story + the community money finder). Read that one first.
**Branch:** `main` @ `1b1c9d33`
**Test:** `bash scripts/precheck.sh`

### Now
[->] Nothing active here. Ben stopped graph-edge cleanup on 2026-09-22: months of churn with no usable result. Open items below are backlog, to be picked up only when something someone uses depends on them.

### This Session (2026-09-22, second session)
- [x] **Graph build unblocked** (#486): 3 ACNC placeholder ABNs (91111111272/3, 99111111119) failed the checksum → makeGsId threw → every run since 2026-09-18 died before edges. `validAbn()` guard at 7 sites. Entity dry-run clean. Full rebuild NOT yet observed.
- [x] **ALMA readers** (#487 + 20260922120000): view `alma_interventions_valid` (security_invoker); 51 readers in 34 files switched; `apps/web/src/lib/alma-readers.test.ts` fails CI on raw reads outside allowlist. 10 homepage rows quarantined → 252 quarantined / 1,902 valid. Alice Springs 29→27, verified on dev.
- [x] **Register state fix** (20260922130000): 78 NT sub-units + 1 QLD dept → 79 buyers linked.
- [x] **28 JEV funder matches** (20260922140000, Ben approved each): `funder_entity_links` reviewed; 317 opps linked (19,921/23,705). Triggers off for backfill.
- [x] **Last 11 buyers** (20260922150000–180000): `buyer_entity_links` reviewed table, read FIRST by `link_se_buyer_prospects()`, graph-edge-datasets austender map, and build-entity-graph govGsId. 14 names fixed from abr_registry (AU-ABN-76337613647 was "Brisbane Youth Detention Centre" = QLD Dept of Education; "Queensland Health" node was QLD Women's Health Network). 5 merges (Griffith + QUT typo ABNs, DoE/PSBA/QUT stubs; map `gs_entity_merge_map_20260922`). `renamed_to` relationship type + 2 lineage edges. Buyers 438/438 (13 reviewed).
- [x] (prior session) **ALMA quarantine is DONE, not a backlog.** 242 rows `data_quality='quarantined'`. Real gaps: 9 `valid` rows are nav dumps; **49 of 54 reader files ignore the flag** — `/api/justice/interventions` serves 55/500 junk, public Alice Springs report shows 2/29. NOT FIXED.
- [x] **Linkage guard** `scripts/check-table-linkage.mjs` in CI (#480, #481). Baseline by NAME in `data/linkage-baseline.json`: 6 accepted, 11 exempt with reasons. Counts FK-to-keyed-table as linked; ignores boolean `_abn` flags (`requires_abn` hid alma_funding_opportunities).
- [x] **Migration 20260922090000 applied** (#482): `se_buyer_prospects.gs_entity_id` + `link_method`; `funder_entity_links` lookup + trigger fills `alma_funding_opportunities.funder_entity_id` on insert. 19,604/23,705 opps linked.
- [x] **Migration 20260922100000 applied** (#485): state-prefix rung, SAME STATE required. Buyers 348/438 (189 graph_edge, 92 unique_name, 67 unique_name_no_prefix, 90 unlinked).
- [x] **JEV entity match** `scripts/jev-entity-match.mjs` (#484), read-only. Report `thoughts/shared/findings/jev-entity-match-2026-09-21.md`.
- [x] classify-changes.sh: guard baselines + `data/jev-check/` are SAFE. db-apply skill: merge the file BEFORE applying.

### Next
- [ ] **Confirm nightly graph build** finished and austender/aec drift closed (check-graph-completeness in agent_runs).
- [ ] **Register-name sweep:** names overwritten by imports (JusticeHub wrote a facility name onto a dept ABN). Compare gs_entities.canonical_name vs abr_registry.entity_name for AU-ABN nodes; guard against the overwrite recurring.
- [ ] NSW DPI contracts after Oct 2021 belong to a successor dept (ABN not established); currently under Dept of Industry.
- [ ] Types not regenerated after 150000 (new table buyer_entity_links, merge map) — run type generation.
- [ ] 3 QLD/NSW buyers once "no edge" (249) were a crash, not the map — verify edges exist after rebuild.
- [ ] 157 `open` opportunities past deadline — unmade decision (the status trigger would close them).
- [ ] Carried from before: 30 contradicting ALMA yj rows + 154 unassessed; `grantconnect_awards.category` readers; merged-branch sweep; parse-foundation-grants mis-tag; Epworth duplicate.

### Decisions
- **Code for rules, JEV for judgement.** 88/92 JEV buyer matches were a state prefix → became an exact SQL rung. JEV's worth was funder suffix/trustee judgement and REFUSING look-alikes (Ocean Data Network ≠ Dads Network).
- **A dropped prefix must be re-checked.** Prefix-strip alone linked QLD Dept of Education to VIC's (794 contracts). Caught only because JEV had picked a different entity.
- **JEV weak spot confirmed:** renamed depts called "same organisation" at 0.90–0.91; `renamed` chosen 0 times. Renames need a human or a source record.
- **Renamed dept (Ben 2026-09-22): "separate, linked", applied as identity = ABN.** Same ABN through renames = one entity (QLD 75563721098 held 4 names); an ABN change = separate node + `renamed_to` edge. Check abr_registry before minting.
- **Reviewed links live in lookup tables** (`funder_entity_links`, `buyer_entity_links`) that every resolver reads first — se_buyer_prospects is truncated each scout run and the graph re-resolves nightly.
- **Ben runs db-apply himself** via `! scripts/db-apply.sh …` — auto-mode classifier blocked the merge migration. Hand him the exact command.
- **The name on a node is not evidence.** Verify ABN-keyed nodes against abr_registry before linking or merging.
- **Key the funder NAME, not 23K rows** — lookup table + trigger, no writer changes.
- **No completion receipt for the keys yet**: nothing consumes them, and a receipt naming created columns is refused. Add with the first consumer.
- **Bulk UPDATE on alma_funding_opportunities** must disable `trigger_funding_opportunities_updated` + `trigger_funding_status_update` (memory: solution_afo_bulk_update_triggers).

### Open Questions
- NOTE: repo has auto-merge DISABLED; ship-watch `--merge` does the merge. `main` unprotected — a direct `gh pr merge` goes through before CI finishes.
- NOTE: port 3013 was squatted by a Goods worktree; grantscope dev ran on 3016.
- UNKNOWN: identity accuracy of JEV — the 0.90/95% calibration was on topic labels, not identity.
- NOTE: `ship-watch.mjs` output via `| tail` always shows exit 0; redirect to a file and echo `$?` to get the real result. zsh has no `PIPESTATUS`.
- NOTE: CI linkage query hit exec_sql's 8s timeout once under DB load (query is 0.3–0.5s); re-run passed.

### Workflow State
pattern: guard-key-adjudicate
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "make the database readable, connected and clean, ready for linkage; JEV where it beats other systems"
- resource_allocation: balanced

#### Unknowns
- (none; rename policy decided 2026-09-22)

#### Last Failure
(none open)

---

## Context

### Where everything lives
- **Audit + reasoning:** `thoughts/shared/findings/jev-evaluation-2026-09-21.md` (corrected twice by the pilot; confidence-tagged `[V]`/`[D]`/`[?]`)
- **Pilot:** `scripts/jev-pilot/` — `1-fetch-pages` (corpus; the cache stores verdicts ONLY, no url/page text), `2-ask-jev` (both primitives, `--primitive=choice`), `3-compare` (blind adjudication sheet), `4-missed-money` (the sweep). README carries the measurements.
- **Production rubric scorer:** `scripts/score-project-rubric.mjs` → writes `project_relevance.<p>.rubric` + `rubric_meta`. No migration; it uses the existing jsonb.
- **Gate tests:** `scripts/lib/project-relevance.test.mjs` (33), `scripts/lib/foundation-program-gate.test.mjs` (9).

### What JEV is (docs.typesafe.ai, read 2026-09-21)
`POST https://api.typesafe.ai/v1/systemone`, Bearer auth, one `state` + named `questions`. **Noul** → probability, *no confidence field*. **Choice** → label + per-option probabilities + confidence. **Score** → 2–10 rubric levels + confidence. `jev-1.13.0`, 64k context (32k state+question), **$0.042 per million input tokens, output free**, 1,200 rpm. `JEV_API_KEY` is in `.env`.

Hard limits, quoted: "not a calculator", "does not count reliably", "reads dates as text, not as ordered quantities", cannot judge whether two values are near each other, "context rot" from unrelated detail, and `P(noul)` vs `1 - P(not noul)` are not comparable.

### Traps hit this session, so they are not re-hit
1. `applyProjectTags` **replaces the whole per-project object** — a stored `rubric` must be carried across or a keyword rescore silently wipes it.
2. Regression-testing on the 383 OPEN grants missed collateral across all 26,840. `'exhibitions'` in tier1 tagged craft fairs; `'touring'` tagged 160+ orchestra tours. **Measure on the full corpus.**
3. The overseas geography gate must apply to NATIONAL projects too — Contained is national, so the per-state check never ran and a `geography='NZ'` grant got tagged.
4. `person_name_normalised` is **UPPERCASE**. A lowercase join reported 0% board→graph linkage; the truth is 87%.
5. Naive name joins produce "Mark Smith, 714 boards". Cap board_count (`person-cluster.mjs` already does).
6. `logStart(supabase, agentId, agentName)` takes supabase FIRST and returns a ROW `{id}`, not a bare id.
7. `nohup ... &` inside a backgrounded Bash tool call orphans the process. Let the tool own it.
8. Importing a script whose `main()` is unguarded executes it. Both foundation scripts are now guarded.
9. The auto-mode classifier blocks `psql` writes as [Modify Shared Resources]. Commit the SQL with the apply command in the header; Ben runs it with `! cd ... && set -a && source .env && set +a && PGPASSWORD=... psql ...`.

### Traps added 2026-09-21 (session 2)
10. **A failing `HEAD` is not a dead URL.** grants.gov.au answers HEAD with 404 and GET with 200. Always retry with GET before concluding anything, and adjudicate any non-2xx in a real browser.
11. **`grant_opportunities_url_idx` is UNIQUE on `url`.** That is why foundation programmes carried a `#slug`. Any URL change must keep rows distinct — `assignProgramUrls` handles it, including two identically named programmes on one page.
12. **`grant_opportunities.amount_*` are INTEGER; `foundation_programs.amount_*` are NUMERIC.** A fractional value kills the whole row.
13. **Gemini 2.5 Flash spends `max_tokens` on reasoning before writing.** A tight cap returns unclosed JSON that reads as a parser bug. Check `finish_reason` before blaming the regex.
14. **The sync takes >10 minutes.** Run it backgrounded; `pgrep -f sync-foundation-programs.mjs` in an until-loop is the way to wait. stderr does not always reach the task output file — redirect to a file explicitly if you need the errors.
15. **`scripts/gsql.mjs` is SELECT-only.** Data deletions go in `scripts/sql/<date>-<name>.sql` applied with `psql -f`.

### The next session's actual question
Ben: *"come back for a big one that relates to JEV scanning all we have in the whole system, to align this better so fuck-ups like that don't happen, and we build a better graph and recall and memory."*

Read the Decisions block first, especially the diagnosis. Candidate shape, not yet agreed:
- **Alignment sweep:** JEV over existing rows to flag internal contradictions (a row claiming a deadline no source supports; an entity classified two ways; a "verified" tier resting on a guess).
- **Abstention retrofit:** the ~12 sites that ask a chat model for strict JSON and regex it back out (`auto-classify-llm`, `classify-acnc-social-enterprises`, the whole `enrich-*` family — none of which persist a confidence at all). Each is a Choice with an explicit unknown option.
- **Graph + recall:** retrieval provenance is the weak spot and JEV cannot fix it — `mv_search_index` carries **no external source URL**, `/api/chat` passages are truncated not verbatim, citations are model-written and never verified, `knowledge_chunks.file_path`/`.provenance` are never written, and `search_org_knowledge` is declared `vector(1536)` while the column is **384**. Fix ingest before filtering better.
- **Memory:** the durable lesson is that "unknown" must be representable end to end — in the extraction, in the column, and in the UI. Today it wasn't, at three separate layers.
