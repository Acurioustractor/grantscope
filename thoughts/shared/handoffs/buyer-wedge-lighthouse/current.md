---
date: 2026-08-08T01:25:00Z
session_name: buyer-wedge-lighthouse
branch: feat/state-tender-evidence
status: active
---

# Work Stream: buyer-wedge-lighthouse

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-08T01:25:00Z
**Goal:** Buyer-wedge move 3 — land ONE government buyer using a tender-pack in a real procurement. Done when a buyer is in a live procurement with our evidence, not when another pack is built.
**Branch:** feat/state-tender-evidence (6 commits, pushed, **no PR opened**)
**Test:** `cd apps/web && npx tsc --noEmit && npx vitest run`

### Now
[->] Nothing running. Paused by Ben to start a different session. The next decision is
whether to crawl VIC DJCS (~65 min) or stop building packs and start outreach.

### This Session
- [x] **PR #174 MERGED** to main as `0891569` — NSW DCJ pack + scout dedupe fix, CI green
- [x] Fixed `scout-se-buyers.mjs` — deduped ABN lookup on the whole tuple, not the ABN. 527
  duplicate registry rows fanned the join out. **DSS read $10,862M vs a true $3,983M (2.7x)**
- [x] NSW DCJ chosen as lighthouse buyer; pack built at `thoughts/shared/prospects/nsw-dcj/`
- [x] QLD unblocked — 199,671 `state_tenders` rows now dated from source filenames
- [x] Scout now unions `state_tenders`, stamps `evidence_basis`; pool 417 → 438 buyers
- [x] VIC scraper hardened: `$1` sentinel, field precedence, `--buyer-id`, challenge polling
- [x] VIC crawl shortlist built (`docs/strategy/vic-crawl-shortlist.md`) — not crawled
- [x] SA account created + session saved/verified, then found SA publishes **no ABNs**
- [x] Privacy fix: supplier_name was ingesting named contacts' emails and phones

### Next
- [ ] **DECISION FIRST, not a task:** build a third pack (VIC DJCS) or start outreach?
  Two packs exist and neither has been sent. NIAA has been demo-ready since 2026-06-09.
  Building more packs does not move toward a paying buyer; outreach does.
- [ ] If crawling VIC DJCS: `node --env-file=.env scripts/scrape-state-tenders.mjs --state=VIC --apply --buyer-id=320019`
  (~65 min, resumable). Then re-run `scout-se-buyers.mjs --apply` and refresh evidence MVs.
  Expect ~300 SE-matched contracts (measured 12% hit rate on the existing 25-row DJCS sample —
  a planning estimate from a small non-random sample, could be half or double).
- [ ] Open a PR for `feat/state-tender-evidence` (6 commits, pushed, none opened yet).
- [ ] NSW DCJ pack needs from Ben: recipient, and whether the Aboriginal Procurement Policy 3%
  angle or the sub-$150K reporting gap leads. Then a tender-pack against a named live procurement.
- [ ] NIAA pack figures are stale (2026-06-09). Current: 134 SE / 109 cert / 367 contracts /
  $78.5M. Refresh before sending.

### Decisions
- **NSW DCJ over federal or VIC/SA.** The planning doc's fork was false: `austender_contracts`
  is misnamed and carries NSW eTender rows, so state buyers were always in the pool. NSW DCJ:
  91 SE suppliers, 383 contracts, $3,692.2M, 61 of 91 ORIC/Supply Nation registered ($1,164.1M).
  Trade accepted: NSW has policy targets, not VIC's mandated SPF weightings.
- **Disclosure dates are "disclosed as at", never "awarded on".** QLD backfill writes
  `published_date` = END of the disclosure period parsed from the filename. `awarded_date` stays
  null because we do not know it. `evidence_basis` on `se_buyer_prospects` keeps the two kinds
  of evidence from being quoted as equivalent.
- **VIC's `$1.00` means withheld, not one dollar.** Published as a sentinel for Genuinely
  Confidential Business Information. Nulled and counted per run; ingesting it would understate
  every VIC aggregate.
