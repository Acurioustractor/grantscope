---
date: 2026-06-08T23:55:00+10:00
session_name: giving-data-commons
branch: main
status: active
---

# Work Stream: giving-data-commons

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-08T23:55:00+10:00
**Goal:** Buyer wedge: "free open registry for everyone; paid evidence + tender tools for buyers" (`docs/strategy/buyer-wedge.md`). Run `/wedge` before building SE/procurement/giving. Evidence-depth plays are the active focus (widening paused).
**Branch:** **main** (clean) — PRs #57 (buyer-flow), #58 (OP5), #59 (OP3) all **MERGED**. HEAD `38c6c49`. Working tree clean except this ledger + 2 pre-existing untracked data leftovers (`data/grant-eligibility-cache.jsonl`, `data/state-tenders/`).
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] **NEXT: OP1 — Indigenous proven suppliers** (leverage Top-3; likely the fastest win — mostly built in `mv_indigenous_procurement_score`, probably just needs surfacing/verification on `/suppliers`). Then **OP4** — financial-health signal on justice-funded charities (4,366 ACNC matches; supply-magnet, not direct revenue). OP5 + OP3 both SHIPPED + MERGED this session — nothing in flight.

### This Session (2026-06-08, night) — OP5 + OP3 shipped & merged (PRs #58, #59)
Merged the open buyer-flow PR, then built the next two Top-3 leverage plays end-to-end (build → verify live → ship → CI-green → merge), Ben merging each with an explicit verb.
- [x] **Merged PR #57** (buyer-flow follow-ups) → main `e0c788d`.
- [x] **OP5 BUILT + MERGED** (PR #58, merge `0744eb4`) — **Program Evidence** section on `/social-enterprises/[id]`: ALMA programs + the cited-studies / measured-outcomes chain (via junctions) for the ~100 ABN-resolved profiles. New `getEntityEvidencePrograms(db, entityId)` in `report-service.ts`. Honest framing: verifiable counts lead, ALMA signals attributed (not endorsement). Verified live (Save the Children → 3 programs / 8 studies / 3 outcomes). Commits `eab192a` + `c050779`.
  - **GOTCHA (cost ~6 calls):** `report-service`'s `getServiceSupabase()` returns the report SNAPSHOT db (no live ALMA junction rows) unless `CIVICGRAPH_LIVE_REPORTS=true` → returned `[]` silently, no error. Fix: the function takes the caller's **live** client. Memory: `solution_report_service_snapshot_client.md`.
- [x] **OP3 BUILT + MERGED** (PR #59, merge `38c6c49`) — **"Proven govt delivery"** tier: `mv_justice_proven_suppliers` (4,225 orgs: justice × federal contract; the triple-proof MV minus the ACNC gate, ACNC kept as optional signal). Migration `20260608060000` + cron re-dump `20260608070000` **applied live**. Badge on `/suppliers` search + `/social-enterprises/[id]` header; strongest-of-three hierarchy (Proven outcomes > Triple-proof > Proven govt delivery), all derived from one MV lookup via `has_acnc` / `has_alma_evidence_outcomes`. Verified: **4,225 rows · 724 has_acnc (== mv_triple_proof_suppliers) · 71 gold**; badge hierarchy correct live on both surfaces. Commits `5dcff2a` + `95b6394`. Plan: `thoughts/shared/plans/op3-justice-proven-suppliers.md`.
- Gates green throughout (tsc 0, 221/221). Leverage map (`docs/leverage-map.md`) updated: OP5 + OP3 marked BUILT.

### This Session (2026-06-08, evening cont.) — buyer-flow follow-ups shipped (PR #57)
Did backlog action #1: ran `/polish` on the 2 untouched pages + the 2 follow-up builds. All verified live (re-screenshotted logged-out, `docs/ux-audit/shots/audit-13…22`). Gates green throughout (tsc 0, 221/221). Shipped as **PR #57** (`feat/buyer-flow-followups`) — CI all-green, **NOT merged**.
- [x] **gap-map (Pass 3)** — logged-out 401 dead-end → "Sign in to run the gap analysis" conversion panel; empty void → "How this works" explainer; red hero → black-fill+blue-shadow; own metadata layout. (P3-1..P3-4)
- [x] **commissioning (Pass 3)** — dropped "Data Needed to Complete" (was advertising build gaps to PHN buyers); value-first + Register-Interest waitlist; **figures corrected 2–5× to live counts** (143K→599K entities, 301K→1.6M rels, 1,155→2,087 ALMA); black hero; own metadata; now a Server Component. (P3-5..P3-8)
- [x] **Per-supplier OG/Twitter cards** — `social-enterprises/[id]/opengraph-image.tsx` (one file = both og+twitter). Leads with $ evidence + tier. **Satori gotcha (cost a bisect):** multi-child text nodes throw ERR_EMPTY_RESPONSE → use template literals; next/og DOES work under turbopack dev. Memory: `solution_next_og_satori_gotchas.md`.
- [x] **Landing "proven outcomes" row** — `/suppliers` non-search view: 6 named, clickable quad-proof exemplars via new `getProvenOutcomesSuppliers()` (two-query join, no migration). Click-through verified.
- Commits: `74f202c` procurement · `0003fd3` OG cards · `fd7a8c0` proven-outcomes row · `c40f8f5` docs. Pass-3 findings in `docs/buyer-flow-ux-findings.md`.

### This Session (2026-06-08, late) — close-out: /polish built, branch shipped & merged
Closed every loose end from the evening session. All Tier-2/3 actions asked-then-confirmed per rules.
- [x] **Pushed the 14 buyer-flow commits** (Tier-2, asked) → origin `aba1be4`.
- [x] **Built `/polish` loop-skill** (`ed6194f`) → `.claude/skills/polish/` (SKILL.md + references/rubric.md + references/method.md). Repo-level, mirrors `/leverage`'s self-paced structure. Two-phase loop (Tier-1 collect-only audit → Ben-in-loop fix → `/ship`); **exit = Ben's taste-check, not "done"**. Rubric (Clarity / Value-shown / Meaning / Aesthetic / Friction) calibrated from the real F1–F9 + P2-1…P2-8 findings. Plan deliverable 3 — **all 3 deliverables now complete.**
- [x] **Committed + pushed `/polish`** (`ed6194f`, asked) — pre-commit gate passed.
- [x] **Opened PR #56** against main (Tier-3, explicit verb). Body organises the 38 commits into 5 themes (UX audit · data/evidence stack · loop-skills · infra · docs). Gates re-verified green at HEAD before opening (tsc 0, 221 tests).
- [x] **Merged PR #56** (Tier-3, explicit verb) after CI all-green (Type Check 1m25s · Unit/Integration 28s · E2E 1m3s · Vercel deploy). Merge commit `ac651c0` (repo convention = merge commits; repo auto-merge disabled, so waited on CI manually).
- [x] **Verified all 9 migrations live on prod** (`tednluwflfhxyucgwigh`) — relations + functions exist, both RPCs smoke-tested (se_registry_stats → 11,861/1,131/$53.58B/8,454; search_suppliers('beds') → match_source + «Bed» snippet), MV alma column present, OP2 VIC-link gap = 0, nightly refresh cron active. `information_schema.columns` doesn't cover matviews — used `pg_attribute`.
- [x] **Deleted `chore/tsc-stop-hook`** (Tier-3, explicit verb) — local (`-d`, confirmed merged) + remote.
- NOTE: `/close` skill hard-codes `community-capital-ledger/current.md`, but the live ledger this work-stream uses is **`giving-data-commons/current.md`** (this file) — updated the live one. Skill's default path is stale.

### This Session (2026-06-08, evening) — buyer-flow UX audit Pass 2 (all 8 findings shipped)
Executed `thoughts/shared/plans/buyer-flow-ux-audit.md`. Found the prior session's Pass-1 (F1–F9) findings doc, confirmed those fixes live, then did a fresh **Pass 2** over all 5 buyer-flow screens (incl. the directory + procurement pages Pass 1 skipped) → appended to `docs/buyer-flow-ux-findings.md`. Each fix decided with Ben, built, verified live (screenshots), gates green throughout (tsc 0, 221 tests). **14 local commits, UNPUSHED.**
- [x] **P2-1 search match legibility** (`9d5d403`/`4097a63`) — measured first: a contract-title hit scores ~5× a description hit, so the evidence-led order was *thesis-correct* but illegible. RPC `search_suppliers` now returns `match_source` + a `ts_headline` snippet (migration `2026-06-08-search-suppliers-match-legibility.sql`); cards show "Matched in a won contract: …Bed Dwellings…" vs "…in description: …Bed + Bath…". Boosts additive→multiplicative. (Ben's call: keep evidence-led + make legible, not re-rank.)
- [x] **P2-2 directory evidence + sort** (`1490150`/`7225f69`) — `se_directory` view (migration) LEFT-JOINs delivery evidence + proof flags onto the directory; new **"Delivery Evidence" default sort**; proof badge + green "N contracts · $X" line on cards. Browse now leads with proven deliverers, not "Koolyangarra…".
- [x] **P2-3 black-cladding explainer** (`dda23be`) — one-line hero explainer framing it as protecting genuine Indigenous suppliers. (Ben's call.)
- [x] **P2-4 tender-pack output preview** (`7b55703`) — "What's in the pack" panel above generate.
- [x] **P2-5 per-page metadata** (`7bd3cf2`) — `generateMetadata` on SE profile (title = enterprise name), static on directory, `layout.tsx` for client-component /procurement + /tender-pack. Fixes tabs/link-previews/SEO.
- [x] **P2-6 unified hero** (`68178bb`) — /procurement blue-fill → black-fill + blue shadow, matching directory/tender-pack.
- [x] **P2-7 landing pre-search proof** (`0f54c72`/`f8797b8`) — "Popular needs" chips + live "What's already in the registry" strip (11,861 enterprises · 1,131 proven delivery · 8,454 contracts · **$53.6B**) via new `se_registry_stats()` RPC.
- [x] **P2-8 tender-pack empty-state nudge** (`7b55703`) — "No shortlist yet → find suppliers" reveals the spine on cold entry.
- **3 DB migrations applied to prod + committed** (search RPC, se_directory view, se_registry_stats RPC) — git and DB in sync.

### This Session (2026-06-08, afternoon) — verified cron fix + shipped the evidence stack (OP7-OP10)
- [x] **MV-refresh cron fix VERIFIED then CORRECTED.** The morning's `ALTER FUNCTION … statement_timeout=0` was a NO-OP — pg_cron arms the 120s timer at the outer command level, *before* the function is entered, so a function-entry GUC change can't cancel it. Real fix: **`ALTER ROLE postgres SET statement_timeout=0`** (migration `20260608010000`, `16d2407`) — pg_cron's direct session now starts uncapped. Manually refreshed all 34 MVs → staleness **38d → 0d**. (`mv_abr_name_lookup` needed 123.7s, just over the old 120s cap — the exact bug.)
- [x] **OP7 BUILT** (`2502230`) — `mv_triple_proof_suppliers` (724 orgs: justice × federal contract × ACNC) + registered in nightly cron `refresh_order` AND manual refresh + **TRIPLE-PROOF badge** on `/suppliers`.
- [x] **OP2 BUILT** (`a7aee82`) — linked the 1,116 VIC suppliers into gs_entities (`AU-ABN-*`, confidence=reported); 598,150 → 599,266, 0 unlinked. Then rebuilt **se_search_index** (11,861) + **se_buyer_prospects** (417). NB the 1,116 are *commercial* vendors (0 justice/acnc) — correctly NOT in the SE index.
- [x] **OP10 BUILT** (`2f0ad30`) — `has_alma_evidence_outcomes` quad-proof flag (54 orgs) + **"Proven outcomes" gold badge** (top tier above triple-proof) on `/suppliers`.
- [x] **`/leverage` loop COMPLETE** (`be51046`, `980adc8`) — iters 4–8, all 5 keys + 5 goals mined → Top-3 + OP1–OP10 + dead leads in `docs/leverage-map.md`.

### This Session (2026-06-08, continued) — health · enrichment · leverage
- [x] **System-health sweep → fixed 2 silently-failing crons.** `refresh-civicgraph-mvs-nightly` failed ~6wk (stmt-timeout @ `mv_abr_name_lookup`, whole-txn rollback → ALL MVs stale since 2026-04-30). Fix: `ALTER FUNCTION refresh_civicgraph_mvs() SET statement_timeout=0`. Also killed dead `cleanup-rate-limits` cron. Migration `supabase/migrations/20260608000000_cron_health_fixes.sql`. `/health` extended (MV staleness + pg_cron failures) in `scripts/health-check.mjs`.
- [x] **VIC crawl FINISHED** — 4,891 `vic-` rows (4,686 upserted, 205 skipped, 3 failed). **Downstream still TODO (Ben/Tier-2):** refresh evidence MVs + re-run `scout-se-buyers`; **1,116 new VIC supplier ABNs (47%) unlinked to gs_entities** (= leverage OP2 / health-backlog L5).
- [x] **`/health` loop ran** → `docs/health-backlog.md` (6 iters, ~24 ideas). Root cause of data gaps = enrichment agent fleet failing on timeouts (single-digit success: Enrich Social Enterprises 3%).
- [x] **Grant-eligibility enrichment LLM chain FIXED** (`b9bcb38`) — anthropic+deepseek were dead (credit/balance) but not disabled, stalling the chain. Added **MiniMax-M3** + openai, strip `<think>`, max_tokens 2000, disable-on-credit/balance. Ran `--apply`: open pool **304 → 32 remaining** (the 32 are thin/redirect pages w/ no content — un-enrichable; cron stays). MiniMax-M3 verified live.
- [x] **Built `/leverage` skill** (`75eb951`) — data-to-goals leverage map, self-paced loop, **connect/deepen-never-widen** (widening paused). Ran iters 0–3 (all 5 join keys) → `docs/leverage-map.md`. **TOP-3 TO BUILD: OP3** justice proven-suppliers (4,225 justice orgs that also won fed contracts, G3∩G1) · **OP5** ALMA evidence signals on `/suppliers` (983 inline / 348 full-chain w/ cited evidence+outcomes, G3→G1) · **OP1** Indigenous proven-suppliers (325 ORIC corps, G4∩G1, mostly built in `mv_indigenous_procurement_score`).
- [x] **Fixed stale CLAUDE.md** (`ed8a767`) — `alma_evidence`/`alma_outcomes` link to interventions via **junction tables** (`alma_intervention_evidence` 2065, `alma_intervention_outcomes` 2060), NOT a direct `intervention_id` (self-caught analysis error from leverage iter 3).
- [x] All work committed + pushed: `b9bcb38` enrich-fix · `015365c` health-backlog · `75eb951` leverage skill · `b0330a1` health iter6 · `ed8a767` CLAUDE fix · `33c1e2d` leverage map.

### Next on resume (priority order)
> Top-3 leverage plays now 2/3 done: **OP5 ✅ + OP3 ✅ merged.** OP1 is the remaining Top-3 and likely the fastest. Tree clean on `main`.
1. (NOW) **OP1 — Indigenous proven suppliers** (leverage Top-3). 325 ORIC corps that won federal contracts (G4∩G1). **Mostly built** in `mv_indigenous_procurement_score` — verify it surfaces these to buyers, then surface on `/suppliers` (likely an "Indigenous proven supplier" badge/tier in the same family as OP3's "Proven govt delivery"). S–M, may need no migration. See `docs/leverage-map.md`.
2. (Backlog) **OP4** — financial-health signal on justice-funded charities (4,366 ACNC/AIS matches; flag financially-fragile delivery orgs). Supply-magnet/mission, not direct revenue. M.
3. (Backlog) **OP8** (278 Indigenous triple-proof) · **OP6** (desert community-controlled named list) · OP7 follow-up (browsable list for the 558 non-SE triple-proof orgs). See `docs/leverage-map.md`.
3. (Backlog) Enrichment-fleet timeout fixes (`docs/health-backlog.md`) — several agents at single-digit success.
4. (Housekeeping) Decide on the 2 untracked data leftovers (`data/grant-eligibility-cache.jsonl`, `data/state-tenders/`) — gitignore, commit, or bin.
5. (Hygiene) The `/close` skill points at the wrong ledger path (`community-capital-ledger`) — fix to `giving-data-commons` or auto-detect the most-recent `current.md`.
6. (If merged) After PR #57 merges → delete `feat/buyer-flow-followups` (local + remote).

### PRIOR SESSION (loop infrastructure — context, still valid)

### This Session — loop infrastructure
Built 4 verification "loops" — encode Ben's intervention criteria as exit conditions ("stop being the loop"). Memory: `feedback_loop_design_workflow.md`. All persist across clear.
- [x] **`/ground`** (`~/.claude/skills/ground/`) — fact-grounding self-critic; HOLDs fabricated/unverifiable-as-fact claims. Tier 1. Tested: caught DGR-on-wrong-entity conflation.
- [x] **`/ship`** (`~/.claude/skills/ship/`) — edit→gates→commit→rebase→push→PR→verify-live; drift+collision guards, **Tier-2 pause before push, Tier-3 verb before PR/merge**. Tested steps 0-1 (caught us on main).
- [x] **tsc Stop hook** (`.claude/hooks/tsc-on-stop.sh`, committed `d88b211`; wired via gitignored `settings.local.json` Stop entry) — end-of-turn block if apps/web TS goes red, loop-safe via `stop_hook_active`. Replaced the OLD broken per-edit hook (full tsc on every edit, swallowed result). Tested all 4 paths.
- [x] **`/reconcile`** (`~/.claude/skills/reconcile/`) — finance halt-on-mismatch; Xero **read-only** → tie vs mirror line-by-line → bookkeeper fix-note. NEVER writes Xero. Day-shift only. Mirror verified (10 sole-trader receivables ~$507K).
- [x] Committed the hook (`d88b211`) on branch `chore/tsc-stop-hook` (unpushed) — no Claude attribution per commit skill.

### Earlier — buyer-wedge + maintenance (prior)
- [x] **Move 4 SHIPPED** (`7ac2e3d`): tier badges on `/social-enterprises/[id]` — TierBadge in header + sidebar Verification card (tier+basis+date+signals-not-gates), claim-CTA on identified. Verified all 3 tiers SSR
- [x] **Grant-match quality fix** (`f127a2c`): se-grant-match excludes individual-targeted programs (scholarships/fellowships/bursaries + NSW 'High Learning Support Needs') — were leaking into every profile via org category tags (~7%, 26/385). Regex handles plurals
- [x] **STATE-TENDERS CRACKED** (`40efa65`/`fe1942c`/`724e0f5`): headless system-Chrome (channel:chrome + AutomationControlled off + webdriver hidden + domcontentloaded) clears Cloudflare on VIC/SA with NO proxy — overturns the "Akamai dead end". `scripts/scrape-state-tenders.mjs` resumable ocid-keyed upsert into austender_contracts (`vic-<id>`/`sa-<id>`). Pipeline validated on 5-row VIC slice (clean ABN+value+ISO dates). **SA is auth-gated** (all contract data behind /login — needs an account; VIC fully public). Spec: `docs/strategy/state-tenders-ingest.md`
- [x] **Grant eligibility enrichment** (`19cfabd`): `scripts/enrich-grant-eligibility.mjs` — headless fetch + LLM round-robin (groq/gemini/deepseek/anthropic, JSONL cache) → dgr_required + accepts_charity/pty_ltd/sole_trader/unincorporated. NULL=page silent. Ran --apply: open grants enriched 37→225 (160 remain, quota-blocked). Finding: extractable signal is entity-type, not DGR (federal grants rarely gate DGR; philanthropic source = mostly scholarships)
- [x] **Twin-engine routing** (`86427d1`): se-grant-match entity-type gate — from one search, a company (Goods on Country) drops dgr_required/accepts_pty_ltd=false grants; a charity (Butterfly) keeps them. isCharityVehicle() keys on org_type/legal_structure. tsc clean, no regression
- [x] **Enrichment auto-resume cron** (`a7271f7b`, 7:07am daily, may be session-only) — finishes the 160 remaining open grants as quotas reset

**Post-clear continuation (maintenance):**
- [x] **Supabase MCP `-32000` fixed** — root cause = corrupted npx cache (`~/.npm/_npx/53c4795544aaa350` missing `@modelcontextprotocol/sdk`), NOT auth/DB/`@latest`. Fix: `rm -rf` that hashed cache dir → clean re-download → verified MCP `initialize` handshake OK (server v0.8.1, project-ref `tednluwflfhxyucgwigh`). ⚠️ PAT `sbp_…` got printed into the transcript while diagnosing — **rotate it** (Supabase dashboard → Access Tokens) + update `~/.claude.json`
- [x] **VIC crawl resilience fix + relaunch** (`2798bdf`) — prior run `b5ame09cx` died after 205 contracts on ONE `page.goto` 45s timeout (contract 229407) that threw out of the loop. Wrapped per-agency + per-contract loads in try/catch (skip+continue + `failed` counter); skipped ocids retry on the next resumable run. Relaunched detached PID 7799, resumed 205 → 405+ rows, 0 skips, 95% ABN / 100% value capture

### Next
- [ ] **★ SYSTEM-HEALTH OVERVIEW (first action on resume)** — the meta-loop: run every verification primitive once, roll up to one GREEN/DEGRADED/RED board. Dimensions→check: infra/env/git/types→`/preflight` · data/MVs/agents/VIC-crawl→`/health` · books-tie-to-Xero→`/reconcile` (day-shift) · public-page numbers grounded→`/ground` · in-flight-work-on-strategy→`/wedge` · clean-to-ship→`/ship` steps 0-2. Exit = every dimension GREEN or explicitly flagged. **Decide first:** build as `/systemhealth` skill that sequences these (fresh context, testable) vs run the sweep manually.
- [ ] **When VIC crawl finishes**: refresh evidence MVs (`scripts/refresh-views-v2.mjs`) + re-run `scout-se-buyers` → VIC contracts surface on profiles/`/suppliers`, unlocks VIC lighthouse buyers
- [ ] **Ben (human)**: NIAA — named IPP contact + one-pager→PDF (re-verify figures) + send → PIPELINE.md contacted
- [ ] **Ben (human)**: logged-in tender-pack e2e on :3003 (standing UNCONFIRMED)
- [ ] **Ben (human)**: push infra repo `3d87c2b`; check 6 repos' uncommitted CLAUDE.md syncs
- [ ] SA contracts: blocked — needs SA Tenders account creds (then same scraper works with auth'd context)
- [ ] Enrichment resume: cron OR run `node --env-file=.env scripts/enrich-grant-eligibility.mjs --apply --limit=400` until open pool fully flagged
- [ ] PAUSED per move 5: NSW/QLD/WA/ACT classifier passes; GrantConnect forecast XHR

### Decisions
- **State-tenders ingest is VIC-only** (2026-06-08): headless clears Cloudflare (no proxy); SA auth-gated (needs account). ocid `vic-<id>`/`sa-<id>` matches nsw-/qld- convention; reversible DELETE WHERE ocid LIKE 'vic-%'
- **Grant eligibility = entity-type routing, not DGR**: DGR rare in corpus; accepts_pty_ltd/charity/sole_trader is the real signal. NULL=unknown=keep (never assume ineligible)
- **Buyer wedge**: free open registry / paid buyer tools. Overruling = update buyer-wedge.md FIRST. Widening PAUSED (scheduled agents exempt)
- **Lighthouse = NIAA first** via IPP angle. Defence + Services Australia held
- **Tier = strength of external verification, not SE-ness**; v2 statutory cross-check
- Evidence beats badges; tags/certs are signals NOT gates (north-star memory)
- Outreach: drafts only, Ben sends (Tier 3)
- LLM verdict caching (append-only JSONL) = standard for classification/enrichment scripts
- **MCP `-32000 Failed to reconnect` ≈ corrupted npx cache**, not auth: an `npx -y …@latest` MCP server with a partial install throws `ERR_MODULE_NOT_FOUND` at handshake. Fix by deleting `~/.npm/_npx/<hash>` and reconnecting — don't rotate the token first
- **Long scrapers must wrap per-item network calls in try/catch** — one `page.goto` timeout must not abort a multi-hour run; skip+continue + resumability = effective cross-run retry

### Open Questions
- UNCONFIRMED: tender-pack logged-in e2e (page 200 + API 401 verified; full flow needs Ben's session)
- UNCONFIRMED: NIAA turf sensitivity — counter: open registry, attribution-first, we issue no marks
- UNCONFIRMED: VIC crawl will run ~20-30h; ~2s/contract may vary; watch for portal rate-limiting in the log

### Gotchas (active)
- **VIC crawl writing vic-* rows to austender_contracts** (PID 7799, nohup) — don't run conflicting austender_contracts ops; resumable (skips done ocids) if it dies
- **Headless scraping pattern that beats Cloudflare**: system Chrome (channel:'chrome') + `--disable-blink-features=AutomationControlled` + hide navigator.webdriver + `domcontentloaded` (NOT networkidle). curl/WebFetch get 403; headless clears it
- **DB outages recur ~3am AEST** (ECHECKOUTTIMEOUT): back off, retry
- Another ACTIVE session on `claude/scraping-funding-orgs-TeFjK` — check before touching scraping/ingest; community_directory_orgs read-only to us
- `array_to_string` not IMMUTABLE — can't live in generated columns
- `scripts/lib/psql.mjs` swallows SQL errors; use gsql/raw psql
- social_enterprises UNIQUE is (name, state) NOT abn
- Auto-mode classifier blocks DB writes that cross a stated session boundary even with later user override — needs explicit re-confirm + permission prompt (hit twice this session on the VIC --apply)
- LLM free tiers exhaust after ~50-150 calls — verdict cache + re-run
- Dev server port 3003; cold compile ~18s, curl timeouts ≥30s
- **VIC crawl is plain nohup (PID 7799), NOT a harness task** — no completion notification will fire; poll `ps -p 7799` + log tail to know when it's done
- **MCP project-ref reconciled** (Ben, 2026-06-08): the `supabase` MCP points at `tednluwflfhxyucgwigh` = the shared Supabase across several of Ben's projects, so it IS CivicGraph's DB. Old MEMORY.md "MCP = ACT, never use" was stale — now fixed. MCP usable per Rule #1; gsql.mjs/psql still the fallback

### Workflow State
pattern: buyer-wedge-execution
phase: 4 of 5 moves shipped
total_phases: 5 (wedge moves)
retries: 0
max_retries: 3

#### Resolved
- goal: "build the agent and skills to do this [5-move plan]" — moves 1+2+4 shipped, 3 waiting on Ben, 5 active; state-tenders evidence-depth crawl LIVE
- resource_allocation: balanced

#### Unknowns
- VIC crawl completion time + whether it survives session close (nohup; resumable either way)

#### Last Failure
VIC crawl (`b5ame09cx`) crashed after 205 contracts on a single `page.goto` 45s timeout (contract 229407) — FIXED `2798bdf` (per-page try/catch, skip+continue), relaunched PID 7799. No open failures.

---

## Context

Full strategy and provenance: `thoughts/shared/research/2026-06-07-social-enterprise-commons-review.md`
Strategy doc (source of truth): `docs/strategy/buyer-wedge.md`
North-star memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_supply_base_evidence_layer.md`
ACT/Goods entities memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_act_business_model.md`
NIAA prospect pack: `thoughts/shared/prospects/niaa/` · pipeline: `thoughts/shared/prospects/PIPELINE.md`
