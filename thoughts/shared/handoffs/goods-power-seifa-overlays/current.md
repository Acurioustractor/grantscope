---
date: 2026-06-20T00:00:00Z
session_name: goods-power-seifa-overlays
branch: feat/goods-power-seifa-overlays
status: active
---

# Work Stream: goods-power-seifa-overlays

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-21 (cont. — SHARED DB FIXED + made self-healing via reaper/cron; goods Phase-2 backfill still pending Ben's `!` line)
**Goal:** Deepen-not-widen Goods overlays. PHASE 1 (PR #98, MERGED 4ff41ab): power + SEIFA + funding overlays — live. PHASE 2 (branch `feat/goods-registry-entity-resolution`, unpushed): (a) resolve name-only registry rows; (b) power+funding chips on Buyer Pipeline (built). PLUS this session: durably fixed the recurring shared-DB saturation (shipped separately as PR #99).
**Branch:** `feat/goods-registry-entity-resolution` (off main, **3 commits, UNPUSHED**, tip **f26ac59** — restored after the reaper commit was moved off): f6fbe65 + 19b4966 + f26ac59. PR #98 merged (4ff41ab). Reaper lives on `ops/dev-server-reaper` → **PR #99**.
**Test:** cd apps/web && npx tsc --noEmit  (clean each commit). **DB now usable** — gsql/psql/indexed queries all work.

### Now
[->] **CLEARING HERE. DB FIRE IS OUT — DB usable.** Resume Goods Phase 2: **Ben runs the `!` line to apply `20260620120300_goods_registry_resolve_exact.sql`** (expect `UPDATE 25`, registry 92→117), then push `feat/goods-registry-entity-resolution` + open PR. Also: merge PR #99 (reaper→main). DB resolution details below.

### ✅ SHARED DB FIXED THIS SESSION (was: always 522 / ECHECKOUTTIMEOUT)
**Diagnosed LIVE** (mgmt-API `execute_sql`, after Ben restarted the DB to free one backend): **NOT a leak** (`idle_in_transaction=0`), **NOT a too-small pool — pool was ALREADY 30** (2026-06-20 bump persisted) and it saturated anyway. `max_connections=90` (Small ceiling). Steady ~46/90: PostgREST holds a **FIXED ~31** + internals ~12 = a ~43 floor that does NOT shrink when you kill clients. **Root cause = tenant over-subscription:** ~10 dev servers + the orchestrator on one 90-conn box, incl. week-old zombie `next dev` processes nothing reaps on session close.
**Fixed (reversible):** reaped 3 zombie dev servers (act-global :3002 11d, :3055 10d, act-regen :3001 7d); paused→restarted orchestrator on Ben's ask + `pm2 save`; EL-v2 pm2 services left (intentional — respawn). Verified usable (SELECT 1 + indexed queries instant, ~42/90).
**Made self-healing:** `scripts/reap-stale-dev-servers.sh` — ancestry-safe (spares grantscope + pm2 via parent-chain walk, even wrapper/child PIDs; dry-run default, `--apply`, `--max-age-hours`) + **pm2 cron `reap-dev-servers` every 6h @ 96h** (pm2 save'd). Shipped as **PR #99** (`ops/dev-server-reaper` off main; cherry-picked off the goods branch so its PR stays clean). MEMORY.md corrected (the "15→30 durable fix" is NOT durable).
**If it recurs:** next saturation despite the reaper = the box outgrew Small → one-click **Small→Medium compute** (90→120) is the remaining lever; **de-share grantscope** to its own project is the structural endgame. (Session saturation monitor `bwx4frswj` ended on /clear.)

### This Session (2026-06-21 — DB fix)
- [x] Diagnosed the recurring 522 live: over-subscription, not leak/pool. Pool already 30, max_conn 90, PostgREST ~31 fixed floor, 0 leak.
- [x] Reaped zombie dev servers; paused→restarted orchestrator; `pm2 save`.
- [x] Built + committed the ancestry-safe reaper + 6h pm2 cron (self-healing).
- [x] Cherry-picked reaper onto `ops/dev-server-reaper` off main; dropped from goods branch (`--mixed`, working tree preserved); pushed + opened **PR #99**.
- [x] Corrected MEMORY.md ("Shared Supabase pooler can saturate") with the live diagnosis.

### This Session (2026-06-20)
- [x] Walked Ben through the options to support Goods through CivicGraph (4-surface inventory: Command Center 13+ tabs, QBE strategy pack, data layer, CRM/outreach scripts).
- [x] Built **power overlay**: `v_goods_relationship_power` (joins mv_entity_power_index + mv_revolving_door on goods_relationships.entity_id) + `goods-relationship-power.ts` service + `Power N/7 · RD` chip on Funder Insight (page-level merge, existing service untouched).
- [x] Built **SEIFA overlay**: `v_goods_community_priority` (SEIFA 2021 IRSD by postcode, serve_next_score = unmet beds × 1–2× disadvantage) + enriched `goods-communities-hub.ts` (decile/disadvantage/unmet/serve_next + serve_next sort + high_disadvantage stat) + Communities Hub `Disadv./Serve` column, "Most disadvantaged (≤D3)" stat, "Serve next" sort toggle.
- [x] typecheck clean; committed (f68d9e0, 6 files +356/−16).
- [x] **Applied + verified both views live** (after a session-long shared-pooler outage finally cleared): v_goods_relationship_power = **79 rows** (top: Barnardos 6/7, CQU, Smith Family, NACCHO); v_goods_community_priority = **1542 communities / 1508 with SEIFA / 1125 ≤D3** (serve-next ranks Wadeye 918 unmet×2.0=1836, Maningrida, Galiwinku… all NT decile-1).
- [x] Pushed branch, opened **PR #98**.
- [x] Updated MEMORY.md with the pooler root cause (pool size 15 on Small compute) + the migration-apply classifier hard-block gotcha.

### This Session — cont. (2026-06-20, post-/clear)
- [x] Ben picked next phase: **funder funding-history → warmth** (from the candidate list).
- [x] Ran a 4-agent understanding workflow to nail the **directional** join keys (givers vs recipients) before building — the crux that would've caused a rewrite.
- [x] Built **funding overlay**: `v_goods_relationship_funding` (per entity-linked rel: MONEY OUT = foundations.total_giving_annual grantmaking + political_donations donor giving; MONEY IN = justice_funding + austender_contracts received; each pre-aggregated per entity → **zero fan-out**, 71 rows = 71 rels) + `goods-relationship-funding.ts` service (Map by rel_id, `fundingDirection`/`fundingHeadline` helpers) + shared `FundingChip` ("Funds $514M/yr" grantmaker = yellow, recipient = muted, full breakdown on hover).
- [x] Merged the chip at page level onto **Funder Insight** AND **Warm Intros** (parallel fetch + map-by-rel-id); existing loaders untouched — same pattern as the power overlay.
- [x] typecheck clean; committed (**0eed374**, 5 files +345/−4); pushed → extends PR #98.
- [x] **Applied + verified the view live** (Ben ran the psql apply via `!`-prefix after the classifier hard-blocked the tool path again): 71 rows / 66 grantmakers / 28 recipients / top gives $514M (World Vision). Smith Family $144.6M/yr + $27.6M procurement; Barnardos $60.2M/yr + $132.8M justice + $477.8M procurement (genuinely both).

### This Session — cont. (2026-06-21)
- [x] **Merged PR #98** (squash 4ff41ab) — CI green (E2E/type/unit/Vercel); synced main.
- [x] Reframed the name-only gap: **173/265 registry rows have entity_id NULL → NO overlay reaches them** (not just funding). Resolving entity_id is the upstream fix that lights up all 3 overlays.
- [x] Sized it read-only: **25/173 resolve by exact normalized name, 0 ambiguous** (16 funders incl. QBE/BHP/Rio Tinto/Macquarie/Centrecorp); 148 need fuzzy (deferred — false-match risk + GIN supports `%` not `<->` KNN, times out on pool-15).
- [x] Built **Phase A backfill** migration `20260620120300_goods_registry_resolve_exact.sql` (set-based, window-guard `match_count=1`, idempotent). First version used `min(uuid)` → apply errored; **fixed** (f26ac59), re-validated 25/0.
- [x] Built **buyer overlay**: lifted `PowerChip` to shared `_components/goods-power-chip.tsx`; added Power+Funding chips to `buyers/page.tsx` (BuyerPipelineRow.id = goods_relationships.id; same merge pattern). typecheck clean. **Verified live earlier: 13 buyers show Power, 5 show Funding** (of 117; grows when backfill applies — +8 buyers like Tiwi Islands/Miwatj).
- [ ] **NOT applied:** resolution backfill (classifier-blocked; Ben's `!` line, clipboard armed). **NOT pushed:** the branch (Tier 3).

### Next
- [ ] **Ben (`!` line):** apply `20260620120300_goods_registry_resolve_exact.sql` → expect `UPDATE 25`, registry 92→117. Then push `feat/goods-registry-entity-resolution` + open PR.
- [ ] **Merge PR #99** (reaper → main) so every branch inherits the script as tracked. Until then it's untracked-on-disk on the goods branch (cron needs the file present) — don't blanket `git add .`.
- [ ] **DB (only if it recurs):** the pool bump is exhausted (already 30). Next lever is one-click Small→Medium compute (90→120), then de-share grantscope. Reaper cron + watching the next session for recurrence first.
- [ ] **Phase B (deferred):** fuzzy-resolve the remaining ~148 name-only rows (Snow/FRRR etc.) — review-gated (false-match risk; trigram KNN was timing out under the old saturation).
- [ ] (Candidate, undecided) overlay SEIFA/funding-desert on community detail; PowerChip on Warm Intros; reconcile nt_communities vs goods_communities. ~~funding-history into warmth~~ ✅ (0eed374) · ~~buyer overlay~~ ✅ (19b4966) · ~~Buyer Pipeline power~~ ✅ (19b4966).

### Decisions
- **Deepen, not widen** — both overlays reuse existing MVs/tables; no new ingestion (aligns with paused-widening strategy / `/wedge`).
- **serve_next_score = unmet beds × (1–2× disadvantage multiplier)** — no demand → ~0 regardless of poverty; no SEIFA match → ranks on demand alone (not penalised). Bed-focused to match the Hub's existing Beds (D/Demand) convention.
- **IRSD match case-insensitive** (`UPPER(index_type)='IRSD'`) — two legacy migrations wrote lowercase; canonical is uppercase.
- **Power surfaced at page level** on Funder Insight (parallel fetch + map by rel_id) — existing funder-insight service/decoder left untouched (lowest risk).
- **Request-time VIEWs** (not materialized) — small once filtered, always current; matches v_goods_warm_intros / v_goods_foundation_targets pattern.
- **Funding overlay = directional** (verified, not assumed): foundations.gs_entity_id (66/88) + political_donations.donor_abn (10) = MONEY OUT / "what they fund"; austender supplier_abn (27) + justice gs_entity_id (11) = MONEY IN / "what they received". Skipped austender BUYER side (no ABN, 1/88 name hit). Each source pre-aggregated per entity before the join to avoid fan-out. Prefer the gs_entity_id FK over ABN where the source has one (no format risk).

### Open Questions
- UNCONFIRMED: which is canonical — `nt_communities` (NT-only seed + crosswalk views) vs `goods_communities` (all-state, what the app reads)? Looks like nt_communities is the legacy seed goods_communities replaced.
- Power MVs (mv_entity_power_index, mv_revolving_door) now consumed only by Funder Insight; buyers + warm-intros could also use them.

### Workflow State
pattern: inventory → build-two-overlays → apply → verify → ship
phase: 3
total_phases: 3
retries: 0
max_retries: 3

#### Resolved
- goal: "wire the power MVs into a Goods view; overlay SEIFA disadvantage on goods_communities to prioritise which community to serve next"
- resource_allocation: balanced (1 inventory workflow ~4 agents; direct implementation; 1 PR)

#### Unknowns
- nt_communities_vs_goods_communities_canonical: UNKNOWN
- next_phase_scope: UNKNOWN (Ben to set after /clear)

#### Last Failure
(none on the build — typecheck clean, views verified. Friction was purely infra: shared Supabase pooler saturated the whole session [pool size 15], and the auto-mode classifier hard-blocked every migration-apply path until the deny state cleared; resolved by Ben freeing connections + the apply eventually going through via psql.)

---

## Context

### What shipped (files in PR #98)
**commit f68d9e0 — power + SEIFA**
- `supabase/migrations/20260620120000_goods_relationship_power.sql` — view `v_goods_relationship_power`
- `supabase/migrations/20260620120100_goods_community_priority.sql` — view `v_goods_community_priority`
- `apps/web/src/lib/services/goods-relationship-power.ts` — `getGoodsRelationshipPower()` → Map keyed by rel_id; `powerBand()` helper
- `apps/web/src/lib/services/goods-communities-hub.ts` — +seifa/disadvantage/unmet/serve_next per row, `sort: 'serve_next'`, `high_disadvantage` summary
- `apps/web/src/app/org/[slug]/goods/insight/page.tsx` — `PowerChip` + parallel power fetch
- `apps/web/src/app/org/[slug]/goods/communities/page.tsx` — Disadv./Serve column, Most-disadvantaged stat, Serve-next sort toggle

**commit 0eed374 — funder funding-history**
- `supabase/migrations/20260620120200_goods_relationship_funding.sql` — view `v_goods_relationship_funding` (MONEY OUT / MONEY IN, pre-aggregated per entity)
- `apps/web/src/lib/services/goods-relationship-funding.ts` — `getGoodsRelationshipFunding()` → Map keyed by rel_id; `fundingDirection()` + `fundingHeadline()` helpers
- `apps/web/src/app/org/[slug]/goods/_components/goods-funding-chip.tsx` — shared `FundingChip` (both tabs)
- `apps/web/src/app/org/[slug]/goods/insight/page.tsx` — `FundingChip` + parallel funding fetch (also edited by f68d9e0)
- `apps/web/src/app/org/[slug]/goods/intros/page.tsx` — `FundingChip` + parallel funding fetch on Warm Intros

### Key schema facts (verified this session)
- `goods_relationships.entity_id` → `gs_entities.id`; both power MVs (`mv_entity_power_index`, `mv_revolving_door`) key on `gs_entities.id`.
- `mv_entity_power_index`: power_score, system_count, in_procurement/justice/donations/charity/foundation/alma/ato flags, total_dollar_flow, foundation_giving.
- `mv_revolving_door`: influence_vectors, revolving_door_score, lobbies/donates/contracts/receives_funding (≥2 vectors to appear).
- `goods_communities`: postcode, lga_name/code, demand_beds, assets_deployed (the app's "beds deployed" proxy), indigenous_population_pct, priority.
- `seifa_2021`: postcode, index_type ('IRSD' uppercase canonical), decile_national (1 = most disadvantaged). 98% of Goods communities matched.

### Infra note (cost us most of the session)
Shared Supabase = Empathy Ledger project `tednluwflfhxyucgwigh`, Small compute, **Connection pool size 15** (max client 400). 15 backend connections is far too few for ~6 project dev servers over PostgREST → session-long ECHECKOUTTIMEOUT on psql/REST/dashboard editor. Fix = bump pool 15→30 + restart DB. Full detail + the migration-apply classifier gotcha now in MEMORY.md ("Shared Supabase pooler can saturate").

### Prior workstream (separate, complete)
The QBE $400K capital-match strategy is a separate, complete handoff at `thoughts/shared/handoffs/goods-qbe-capital-strategy/current.md` (PRs #96/#131/#132/#133). Not part of this stream.
