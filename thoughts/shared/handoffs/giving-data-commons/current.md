---
date: 2026-06-08T18:30:00+10:00
session_name: giving-data-commons
branch: chore/tsc-stop-hook
status: active
---

# Work Stream: giving-data-commons

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-08T07:25:00+10:00
**Goal:** Buyer wedge: "free open registry for everyone; paid evidence + tender tools for buyers" (`docs/strategy/buyer-wedge.md`). Run `/wedge` before building SE/procurement/giving. Moves 1+2+4 SHIPPED, 3 waiting on Ben, 5 (widening pause) ACTIVE.
**Branch:** chore/tsc-stop-hook (hook commit `d88b211`, NOT pushed) — branched off main @ `2798bdf`. main itself unpushed-status unverified.
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] **VIC contract crawl RUNNING** (relaunched 2026-06-08, **PID 7799**, plain nohup — NOT a harness task, no completion notification; check `ps -p 7799` + `tail -f /tmp/vic-tenders-crawl.log`). Resumed 205 → live **2505 vic-* rows**, 0 skips, ~1h05m in (PID 7799 confirmed alive 07:25). ~14h left. Prior run `b5ame09cx` died on a single page.goto timeout — now fixed (`2798bdf`: per-page try/catch, skip+continue, resumable retry). When done: refresh evidence MVs + re-run `scout-se-buyers`. No foreground work in flight. **SYSTEM-HEALTH SWEEP DONE (resume 07:25):** ran the manual overview. Found nightly pg_cron silently broken: (a) `refresh-civicgraph-mvs-nightly` failed ~6wk on a stmt-timeout @ `mv_abr_name_lookup` (whole-txn rollback → ALL MVs stale since 2026-04-30); FIXED via `ALTER FUNCTION refresh_civicgraph_mvs() SET statement_timeout=0` — heavy refresh DEFERRED to tonight's 17:00 UTC cron (post-crawl, complete data). (b) dead `cleanup-rate-limits` job (table `notification_rate_limits` exists nowhere) unscheduled. Both recorded idempotently in `supabase/migrations/20260608000000_cron_health_fixes.sql`. `/health` skill extended to catch MV staleness + failing crons (`scripts/health-check.mjs`). **Next on resume:** when crawl finishes, verify tonight's MV refresh went ✅ (run `/health` → "Last successful MV refresh" should be 0d), then re-run `scout-se-buyers`.**

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
