# Dirty Working Tree Inventory — 2026-04-24

**Branch when captured:** `codex/goods-civicgraph-signoff` @ `5f41f32` (after `chore: gitignore stale artifacts`)
**Snapshot branch:** `wip/working-tree-snapshot-2026-04-24` (all WIP committed there)
**Total uncommitted before snapshot:** 267 files (down from 330 after Stream 1 gitignore)
**Diverged from `origin/main`:** ~14,738 insertions / 3,256 deletions across 112 modified files plus 155 new files

This inventory groups the WIP into feature buckets so you can carve real branches off the snapshot one feature at a time.

---

## Feature buckets (largest first)

### 1. misc-app — homepage, marketing, lib (34 files)
Top-level page edits + new lib/ utilities. Includes new pages: `funding-workspace/`, `goods-intelligence/`, `goods-workspace/`, `portfolio-control/`, `rankings/`, `snow-foundation/`. Modified: `layout.tsx`, `page.tsx`, `pricing/`, `login/`, `register/`, `power/`, `tender-intelligence/`, `justice-reinvestment/`. New libs: `alert-attribution`, `alert-events`, `alert-link-tracking`, `alert-performance`, `app-url`, `auth-redirect`, `billing-link-tracking`, `grant-alert-digests`, `grant-notifications`, `grant-scout`.

### 2. scripts-misc — pipeline + seeding scripts (29 files)
Modified: `gsql.mjs`, `health-check.mjs`, `backfill-embeddings.mjs`, `lib/agent-registry.mjs`, `lib/psql.mjs`, `create-org-dashboard-tables.sql`. New: ACT seed scripts (`seed-act-*.mjs/sql`), `bittensor-money-model.mjs`, `check-grant-semantics-health.mjs`, `check-grant-source-identity-health.mjs`, foundation-program-year promoters (Ecstra, Ian Potter, Minderoo, PRF, Rio Tinto), 2 migration SQL files.

### 3. grant-engine — packages/grant-engine (28 files)
Source-engine refactor + 17 new council/local-government grant source modules (Brisbane, Central Highlands, Charters Towers, City of Sydney, Cookshire, Darwin, Fraser Coast, Lockyer Valley, Logan, Noosa, Redland, Scenic Rim, Sunshine Coast, Tablelands, Toowoomba, Whitsunday). Plus tests/ directory.

### 4. home-reports — board reports + new report pages (25 files)
Modified: `home/board-report/`, `home/home-client.tsx`, `home/page.tsx`, `home/report-builder/`, `home/watchlist/`, `reports/picc/`, `reports/youth-justice/`, `reports/data-health/`, `reports/page.tsx`. New report pages: `civicgraph-thesis/`, `grant-frontier/`, `reallocation-atlas/`, `why-grant-search-is-not-enough/`, plus youth-justice trackers/sites/qld sub-pages.

### 5. docs-thoughts — strategy + outreach docs (25 files)
Bittensor planning, GrantScope testing pack, master portfolio operating model, philanthropy execution plan + blueprint, Snow empathy ledger operating system, civicgraph editorial/empathy/investor/thesis/VC memos, outreach interview script + pilot plan. Modified: 360giving-australia, snow-foundation handoffs (5 files).

### 6. tracker-profile — tracker, profile, ops, charities, navigation (14 files)
Modified pages: `charities/`, `clarity/`, `entity/[gsId]/`, `for/corporate/`, `for/philanthropy/`, `ops/health/`, `ops/`, `profile/matches/`, `profile/`, `tracker/kanban-board.tsx`, `tracker/tracker-client.tsx`. Modified components: `nav.tsx`, `workspace-page-header.tsx`. New: `ops/layout.tsx`.

### 7. foundations-pages (12 files)
Modified: foundation index + `[id]/`, giving-chart, prf. New foundation routes: `backlog/`, `compare/`, `ecstra/`, `ian-potter/`, `minderoo/`, `review-set/`, `rio-tinto/`, `public-review-route.tsx`.

### 8. grant-frontier-scripts (12 files)
Discovery + sync + scrape pipeline modifications: `discover-foundation-programs`, `grantscope-discovery`, `import-gov-grants`, `massive-import-run`, `pipeline-runner`, `scout-grants-for-profiles`, `scrape-foundation-grantees-all`, `scrape-state-grants`, `sync-foundation-programs`, `sync-source-frontier`. New: `grantscope-signoff.mjs`, `reconcile-grant-source-identity.mjs`.

