---
date: 2026-06-20T00:00:00+10:00
session_name: goods-qbe-capital-strategy
branch: main
status: active
---

# Work Stream: goods-qbe-capital-strategy

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-20
**Goal:** Turn CivicGraph foundation/power data into an actionable capital strategy for the Goods on Country **$400K QBE match** (close ~AU$400K signed match-eligible by **31 Aug 2026**). Strategy pack is now committed; the site-copy + data fixes that fell out of it are **SHIPPED to production and live-verified**. Remaining = Ben's day-shift outreach only.
**Branch:** main. grantscope: strategy pack merged via **PR #96** (`7ad1b03`). Goods website: **PRs #131/#132/#133** merged to goodsoncountry/goods-asset-tracker main, all live on **www.goodsoncountry.com**.
**Test:** n/a (research/strategy + copy). Asset-figure validation: `cd "/Users/benknight/Code/Goods Asset Register/v2" && node --env-file=.env.local scripts/check-asset-drift.mjs` (READ-ONLY).

### Now
[->] Nothing in progress — clean stopping point. All staged/mechanical items shipped + live-verified. Only Ben's day-shift outreach remains.

### This Session (2026-06-20 — executed the parked items)
- [x] **grantscope PR #96 (MERGED, `7ad1b03`)** — committed the QBE strategy pack: 5 docs in `thoughts/shared/strategy/` + 2 GHL scripts (`fix-goods-ghl-opps.mjs`, `create-sefa-ghl-opp.mjs`).
- [x] **goodsoncountry PR #131 (MERGED + LIVE)** — "Assembled on Country" copy fix; dropped all present-tense "Manufactured On-Country" claims (hero / footer / CTA) + reframed two manufacturing eyebrows as aspirational. Verified live.
- [x] **goodsoncountry PR #132 (MERGED + LIVE)** — impact-map reconciliation: added Darwin (1) + Canberra (2) to `communityLocations` so the map shows all **9 communities / 496 beds**, matching the published figure + the register. Reversed the documented "intentionally omitted" decision (Ben's call); minimal factual pins, no invented narrative. Verified live on /communities.
- [x] **goodsoncountry PR #133 (MERGED + LIVE)** — aligned storyteller subtitles to "**32 storytellers across remote Australia**" (was "33 across 8" / "15 across 6"); dropped stale `staticBedCount` flags on Mount Isa + Kalgoorlie (register now tracks them). Verified live on homepage.

#### Prior session (2026-06-19 — strategy creation, executed above)
- [x] 6-doc strategy pack built via 3 background workflows; CRM fixes applied live in GHL by Ben (PRF rename, SEFA debt opp re-created). Detail in the strategy docs + Context below.

### Next
- [ ] **DAY-SHIFT / human-in-loop — Ben sends the outreach** (do NOT auto-send): Snow first (the signal) → SEFA term-sheet push → Centrecorp June board → Minderoo LOI. Notes in `goods-qbe-tier1-outreach-notes.md`.
- [ ] (Optional, future) Remaining storyteller-coverage tidy + the `canon cleared-voices = 6` vs display-pool 32 tier question, if a different public number is ever wanted.

### Decisions
- **Site copy: "Assembled on Country"** — assembly on Country is true today; component manufacturing is the goal the raise funds (0 beds assembled in-house). Never claim manufacturing.
- **Map shows all 9 communities** — Darwin + Canberra added (Ben's "map all 9" call), matching the "9 communities / 496 beds" published everywhere. **Canberra = 2 deployed beds** (corrected from the prior ledger's "1"). Minimal factual pins only — respect the codebase's documented anti-fabrication guardrail.
- **Storyteller count = 32** (canonical cleared-voice display pool per `check-story-coverage.mjs`); subtitles use "across remote Australia", not a precise community count.
- **goodsoncountry deploy model**: PR → merge to main → Vercel auto-deploy (prod = www.goodsoncountry.com). Safe edit pattern = worktree off origin/main + symlinked deps; local `next build` fails on the symlink (Turbopack), so the build-time assertion is gated by the hermetic CI "Drift guards + tests" job + the Vercel preview build.
- **External CRM writes require Ben's explicit `!` run** — auto-mode blocks autonomous GHL writes; respected.

### Open Questions
- UNCONFIRMED: Is **"El" (VFFF contact) the same person as Eloise Hall** (Tier-2 impact investor)? Flagged so briefs don't merge/split them wrongly.
- **GUARDRAIL before sending the Snow note**: the earlier draft asserted bed numbers are "reconciled/closed out" — live DB does NOT support that; don't reintroduce until genuinely reconciled.
- Fabrications the verify passes caught (never reintroduce): **SEFA CEO is Hanna Ebeling, NOT Ben Gales**; a fake Muir quote; "Mong Do"→Linh Do; Raphael Arndt not current.

