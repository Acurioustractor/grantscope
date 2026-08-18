---
date: 2026-08-19T02:00:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-19T02:00:00Z
**Goal:** CivicGraph as one legible system — every number on a screen means what the screen says,
and landing the work stops costing more than the work.
**Branch:** `main` through `2e817b71`. **Zero open PRs**, tree clean, all local branches deleted.
Merged this session: #257 name normalisation · #258 admin audit + landing policy · #259 grantee
harness · #260 dedupe · #261 Vercel build-skip · #262 report caching.
**Test:** `scripts/precheck.sh` (tsc + 734 vitest) · dev 3013

### Now
[->] **Run `scripts/wizard-pm2-startup.sh`** (2 min, needs Ben's password) — it is the last gap in
the orchestrator outage. Then: the two cron decisions, or Lever 2 proven on one page.

### Orchestrator outage — CLOSED 2026-08-18 (after the close-out above)
The pm2 orchestrator daemon was found **stopped, down ~2 days**. On restart it logged "Recovered 1
stuck task" and "Coalesced 86 superseded scheduled tasks". This CORRECTS the earlier A1 diagnosis:
the `persist()` crash was real and fixed, but **necessary, not sufficient** — with the daemon down,
nothing scheduled the work regardless. Both were needed.

- **Proven:** the nightly grant pipeline then ran `success` in **277s**, after every run since
  2026-08-07 had been `timed_out` with duration 0.
- Feed recovered: `apply_now`+`rolling` **1,449** (was 0), quarantined 822 (was 2,592).
- `pm2 save` done — 43 processes; old dump backed up at `~/.pm2/dump.pm2.bak-20260818`.
- **Still open:** `pm2 startup` needs a sudo line only Ben can run → `scripts/wizard-pm2-startup.sh`
  (#264). Until then a reboot takes the orchestrator down silently again.
- Alarm shipped (#263): `/ops/health` leads with a red banner when no agent has run in 6 hours.
  Also fixed a **false SAFE** in `classify-changes.sh` — it compared committed history only, so
  running it before a commit answered "no changes -> SAFE", and SAFE is what auto-merges.

### This Session (2026-08-18→19)
Started as "continue UX", became a data-honesty and cost session.

- [x] **UX pass 2 shipped (#257)** — `entity_name_key()` folds PTY LTD/LIMITED/P/L variants; Pratt
      Holdings 8 rows -> 1; fixed a drawer/row mismatch; ABN borrowing now needs a name to map to
      exactly ONE ABN. Remoteness chart follows the topic filter and the dashboard reconciles.
- [x] **Admin audit + fixes (#258)** — 12 findings, `docs/ux-audit/admin-ux-findings.md`.
      **A1: the opportunity feed was stuck, not bad.** The nightly orchestrator last succeeded
      2026-08-07 and timed out 3x daily since; one transient `fetch failed` on a single Supabase
      write killed the whole pass after ~10 rows. `persist()` now retries and skips the bad row —
      **proven: 5,546 rows, 0 failures**. `act_grant_recommendations_current` 0 -> 7,241.
      A staleness **warn band** (7-21d = `stale_warning`, >21d hard) means one missed job can no
      longer silently zero the screen.
- [x] **$304.4M of double-counting removed (#260)** — found by checking the graph before writing an
      Ian Potter scraper: he was already ingested, and ingested TWICE. 5,481 of `foundation_grantees`'
      5,577 grant rows were duplicates of `ian_potter_grants_db`/`frrr_grants`/`myer_annual_report_2024`.
      Backed up in `_backup_foundation_grantees_dupes_20260818` + committed TSV.
- [x] **Grantee harness (#259)** — `grantee-resolve.mjs` + `grantee-migration.mjs` replace the
      per-funder hand-work. Verified 322/322 against known-good HMST rows.
- [x] **Landing policy + adapters (#258)** — we were burning sessions on push/PR/merge ceremony.
      `precheck.sh`, `classify-changes.sh`, `ship-watch.mjs` + a repo-scoped standing authorization
      in CLAUDE.md. SAFE changes land on green unattended; VISIBLE stop for Ben.
- [x] **Vercel cost (#261, #262)** — 20 deployments in 8.9h, most for commits that touched no app
      code. Ignored Build Step skips 62% of builds. 22 report pages moved off per-request queries.

### Next on resume
- [ ] **Ben's calls:** the two hourly crons (`usage-alerts`, `deliver-notifications`, ~1,440
      invocations/month); Lever 2 (`force-dynamic` -> `revalidate`, proven on ONE page first —
      it makes builds query Supabase); F12 name casing.
- [ ] **129 uncached pages** remain (mostly `/org` 47, `/clarity` 16). Same `unstable_cache` shape
      as the reports.
- [ ] **Grantee gaps, re-scouted** — the parked list was stale, every source is part-done:
      Buckland 2023 · Myer FY13-23 + FY25 · VFFF amounts (7 edges carry $0) · Perron is the only
      genuinely absent one. Paul Ramsay (108 edges) was never on the list.
- [ ] 96 leftover `foundation_grantees` rows · A12 floating widgets · `classify-changes.sh` does
      not list `data/`, so it calls a data-only change VISIBLE.

### Key traps (this arc, will bite again)
- **A parameterised SQL function gets a GENERIC plan.** Same SQL: 2.8s with literals, >60s inside
  the function. Never benchmark a query body and assume the RPC matches.
- **`unstable_cache` serves the OLD value shape until the KEY changes** — a new field silently does
  not render, for an hour, with no error.
- **`CREATE OR REPLACE FUNCTION` cannot change the return type or column order.** Read
  `pg_get_function_result(oid)` first — se_browse had 5 boolean columns a rewrite would have dropped.
- **A timed-out count rendered as a confident zero** (`count ?? 0`). Three separate layers this
  session could not tell "I measured zero" from "I could not measure".
- **Audit the page, not the viewport** — two P2 findings were wrong because the disclosure sat below
  a 200-row table.
- `git reset --hard` discards uncommitted TRACKED edits while leaving untracked files alone.
- Vercel's ignore step is INVERTED: exit 0 skips, exit 1 builds.

### Decisions
- **Disclose, do not hide.** The grants browser states its 91%-QLD skew and 55%-untagged share
  rather than filtering them away. Merge on identifiers, disclose on names.
- **Never commit to `main`.** Branch always; SAFE lands unattended, VISIBLE waits for Ben.
- Keep funder-specific dataset keys over the generic bucket — they carry provenance and reverse
  individually.
- Caching before ISR: `unstable_cache` cuts DB load with no build-time risk.

### Workflow State
pattern: ship-per-slice via /ship-merge (branch -> precheck -> classify -> PR -> watch -> merge)
phase: 7
total_phases: open-ended
retries: 0
max_retries: 3

#### Resolved
- goal: "UX pass 2, admin audit, and stop the landing tax"
- resource_allocation: balanced

#### Unknowns
- Tonight's nightly orchestrator run is the outstanding test of the persist() fix.

#### Last Failure
(none)

---

## Context

Session flow: Ben reviewed the deployed console (post-clarity-catalog work), verdict "works but hard
to make sense of", pointed at https://demos.shadcndashboard.dev/ and chose "soften Bauhaus toward
the demo" via AskUserQuestion. Pencil mock approved, then four ship-per-slice PRs same day.

Key files: `src/components/shell/{shell,shell-header,shell-menus}.tsx` · `src/app/dashboard/{layout,page}.tsx` · `src/app/dashboard/help/page.tsx` · `src/lib/view-registry.ts` · `src/app/reports/theme/page.tsx` (new index) · globals.css `.shell` block.
Grounding docs: `thoughts/shared/data-map/DASHBOARD-VIEW-MAP.md` · `thoughts/shared/plans/dashboard-shell-buildout.md`.
Prior stream handoff: `thoughts/shared/handoffs/clarity-catalog/current.md` (clarity console rebuild, still holds Slice 5 detail).
