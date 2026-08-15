---
date: 2026-08-15T08:30:00Z
session_name: clarity-catalog
branch: main
status: active
---

# Work Stream: clarity-catalog

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-15T08:30:00Z
**Goal:** `/clarity` slice 2 — the question board. **SHIPPED** (PR #204, `0c19443`). Next goal is slice 3, unscoped.
**Branch:** `main` — **zero open PRs**, board clear
**Test:** `cd apps/web && npx tsc --noEmit` (0 errors on merged main) · gates: `node --env-file=.env scripts/check-graph-{completeness,referential-integrity,attribution}.mjs`
**Pool health:** `psql ... -Atc "SELECT count(*) FILTER (WHERE state='active') FROM pg_stat_activity WHERE datname='postgres'"` — healthy is single digits. **Read 1 active / 49 idle at 08:25.**

### Now
[->] **Open `/clarity` in a browser and look at it.** Everything below it is verified; the visual result is the only thing left and no agent can reach it (Vercel SSO + admin gate). Then scope slice 3.

### This Session
- [x] **Closed the expensive-public-route audit** — the ledger's previous blocking item. Checked all 68 pages using `getServiceSupabase()`, including the six on the firewall rule. **No second exposure bug.** `/entity/`, `/entities/`, `/grants`, `/foundations/compare`, `/person/`, `/places/` are legitimately public and fan out 1–3 queries; gating them would be wrong.
- [x] **Cached nine public fan-out pages** (PR #206, `b7e37a5`) — `force-dynamic` → `revalidate = 3600` on pages with heavy service-role bursts and no per-request inputs. Worst were `/reports/data-health` (17 queries/hit), `/insights` (12), `/foundations/prf` (9).
- [x] **Merged slice 2** (PR #204, `0c19443`) — built by a parallel session, found open while the ledger said the board was clear.
- [x] **Retired slice 2's one "Not verified" claim.** Its author could not confirm the index rendered because of an 8-day PostgREST retry storm. Verified instead at the data layer: all 7 migrations applied, `v_clarity_board{,_cards}` + `v_clarity_ledger` exist as `security_invoker` with `service_role=r` and **no anon grant**; three questions `answered`/`verified`; stored headlines match the PR body exactly (85.1% · 773 · 2.8x); `clarity_object` 1,456 rows. **App read path tested through PostgREST with the service key: both views HTTP 200, first try, no retries.**

### Next
- [ ] **Look at `/clarity` in a browser** — dark theme, layout, search/facets, and the local admin bypass. Unreachable by any tool here.
- [ ] **Scope slice 3.** Slices 1 and 2 are done; 7 total were planned.
- [ ] **Enable Vercel Web Analytics.** Still off. It is the reason caller attribution failed twice; it would make the next incident diagnosable in minutes.
- [ ] **Rethink the per-IP rate limit.** The 20/60s `ip`-keyed rule did not hold against a distributed caller. Consider a JA4 key or a lower global cap.
- [ ] Job 13 (weekly tier, Sundays 15:00 UTC) has **never run**. Also unchecked: whether the four old `success-fallback` matviews sit in the weekly tier — if so job 13 inherits a known-flaky set unwatched. They were `mv_grant_contract_overlap`, `mv_indigenous_procurement_score`, `mv_lga_indigenous_proxy_score`, `mv_abr_name_lookup`.
- [ ] Deferred, all diagnosed and written up: 19 unwatched edge layers · runbook steps 3 (donor sink, 47,563 misattributed edges) and 5 (opportunity self-loops)

### Decisions
- **The `/foundations/backlog` bug shape splits into two problems, not one.** Exposure (a service-role review queue left public) is a gating problem and was unique to backlog. Uncached fan-out is a caching problem and was widespread. Applying the gating fix to public product surfaces would have been the wrong call. (#206)
- **`force-dynamic` needs a per-request reason.** Nine pages carried it while reading nightly matviews and taking no `searchParams`, `cookies()` or `headers()`. It bought nothing and cost a service-role query burst per anonymous hit. `/foundations` keeps it — it genuinely reads filter searchParams.
- A page that uses `getServiceSupabase()` belongs in `protectedPrefixes` **if it is a private surface**; if it is public, it belongs behind a cache. Backlog was the first, the nine were the second. (#205, #206)
- **Gate, don't cache** — for the private case. Caching backlog would have left anonymous traffic pointed at a service-role page.
- Mitigation belongs in code, not the firewall. The incident deny rule was removed once #205 was live.
- Headline is **1,039 relations**, not 1,455; 416 routines get their own segment. (#193) Coverage denominator is relations → **78%**.
- ACT excluded by default, count permanently on screen, **neutral not yellow** — a scope boundary, not a warning.
- Freshness has **four states that never collapse**: a date (687), `+` blue = missing timestamp column (294), `?` yellow = too large to probe (58), `—` n/a (416). (#195)
- Admin-gated, because the catalog enumerates our own anon-readable attack surface. (#196)
- `catalog_object_scope` is authoritative for `act_business`, bidirectionally.
- **A new function gets its ACL set in the same migration that creates it.** `clarity_apply_act_flag` kept PostgreSQL's default `EXECUTE` to `PUBLIC` while its four siblings were restricted. (#202)
- Slice 2's own calls, inherited: the three-card board deleted for the searchable index; DESIGN.md's March "No dark mode" marked **superseded for `/clarity` only**; local admin bypass now requires `NODE_ENV !== 'production'` **and** no `VERCEL`, with `requireAdminApi` deliberately not bypassed.

### Open Questions
- **UNCONFIRMED: does `/clarity` look right?** Data, grants and read path are all verified. The rendered page has still never been seen by a human or an agent. Vercel SSO blocks the preview even through the authenticated MCP fetch tool, and the admin gate sits behind that.
- **LIKELY RESOLVED: who was hammering `exec_sql`?** The 8-day retry storm (~10 req/s, 94% failing) and the pool-saturation incident look like the same anonymous traffic on `/foundations/backlog`. Pool went 41 → 1 connections after #205 and reads clean now. **Not proven** — the caller was never identified, and Postgres only ever saw PostgREST's loopback.
- OPEN, Ben's call: `person_roles` aggregates 334,152 individually-public ACNC records into one anon-readable endpoint. Each is public by law; the aggregate is a different artifact. A decision, not a defect.
- RESOLVED 15 Aug: jobs 4 and 11 both proven by direct test. Neither has still ever fired *via pg_cron itself*; first unattended runs were 17:00 and 18:00 UTC on 15 Aug — **worth checking whether they actually fired.**
- RESOLVED: the stale `.next/types` errors for `clarity/q/[slug]` were a parallel session's files in the working tree, not a fault. Gone since #204 merged.

### Workflow State
pattern: wayfinder map (issue #190, 8/8 tickets closed)
phase: slice 2 complete
total_phases: 7 slices
retries: 0
max_retries: 3

#### Resolved
- goal: "slice 2 shipped and merged" — done
- resource_allocation: balanced

#### Unknowns
- clarity_visual_result: **UNKNOWN** — never rendered for human eyes
- job_13_weekly_tier: UNKNOWN — never run, never exercised by hand
- cron_first_unattended_runs: UNKNOWN — jobs 4 and 11 due 17:00/18:00 UTC 15 Aug
- backlog_caller_identity: UNKNOWN — storm ended with the fix, caller never named
- other_route_exposure: **RESOLVED** — 68 pages audited, no second exposure bug

#### Last Failure
(none)

---

## Incident: shared-pool saturation, 15 Aug 2026

**Symptom.** Every project on the shared Supabase instance (`tednluwflfhxyucgwigh`) intermittently unreachable. Local pool monitor at **blip #902** across 8 days. `pg_stat_activity`: **40-41 active connections, all the same `exec_sql` RPC**, sustained.

**The trail, including the dead ends — they cost the most time:**

1. `pg_stat_activity` identifies *what* (40 concurrent `exec_sql`) but never *who*: every `authenticator` connection reports `client_addr = ::1/128`, because PostgREST runs on the Supabase host. **Attribution is impossible at the DB layer. Go to the HTTP side first next time.**
2. Killing the local dev server on 3013 changed nothing. Load was not local.
3. **Vercel runtime logs grouped by `requestPath` cracked it in one call** — `/foundations/backlog` = 10,694 hits in 2h, next busiest path 320. That is the tool that works.
4. Arithmetic tied it off: ~3.5 req/s × 8 RPCs/request ≈ the 40 observed connections.

**Everything red that session traced to this one cause** — 8 `entity-dossier` integration tests failing on 30s timeouts, and the Vercel build failing on four unrelated prerendered pages (`/atlas` + 3 youth-justice recipients) blowing a 60s ceiling. Both went green on retry once the pool drained. **A saturated pool looks like unrelated flaky failures everywhere.**

**The circular trap.** The fix could not deploy, because the build needed the DB and the DB was starved by the thing the fix would stop. Broken by mitigating *outside* the app: a Vercel Firewall path `deny`, which takes effect at the edge with no build.

**Tooling notes worth keeping:**
- `vercel firewall` did **not** exist in CLI 50.22.1; it does in **59.1.3**. Upgrade first.
- `vercel api -X PATCH -d '...'` returns **415** without an explicit `Content-Type: application/json`. Prefer the native `vercel firewall rules add --condition '{...}' --action deny --yes`.
- Firewall changes **stage as a draft**; nothing is live until `vercel firewall publish`. `vercel firewall diff` before publishing.
- Production domain is **`civicgraph.app`**. Direct curl probes are unreliable (429 / SSO interception) — verify via Vercel runtime logs grouped by `statusCode` instead.

**Timeline:** publish deny → **pool 41 → 1 active within 60s**. Build retried green in 5m. PR #205 merged `2f3e5fd`, prod deploy Ready 07:57Z. Deny rule removed and published. Post-removal logs: `/foundations/backlog` → `307` (auth redirect), 7 hits in 10 min vs ~2,100 per 10 min at peak.

---

## Context

### Where things live
- **The map**: `thoughts/shared/data-map/README.md` → then `VERIFICATION.md` (68 claims checked, 3 blockers found). Never act on `CANONICAL-DATA-MAP.md` without it.
- **Slice 2 source material**: `thoughts/shared/data-map/clarity/OPPORTUNITY-MAP.md` — 16 cross-sections, **9 already run for real** with numbers. Plus `BAR-CHECK.md` and `BAR-CHECK-CLOSURE.md`.
- **The spec**: `thoughts/shared/data-map/clarity/CLARITY-SPEC.md` (1,816 lines). Its scope corrections are in the closure doc.
- **The code**: `apps/web/src/app/clarity/` — 4 files, one client island.

### Hard-won facts that will save a session
- **The pooler drops long connections.** One operation per psql invocation; TCP keepalives (`?keepalives=1&keepalives_idle=20&...`) on anything over ~5 min. A chained psql call reports the **echo's** exit code, so a failure looks like success. There is no direct non-pooler host.
- **`pg_stat_user_tables.n_live_tup` is broken here** — reports 0 for a 2.5M-row table.
- **`LIMIT n` without `ORDER BY` is not a sample.** Two 20,000-row "samples" of the same dataset gave 0% and 34.2%; the exact answer was 16.9%.
- **Use `getDirectServiceSupabase()`**, never `getServiceSupabase()` — the latter sniffs the call stack for `/app/reports/` and returns a stub resolving every query to null.
- **PostgREST caps a page at 1,000 rows.** The catalog is 1,455. Without explicit pagination a ledger renders complete and is missing a third.
- **Read the producer before diagnosing the product.** Six confident readings were wrong this session; every one died within two minutes of opening the code that generated the number. Two would have caused damage.
- **Empty ≠ unused.** No drop verdict without grepping both `src` trees AND `pg_proc.prosrc`.
- **A merge rule keyed on identifier presence must also consider entity KIND.** The shadow merge nearly merged 1,209 people into companies and would have broken two derivations that resolve entities by name.
- **Table-level RLS auditing cannot see definer views.** That is how 1,618 bank transactions stayed public through a sweep that closed 48 policies. The re-audit query is in `migrations/2026-08-15-close-bank-statement-view-leak.sql` — run it after adding any view.

### The bar slice 2 has to clear
`BAR-CHECK.md`'s verdict on slice 1, and it still stands:

> Nothing on any screen answers a question about the world today; every screen audits our estate. There is no reason to open this on a Tuesday when nothing is broken.

Slice 2 is the fix. It is the half that makes `/clarity` Ben's rather than a competent data catalog anyone could buy.
