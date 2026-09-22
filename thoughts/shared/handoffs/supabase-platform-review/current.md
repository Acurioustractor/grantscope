---
date: 2026-09-06T06:50:07+10:00
session_name: supabase-platform-review
branch: main (all work landed; two PRs open in sibling repos)
status: active
---

# Work Stream: supabase-platform-review

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-06T06:50:07+10:00
**Goal:** Make the shared Supabase project legible, safe and sustainable, and make the grants focus one product instead of four. Done when private data cannot be read by the public key, the schema is reproducible from the repo, and there is one write path, one read path and one search over a fundable thing.
**Branch:** main
**Test:** `bash scripts/precheck.sh` · `node --env-file=.env scripts/check-migration-parity.mjs` · `node --env-file=.env scripts/check-private-exposure.mjs`

### Now
[->] Nothing in progress. Everything in grantscope is merged; main is at `657e945a`. Two PRs await Ben in sibling repos: justicehub-platform #475 and act-global-infrastructure #232.

### This Session
- [x] Whole-platform review: 8 Supabase projects, 6 repos on one shared project (`tednluwflfhxyucgwigh`). Findings: `thoughts/shared/findings/supabase-platform-review-2026-09-05.md` (12 sections). Artifact: https://claude.ai/code/artifact/e2c4aafc-46f1-474f-9581-88d24e6a58a0
- [x] **Phase 0 (#405)** ACT Xero/GHL rows were readable with the PUBLIC key via 15 SECURITY DEFINER views (5,509 contacts, 262 payables, 2,064 expense rows, 315 emails). Closed + verified 401.
- [x] **Phase 1 (#406, #407)** baseline dump = schema floor; `scripts/db-apply.sh` is the ONLY apply path; `check-migration-parity.mjs` in preflight + CI; `schema_ownership` seeded (1,000 rows); 48 definer views flipped; search_path pinned on 59; `/db-apply` skill.
- [x] **Phase 2 option C (#412)** `check-private-exposure.mjs` gate (4 allowlisted). Plan doc `thoughts/shared/plans/phase2-private-data-boundary.md` recommends schema `act` move inside Phase 3, NOT a separate project (39 FKs into the civic spine).
- [x] **Phase 4 (#413, #414, #415)** `mv_search_index` (12 kinds, ~440k rows, nightly) + `search_index_query`; `/api/search/index`; `/api/global-search` rewritten to per-lane queries. Fixed 2.8s→185ms (unindexed OR branch on `postcode`).
- [x] **Phase 5 (#416, #417, #418)** one write contract `scripts/lib/upsert-grant-opportunities.mjs` (all 7 writers + guard test); VIC ingest fixed (was failing 51/57 nightly); `v_funding_opportunities` = the one read path (29,289 rows, 53ms).
- [x] Grant titles: 5,754 rows renamed from abstract to first sentence; long names 8,343 → 2,654; search index refreshed. APPLIED, PR mid-gate at clear.
- [x] Cross-repo: **JusticeHub PR #475** (funding alerts could never fire: `relevance_score >= 35` matched ZERO of 12,490 open rows) and **act-global PR #232** (briefing ranked by the constant 50). Both OPEN, not merged.
- [x] Production env: legacy anon JWT deleted from Vercel, `SUPABASE_URL` re-entered clean; legacy JWT keys purged from 5 local env files (backups `.bak-20260905`).

### Next
- [ ] Ben to review/merge JusticeHub #475 and act-global #232 (other repos, need his verb).
- [ ] 2,654 grant names still hold abstracts (brisbane-grants 1,854, Lotterywest 729) with no clean sentence boundary.
- [ ] 40 definer views still need a human decision (findings §10 table); 87 case-varying duplicate pairs inside `grant_opportunities` need a merge call.
- [ ] Phase 3: kill `exec_sql` string SQL in pages (607 call sites / 130 files), fold the schema `act` move into it.

### Decisions
- **Exposure is measured by RLS state, never by grant.** 288 objects carry an anon SELECT grant that RLS blocks. "Open" = grant AND (no RLS | permissive anon read policy | matview | definer view).
- **`alma_funding_opportunities` can NEVER become a view** - 11 writers across 3 repos. The read-side `v_funding_opportunities` was built instead.
- **Dedupe of promoted rows must be by lower(name)** - `source_id` is NULL on all 13,102 rows, so no key exists. Name matches 6,609/6,642; url only 4,987/6,642.
- **One real scorer.** `act_grant_recommendations_current` (5,995 rows, 11 projects, 9-93). `relevance_score` is the default 50 on 26,659/26,698 and 0 on 13,100/13,102. Never rank by it.
- **Force-push stays Tier 3.** A stuck PR was resolved by merging main into the branch, not rebasing.
- **Sibling repos get worktrees, never edits in place** - JusticeHub had 51 and act-global 118 uncommitted files from other sessions.

### Open Questions
- UNCONFIRMED: whether `idx_grant_opp_name_source_id` can be dropped now that nothing targets it.
- UNCONFIRMED: the 560 embedding errors per run in "Sync Foundation Programs" (its ingest works; embeddings fail).

### Workflow State
pattern: phased remediation
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "review how this site uses Supabase and how it connects with JusticeHub / ACT data; make it sustainable and not all over the place"
- resource_allocation: aggressive (14 PRs, 13 migrations applied in one session)

#### Unknowns
- name_source_id_index_droppable: UNKNOWN

#### Last Failure
(none blocking) `ship-watch` twice reported a false "live check failed" because it split `--verify` on the first `=`; fixed in #415. Its cleanup also fails when a stale worktree holds `main` - prune worktrees after landing. On #419 the watcher exited before the Vercel build finished and left the PR open with every check green; if a watcher goes quiet, re-check `gh pr checks` rather than assuming it merged.

---

## Context

### The one-paragraph version
One Supabase project (`tednluwflfhxyucgwigh`, 27 GB, 776 tables) is the database for six repos AND holds A Curious Tractor's private CRM, accounts mirror and inbox. This session closed the exposure that made those private rows readable with the public API key, made the schema reproducible from the repo for the first time (313 of 418 migrations had no source file anywhere), and consolidated the grants product onto one write path, one read path and one search index.

### Where things live now
| thing | path |
|---|---|
| findings (12 sections, confidence-tagged) | `thoughts/shared/findings/supabase-platform-review-2026-09-05.md` |
| Phase 2 boundary plan | `thoughts/shared/plans/phase2-private-data-boundary.md` |
| migrations (the ONLY home) | `supabase/migrations/`, baseline `20260905130000` |
| pre-baseline history | `supabase/migrations_history/` + `RESTORE.md` |
| apply path | `scripts/db-apply.sh` + `/db-apply` skill |
| guards | `check-migration-parity.mjs`, `check-private-exposure.mjs`, `grant-write-contract.test.ts` |
| write contract | `scripts/lib/upsert-grant-opportunities.mjs` |
| read path | `v_funding_opportunities` + `apps/web/src/lib/funding/opportunities.ts` + `/api/data/funding-opportunities` |
| search | `mv_search_index` + `search_index_query` + `/api/search/index` |
| register UI | `/ops/schema` (admin-gated) |

### Migrations applied this session (all tracked)
`20260905120000` close private views · `130000` baseline · `140000` ownership seed · `141000` 48 view flips · `142000` search_path · `143000` project-finance views · `144000` goods views · `150000` ACT finance aggregates · `151000` ACT context tables · `160000`-`164000` search index · `170000`/`171000` search perf · `180000`/`181000` unified view · `190000` grant titles.

### Traps worth re-reading before touching any of it
- `ON CONFLICT` resolves ONLY the index you name; `grant_opportunities` has three.
- An OR branch on an unindexed column forces a seq scan once the value is a function parameter (2.8s vs 124ms).
- A matview cannot be altered in place; column changes need DROP + recreate, and the RPC's return type with it.
- `agent_runs.timed_out` is a 4-hour janitor for interrupted processes, not a timeout. `partial` usually means the ingest worked.
- `vercel env add` with a piped value stores the var as Sensitive, hiding it from every later pull.