### 9. org-project-foundations (11 files)
**Includes 5 unversioned migrations** (`20260420152000_org_project_foundations.sql`, `..._foundation_research.sql`, `..._engagement_status.sql`, `..._foundation_interactions.sql`, `..._followup_fields.sql`). New: `/api/goods-workspace/`, `org-admin-list-client.tsx`. Modified org page + components.

### 10. alerts — full alerts subsystem (10 files)
Modified: `alerts/page.tsx`, alerts API routes (`[id]`, `matches`, root). New: alert sub-routes (`deliver/`, `digest/`, `notifications/`, `scout/`, `track/`), `lib/profile-alerts.ts`.

### 11. mission-control (10 files)
7 modified MC API routes (discoveries, query, registry, schedules, tasks). New: `/api/mission-control/frontier/`, `/api/mission-control/runtime-sweeps/`, `mission-control/layout.tsx`.

### 12. data-files (10 files)
Untracked data dumps: `data/acnc/`, `data/aihw/`, `data/annual-reports/`, `data/grantconnect/`, `data/ndis/{first-nations,participants-by-lga}-dec2025.csv`, `data/prf-reports/`, `data/state-procurement/`, `data/tracker-evidence/`, plus `apps/web/data/aihw/`. *(Likely gitignore candidates — large data files.)*

### 13. billing — Stripe + product events (9 files)
Modified billing API (checkout, portal, webhook), `lib/stripe.ts`, `lib/subscription.ts`. New: `/api/billing/track/`, `lib/product-events.ts`, `lib/product-events-client.ts`, `lib/start-checkout.ts`.

### 14. validation-pilots (7 files)
Modified ops API (claims, health, root). New: `/api/ops/pilots/`, `/api/ops/validation-reviews/`, `lib/pilot-participants.ts`, `lib/validation-reviews.ts`.

### 15. briefing-generator — new feature, all untracked (7 files)
New `briefing/` page + 6 briefing-* components.

### 16. data-api (5 files)
Modified `/api/data/route.ts` and `/api/data/data-health/route.ts`. New: `/api/data/board-power/`, `/api/data/catalog/`, `/api/data/rankings/`.

### 17. root-doc — top-level markdown (4 files)
`GRANTSCOPE_SIGNOFF.md`, `OPERATING_PLAN.md`, `PILOT_SESSION_BRIEFS.md`, `PILOT_TESTING.md`.

### 18. bittensor (4 files)
Bittensor integration spec + money engine plan + money model JSON + outreach messages.

### 19. auth-continue (2 files)
New `/auth/` and `/continue/` routes.

### 20. Singletons
- `package.json` — adds scripts: `preflight`, `signoff`, `signoff:full`, `branch:check`, `bittensor:money-model`, `grant:frontier:snapshot` (plus possibly more)
- `apps/web/public/favicon.ico` — favicon change
- `supabase/migrations/20260420161000_org_applicant_entities.sql` — applicant entities migration
- `supabase/migrations/20260422192542_ghl_sync_status_guard.sql` — GHL sync guard
- `supabase/migrations/20260424091500_normalize_grant_opportunity_sources_jsonb.sql` — grant source normalization

### 21. Uncategorized
- `.claudeignore` — config file, untracked
- `ecosystem.config.js` — pm2 config, untracked
- `test-mission-counts.mjs` — looks like a stray test/script

---

## Suggested carve order (by risk and ship readiness)

1. **Migrations first** — the 7 untracked migrations (`org_project_foundation*`, `org_applicant_entities`, `ghl_sync_status_guard`, `normalize_grant_opportunity_sources_jsonb`) need to be reconciled with prod state before anything that depends on them lands.
2. **Data file gitignore** — bucket 12 is mostly large data drops; decide what's source vs artifact.
3. **Self-contained features**: `briefing-generator` (bucket 15, all new), `bittensor` docs (bucket 18, docs only), `grant-engine` council sources (bucket 3, mostly new files).
4. **Subsystem upgrades**: `alerts` (10), `billing` (9), `validation-pilots` (7), `mission-control` (10), `data-api` (5).
5. **Cross-cutting**: `home-reports`, `tracker-profile`, `foundations-pages`, `org-project-foundations`, `misc-app` — touch many shared files; merge order matters.
6. **Scripts last** — depend on schema changes from step 1.

---

## How to use this inventory

The snapshot branch `wip/working-tree-snapshot-2026-04-24` has all 267 files committed in a single WIP commit. To carve a real branch:

```bash
git checkout -b feat/<feature> main
git checkout wip/working-tree-snapshot-2026-04-24 -- <path1> <path2> ...
git commit -m "feat: <feature>"
```

Or to view what changed for a specific bucket vs main:
```bash
git diff main wip/working-tree-snapshot-2026-04-24 -- <path-prefix>
```