### Workflow State
pattern: research-then-align-then-execute → ship (4 PRs shipped 2026-06-20)
phase: complete
total_phases: 3
retries: 0
max_retries: 3

#### Resolved
- goal: "power-mapped capital strategy for the Goods $400K QBE match, aligned to who we've already engaged, linked to website + stories — then ship the mechanical fixes"
- resource_allocation: aggressive (ultracode; 3 workflows ~83 agents on 2026-06-19) + direct execution (4 PRs 2026-06-20)
- canberra_on_impact_map: RESOLVED — Ben chose "map all 9"; Darwin + Canberra now on the map (shipped #132; Canberra = 2 deployed beds)

#### Unknowns
- el_vs_eloise_hall: UNKNOWN (same person?)

#### Last Failure
(none — clean. Self-caught + fixed mid-session: a `staticBedCount`-removal line-collapse formatting glitch fixed before commit; a stale `/tmp/pr-body.md` reused for PR #131's body, corrected via REST PATCH.)

---

## Context

### The keystone (what everything serves)
Goods on Country is 1 of 10 in QBE Foundation's **Catalysing Impact** (with Social Impact Hub). Stage-2 prize: up to **AU$400K** ($150K floor), discretionary, **must be ≥1:1 matched by external commitments**, **repayable preferred**, verified at the **Sept 2026** application, decided Nov. Goal: first **~AU$400K of SIGNED match-eligible commitments by 31 Aug 2026**. **0 signed today.** SIH path: Prospect→EOI→LOI→Term Sheet→Funding Agreement. SIH contact Jay Boolkin.

### Match-math reality (verified vs live `ghl_opportunities`)
Live funder pipeline = **"Goods Supporter Journey"** (49 opps, ~$5.18M), but **~$4.0M is QBE ($2M) + REAL/DEWR ($2M)** = EXCLUDED from match. Warm match-eligible grant **asks** (all unsigned): Snow $402,930 (stewarding), Minderoo $200K (ask made), The Funding Network $130K, Centrecorp $123,332, FRRR $50K (one joint $50K with VFFF — count once). SEFA = highest match value (repayable) but was **dormant** (last contact Sept 2025) → re-created the opp this session. Tier-3 repayable gap = the real scarce search (First Australians Capital, SVA/SEDIF, Conscious Investment, IBA).

### Capital stack (reconciled 2026-06-13)
AU$900K–1M blended non-equity: ~$500K grants (junior) + up to $400K QBE match (catalytic) + ~$300K SEFA debt (senior). First use of funds: **$60–80K 50-bed in-source run** (turns the ~$426 unit-cost claim from MODELLED to MEASURED; 0 beds assembled in-house yet).

### Live asset register truth (project cwsyhpiuepvdjtxaozwf, `assets` table)
520 raw bed rows, but **496 genuinely deployed** (quantity-summed, `status='deployed'`). The 24 difference = ~20 Alice Springs beds built-for-outstations (`ready`, correctly excluded), Canberra 2 `demo`, Mutitjulu 1 `allocated`, +1 misc. Deployed = 133 Stretch + 363 Basket, 2660kg plastic (Stretch×20), 9 served / 10 distinct communities. `resolve-live-map.ts` counts deployed+allocated only (correct). The static `communityLocations` map was stale (showed 7); now reconciled to all 9 (PR #132).

### Source-of-truth pointers
- CivicGraph DB (grantscope): `node --env-file=.env scripts/gsql.mjs "..."`. Funder pipeline tables: `ghl_opportunities`, `ghl_contacts`, `ghl_pipelines`, `fundraising_pipeline`, `funder_briefs`, `goods_communities`, `goods_content_library` (84 consent-cleared published stories).
- Goods website source = `/Users/benknight/Code/Goods Asset Register/v2` (Next.js). Canonical asset figures: `src/lib/data/asset-canonical.ts`. Asset register Supabase: cwsyhpiuepvdjtxaozwf (creds in v2 `.env.local`). Deploys via PR → main → Vercel (prod www.goodsoncountry.com); repo = `Acurioustractor/goods-asset-tracker`.
- Notion (Ben-auth only): QBE operating plan `380ebcf981cf819cac62f51dd9532e84`; Investor alignment tool `380ebcf981cf814ca724c12a01016467`; Tier-1 letters `380ebcf981cf81cfa9d1e21327880348`; 12 diagnostic-area pages (IDs in `goods-qbe-artifact-map.md` / the relationship-history doc).
- 8 hard claim-guardrails for ALL funder-facing output: see `goods-funder-relationship-history.md` (0 signed; hold $741,111 until accountant-signed; no "match unlocked"; no settled DGR/entity language; lead with verified proof 496 beds/9 communities/QR-tracked/~20kg plastic-per-bed).