- **SA is dead for the ABN-keyed pitch.** No supplier ABNs published (0 of 10 sampled across
  3 agencies). Name matching produced 2 confident false positives in 6 (Centacare →
  "Novacare Community Services", TCB Transport → "FIRST TRANSPORT"), each attaching a real ABN
  and verification tier to the WRONG org. Unsafe for buyer-facing material. SA can support a
  hand-curated list only — human work, cost it as such.
- **Never ingest the contractor block raw.** It carries postal addresses and named contacts with
  work emails/phones, including a deactivated staff account.

### Open Questions
- UNCONFIRMED: the 12% VIC DJCS SE hit rate is from a 25-row, most-recent-first sample. Verify
  early in any crawl and kill it if it comes in thin.
- UNCONFIRMED: whether DCJ publishes its own social-procurement/APP figures. If it does, theirs
  is authoritative and the pitch leads with the difference, not our number.
- Ben's call outstanding: NSW DCJ recipient + lead angle.

### Workflow State
pattern: diagnose-then-fix
phase: 4
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "work move 3 — land one lighthouse buyer"
- resource_allocation: aggressive
- lighthouse_buyer: NSW Department of Communities and Justice
- vic_crawl_scope: shortlist first, do not crawl all 316 agencies

#### Unknowns
- next_move: UNKNOWN — third pack vs outreach. Ben paused here.
- sa_viability: RESOLVED — no ABNs, hand-curation only

#### Last Failure
(none — tsc clean, 550 tests passing, PR #174 CI fully green)

---

## Context

### Repo state
- `main` at `0891569` (PR #174 merged, deployed).
- `feat/state-tender-evidence`: 6 commits ahead of main, pushed to origin, **no PR**.
  1. `89a3a06` QLD dates + state buyers in the pool
  2. `070f44c` VIC scraper `$1` sentinel + precedence
  3. `f161774` VIC crawl shortlist + `--buyer-id`
  4. `e8f0f9a` SA mapped + challenge polling fix
  5. `17b9e9e` SA authenticated crawling
  6. `dd67150` SA publishes no ABNs + privacy fix
- `fix/ledger-classifier-note` still exists locally; its content landed via the #174 squash.
  Safe to delete, needs Ben's word.

### Things that will bite the next session
- **`austender_contracts` is misnamed.** It holds 6 jurisdictions by `source_url` host:
  QLD 57,349 · NT 22,740 · NSW 14,429 · TAS 6,893 · VIC 4,891 · ACT 3,827. Not federal-only.
  SA is the only jurisdiction genuinely absent.
- **Any `se_buyer_prospects` figure from before 2026-08-08 is inflated.** Re-derive it.
- **`se_buyer_prospects.states` lists where the SUPPLIERS are, not the buyer.** Misreading this
  as buyer coverage is what hid the state buyers for two months.
- **SA session** saved at `data/state-tenders/sa-auth.json` (gitignored). Works, but SA has no
  ABNs so it buys little.
- **VIC agency index** regenerate with `--agencies-only` (gitignored, ~20s, no bulk crawling).
- Playwright login windows appear as a SECOND Chrome app instance — not in the normal Chrome
  window list, find via Cmd+Tab or Mission Control.

### Key artefacts
- `thoughts/shared/prospects/nsw-dcj/` — one-pager, email-draft, notes, provenance sidecar
- `thoughts/shared/prospects/niaa/` — built 2026-06-09, demo-ready, figures stale
- `thoughts/shared/prospects/PIPELINE.md` — both packs + blocked jurisdictions
- `docs/strategy/vic-crawl-shortlist.md` — VIC tranches + full SA findings
- `docs/strategy/state-tenders-ingest.md` — platform mechanics
- `docs/strategy/buyer-wedge.md` — move 3 amended with the NSW DCJ decision
- `scripts/backfill-state-tenders-dates.mjs` — new, filename→period parser

### Tier boundaries respected
Nothing sent to any buyer. No SA data written to the database. Outreach remains Tier 3 and
human-only; both packs still need `/ground` and `/act-voice` before anything ships.
