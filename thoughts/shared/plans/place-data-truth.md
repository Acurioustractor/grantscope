# Place data truth: one spine from geography repair to the surface

**Written:** 2026-08-09, after the single-council placement pass (15,251 placed, 83,409
remaining) and the Warrnambool-hole diagnosis. **Status: proposal.** Ben's standing call:
get the data right before more screens. Data-session record:
PR #183 comment (2026-08-09) · ladder in `thoughts/shared/handoffs/place-atlas/current.md`.

## The principle

Place is the join key for everything CivicGraph holds — money, entities, boards,
interventions, Goods deliveries. Placement confidence is what decides whether any join is
true: the hub-credit distortion (Ceduna credited with Oak Valley's money) is what a
confident-but-wrong join looks like. The atlas already says "how sure are we" out loud,
so data work and UX work are one spine viewed from two sides: every ladder rung climbed
makes an existing surface more true; every new connection is a registry layer, not a
screen.

## Current state (verified live 2026-08-09)

- **83,409 entities** hold a postcode and no council (`lga_name IS NULL AND postcode IS
  NOT NULL`). 98,660 before the single-council pass; 15,251 placed by it
  (`lga_source='single_lga_postcode'`, backup `gs_entities_lga_backup_20260809`).
- **The remainder is not all honest ambiguity.** `postcode_geo` carries 3280/3281
  (Warrnambool's own postcodes) only as Moyne — 434 orgs, 430 unplaced, 4 credited to
  the neighbour, 0 to the city. Metro councils rendering 100% unplaced (Subiaco,
  Queenscliffe, Darwin Waterfront, possibly Napranum) are suspect for the same hole.
- The atlas currently presents these artifacts as ambiguity. That is the lie to remove
  first.

## The spine

**Phase 0 — land what's built.** PR #183 carries the desk, the org-side Goods map, and
the applied migration. Refresh the stale body, one preview look, Ben's merge verb.
Everything below builds on its registry and desk layout.

**Phase 1 — make the join key trustworthy** (ladder rungs 1–2, one data session).

1. Quantify the hole class: councils whose own-name locality does not map to them in
   `abs_locality_lga` / `postcode_geo`. Number first, then repair.
2. Repair the city-locality rows; re-run the `20260809070000` placement logic
   (idempotent, resumable, backup pattern established); re-run the ACNC town-city pass
   (pass 1 of `20260808130000`) against the repaired tables.
3. **Reason codes.** Every still-unplaced entity gets one: `multi_council_postcode` ·
   `no_postcode` · `state_conflict` · `hub_postcode` · `unknown_postcode`. This taxonomy
   is what turns rung 5 (the honest core) from an apology into a feature — the caveat
   card can then say *why* per slice, not just *how many*.

*Exit (Ben's check): no metro council renders 100% unplaced from a geography hole;
open /atlas and Warrnambool looks sane; every unplaced entity carries a reason.*

**Phase 2 — join what we already hold onto place.** No new screens. Wire the existing
substrate into the place rail and layer registry, each entry carrying consent tier +
honest-at + caveat, exactly as `lib/atlas/layers.ts` demands:

- **Money reaching here** — justice funding, grants, contracts per council (CTEs on the
  map API already started this).
- **What is proven to work here** — Australian Living Map of Alternatives interventions
  by place.
- **Who is here** — entities by type; boards via `mv_person_entity_network`.
- **What we deliver here** — Goods, org-side, consent enforced server-side (already in
  PR #183).

*Exit (Ben's check): one council he has stood in — Ceduna's or Warrnambool as the test —
answers who / what money / what works / what we deliver from live joins, each line
carrying its confidence. It reads true to someone who knows the place.*

**Phase 3 — the surface pass.** Only now does polish pay: run the /polish loop
(Clarity / Value-shown / Meaning / Aesthetic / Friction) on atlas + place rail + org
map. Story-mode read-aloud pass with Ben remains the gate before any real community
session. If there is a specific first user, phase 3 is shaped around her actual first
session, not a generic one.

**Between phases, day-shift data sessions** (ladder rungs 3–4, yield-ordered, nothing
waits on them):

- **ORIC registered addresses** — `scripts/fetch-oric-addresses.mjs` exists, dry-run
  only. Auto-apply proven unsafe (resolves Oak Valley to CEDUNA — the hub-credit
  distortion again). Per-org human judgement.
- **ABR/ASIC street addresses** — the long pole; bulk extract carries state+postcode
  only. A street address per entity is the required source.

## What not to do

- Do not polish surfaces over wrong data — it dresses noise as signal (standing rule:
  data quality before scoring).
- Do not sum unplaced counts across councils into a national total — an entity counts
  toward every council sharing its postcode by design.
- Do not auto-apply registered-address placements for remote corporations. Ever.
- Do not treat null LGA as missing data — check `lga_source`; the null is often the
  honest verdict.
- DDL stays human-gated: migration file committed with the apply command in the header;
  Ben applies day-shift.

## How this gets worked

Small PRs off origin/main, gates once at the end, Ben's verb for push/PR/merge. Data
sessions produce: a migration file (committed, not applied), a dry-run count in the PR
comment, and a re-verified before/after in the handoff ledger. The unplaced count is
the scoreboard; the reason-code distribution is the honest version of it.
