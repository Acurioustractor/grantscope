---
date: 2026-08-06T12:30:00+10:00
session_name: one-desk-domain-model
branch: main
status: active
---

# Work Stream: one-desk-domain-model

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-06T17:30:00+10:00
**Goal:** Wayfinder map #143 — One Desk domain-model extension (People, Obligations, surface delineation). MAP COMPLETE — all 12 tickets resolved. Specs in docs/specs/ (one-desk-widened, people-surface, delivery-surfaces, backfill-prompt-list). Way is clear: build sessions execute the specs (build order in backfill-prompt-list.md).
**Branch:** main (all decisions committed+pushed through 0d832ff)
**Test:** docs-only so far; cd apps/web && npx tsc --noEmit when build starts

### Now
[->] Map #143 done. Next: build sessions — 1) We-owe tab + mint modal (mismatch off), 2) triage sitting with Ben (day shift), 3) desk widening + /people, enable mismatch rows

### This Session
- [x] #145 Person entity — deliberate-minting, typed roles (works-at/board-of/decides-for/opens-into), warmth+warm-via, GHL SoR (ADR 0002)
- [x] #146 opens dual-level — Person `opens-into` + institutional Org `opens`; Org views roll up "via Jay"
- [x] #147 Obligation — one entity, owed-to funder/community; human-minted (Won prompts, never auto); Open→Done/Dropped
- [x] #148 Watch-items — NOT an entity; Person next action + mandatory review-by date
- [x] #149 Surface delineation — desk widens to 5 row kinds; money/delivery/org-wide People (/org/act/people) surfaces
- [x] #150 Desk row shapes — Ben picked Variant B (→ funder/community tag; via <holder>); "commitment" kind folds into `we owe`; branch prototype/desk-row-shapes
- [x] #151 Data trust — Obligations Supabase-NATIVE; GHL=relationship truth, Supabase=work truth (ADR 0003)
- [x] #152 Thresholds — Obligations: overdue/≤30d/undated-always; People: review-by ≤7d
- [x] Fog graduated: #156 migration/backfill ticket created (prompt list, NOT bulk import)

### Next
- [x] #153 UX spec widened One Desk — RESOLVED, spec at docs/specs/one-desk-widened-ux-spec.md (interleaved pool, undated-obligations pin, any-kind hero, header owed/people counts)
- [x] #154 UX spec People surface — RESOLVED, spec at docs/specs/people-surface-ux-spec.md (replaces /contacts, full mint flow, split pane)
- [x] #155 UX spec Delivery surfaces — RESOLVED, spec at docs/specs/delivery-surfaces-ux-spec.md (We-owe tab, batch Won modal, desk+banner mismatch)
- [x] #156 backfill — RESOLVED, docs/specs/backfill-prompt-list.md (curated People slice, live-grants-only triage, one sitting before desk mismatch)

### Decisions
- All in CONTEXT.md (glossary + screen ownership + data trust) and docs/adr/0002, 0003 — read those, not this ledger, for detail
- Map #143 body is the index; remaining fog: whether CONTEXT.md needs sectioning (judge when a spec touches it)

### Open Questions
- UNCONFIRMED: none — all state is on the tracker/CONTEXT.md/ADRs

---

## Context
Wayfinder effort on GitHub: map issue #143 (label wayfinder:map), child tickets as sub-issues, native issue dependencies for blocking. Ritual per ticket: claim (assign @me) → grill Ben one question at a time with recommendations → confirm summary → record (CONTEXT.md/ADR + resolution comment + close + map Decisions-so-far) → commit → ask before push (Tier 2). Ben's prior decision queue (Balnaves/auDA/KKT) is a separate stream — see the asks ledger.
