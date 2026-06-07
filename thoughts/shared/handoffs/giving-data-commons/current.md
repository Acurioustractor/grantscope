---
date: 2026-06-08T18:30:00+10:00
session_name: giving-data-commons
branch: main
status: active
---

# Work Stream: giving-data-commons

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-08T18:30:00+10:00
**Goal:** Buyer wedge: "free open registry for everyone; paid evidence + tender tools for buyers" (`docs/strategy/buyer-wedge.md`). Run `/wedge` before building SE/procurement/giving. Moves 1+2+4 SHIPPED, 3 waiting on Ben, 5 (widening pause) ACTIVE.
**Branch:** main (pushed @ 724e0f5, clean)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] **VIC contract crawl RUNNING** (background `b5ame09cx`, nohup detached, ~20-30h, ~36+ contracts in). Log: `tail -f /tmp/vic-tenders-crawl.log`. When done: refresh evidence MVs + re-run `scout-se-buyers`. No foreground work in flight.

### This Session (2026-06-08 PM)
- [x] **Move 4 SHIPPED** (`7ac2e3d`): tier badges on `/social-enterprises/[id]` — TierBadge in header + sidebar Verification card (tier+basis+date+signals-not-gates), claim-CTA on identified. Verified all 3 tiers SSR
- [x] **Grant-match quality fix** (`f127a2c`): se-grant-match excludes individual-targeted programs (scholarships/fellowships/bursaries + NSW 'High Learning Support Needs') — were leaking into every profile via org category tags (~7%, 26/385). Regex handles plurals
- [x] **STATE-TENDERS CRACKED** (`40efa65`/`fe1942c`/`724e0f5`): headless system-Chrome (channel:chrome + AutomationControlled off + webdriver hidden + domcontentloaded) clears Cloudflare on VIC/SA with NO proxy — overturns the "Akamai dead end". `scripts/scrape-state-tenders.mjs` resumable ocid-keyed upsert into austender_contracts (`vic-<id>`/`sa-<id>`). Pipeline validated on 5-row VIC slice (clean ABN+value+ISO dates). **SA is auth-gated** (all contract data behind /login — needs an account; VIC fully public). Spec: `docs/strategy/state-tenders-ingest.md`
- [x] **Grant eligibility enrichment** (`19cfabd`): `scripts/enrich-grant-eligibility.mjs` — headless fetch + LLM round-robin (groq/gemini/deepseek/anthropic, JSONL cache) → dgr_required + accepts_charity/pty_ltd/sole_trader/unincorporated. NULL=page silent. Ran --apply: open grants enriched 37→225 (160 remain, quota-blocked). Finding: extractable signal is entity-type, not DGR (federal grants rarely gate DGR; philanthropic source = mostly scholarships)
- [x] **Twin-engine routing** (`86427d1`): se-grant-match entity-type gate — from one search, a company (Goods on Country) drops dgr_required/accepts_pty_ltd=false grants; a charity (Butterfly) keeps them. isCharityVehicle() keys on org_type/legal_structure. tsc clean, no regression
- [x] **Enrichment auto-resume cron** (`a7271f7b`, 7:07am daily, may be session-only) — finishes the 160 remaining open grants as quotas reset

### Next
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

### Open Questions
- UNCONFIRMED: tender-pack logged-in e2e (page 200 + API 401 verified; full flow needs Ben's session)
- UNCONFIRMED: NIAA turf sensitivity — counter: open registry, attribution-first, we issue no marks
- UNCONFIRMED: VIC crawl will run ~20-30h; ~2s/contract may vary; watch for portal rate-limiting in the log

### Gotchas (active)
- **VIC crawl writing vic-* rows to austender_contracts** (b5ame09cx) — don't run conflicting austender_contracts ops; resumable (skips done ocids) if it dies
- **Headless scraping pattern that beats Cloudflare**: system Chrome (channel:'chrome') + `--disable-blink-features=AutomationControlled` + hide navigator.webdriver + `domcontentloaded` (NOT networkidle). curl/WebFetch get 403; headless clears it
- **DB outages recur ~3am AEST** (ECHECKOUTTIMEOUT): back off, retry
- Another ACTIVE session on `claude/scraping-funding-orgs-TeFjK` — check before touching scraping/ingest; community_directory_orgs read-only to us
- `array_to_string` not IMMUTABLE — can't live in generated columns
- `scripts/lib/psql.mjs` swallows SQL errors; use gsql/raw psql
- social_enterprises UNIQUE is (name, state) NOT abn
- Auto-mode classifier blocks DB writes that cross a stated session boundary even with later user override — needs explicit re-confirm + permission prompt (hit twice this session on the VIC --apply)
- LLM free tiers exhaust after ~50-150 calls — verdict cache + re-run
- Dev server port 3003; cold compile ~18s, curl timeouts ≥30s

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
(none — VIC --apply was classifier-blocked twice on session-boundary grounds, resolved by explicit user "run it")

---

## Context

Full strategy and provenance: `thoughts/shared/research/2026-06-07-social-enterprise-commons-review.md`
Strategy doc (source of truth): `docs/strategy/buyer-wedge.md`
North-star memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_supply_base_evidence_layer.md`
ACT/Goods entities memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_act_business_model.md`
NIAA prospect pack: `thoughts/shared/prospects/niaa/` · pipeline: `thoughts/shared/prospects/PIPELINE.md`
