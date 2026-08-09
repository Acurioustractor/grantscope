---
date: 2026-08-08T05:30:00Z
session_name: ceduna-place-data
branch: feat/place-funding-far-west
status: active
---

# Work Stream: ceduna-place-data

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-08T05:30:00Z
**Goal:** Ceduna and the Far West Coast readable and true in CivicGraph, for a community conversation Ben is in now. **Substantially done.** The next move is applying the same treatment to other communities.
**Branch:** feat/place-funding-far-west — worktree `/Users/benknight/Code/grantscope-place`, 8 commits, **PR #175 open, not merged**
**Test:** `cd /Users/benknight/Code/grantscope-place/apps/web && npx tsc --noEmit && npx vitest run` (550 passing)

### Now
[->] Nothing running. Ceduna work is complete and filed. Pivoting to other communities.

### This Session
- [x] **Ceduna funding verified**: $273,981,057 all-time federal / $175,566,482 active. `grantconnect_awards` has 291K rows (memory said empty — stale)
- [x] Ceduna is a **Stronger Places Stronger People** site (FWCP, $3.7M to 2029). Federal **Justice Reinvestment is committed to 2 other SA sites to 2029**; Ceduna JR has zero funding rows
- [x] **Fay Fuller: zero grant-level records held.** Our gap, not evidence of absence
- [x] **Shipped** `getPostcodeFundingPicture` — place pages read GrantConnect. Ceduna $7.5M → **$215.3M committed, $148.3M ending within 24 months**
- [x] **Shipped** `PLACE_REGIONS` registry — `place-intelligence` generalised off its hardcoded Central Australia filter
- [x] **Shipped** crime suppression (`getLgaAttribution`), checked before fetch so nothing leaks to the RSC payload
- [x] **Applied** `postcode_geo` rebuild from ABS — 4,126 rows / 729 postcodes
- [x] **Applied** entity LGA — 7,538 resolved, **64,801 nulled** as unplaceable, 598 `geo_resolution_gaps` rows
- [x] **Applied** SA crime re-ingest by suburb — **Maralinga Tjarutja 905 offences/336 assaults → 8/6**. Ceduna 1 → 795
- [x] **Shipped** `/place/far-west-coast` — leads with the hub-administration problem, names our own error, lists what it cannot tell you
- [x] **Verified by render** (not just tsc): `/places/5690` and `/place/far-west-coast` both HTTP 200 with correct figures
- [x] Fixed header naming the page BOOKABIE and labelling one of four councils (`.limit(1)` on the locality query)
- [x] `fetch-oric-addresses.mjs` built, **dry-run only** — proven unsafe to auto-apply
- [x] **Notion updated**: new corrections page + funding page callout fixed + run sheet youth justice lane

### Next
- [ ] **Merge PR #175.** Nothing user-facing is live until it does. DB changes already are
- [ ] **Pick the next community.** Central Australia already has a page; the Notion 🏘️ Communities database has the rest
- [ ] Check `import-bocsar-crime.mjs` (NSW) — the only other crime ingest referencing `postcode_geo`. NT/QLD/VIC/ACT do not, so the bug was SA-specific plus possibly NSW
- [ ] Street addresses for the 5 ORIC corporations — still the unblock for the 64,801, still needs a human per org
- [ ] Community notes on `/place/far-west-coast` need a local check (e.g. whether Scotdesco people say "at Bookabie")
- [ ] `mv_lga_place_profile` keys grants on `delivery_postcode`, so it shows Ceduna at $0. Any region page built on it alone will understate badly

### Decisions
- **Recipient registered address, not delivery location**, for place funding. Only 41 of 346 awards in 5690 publish a delivery postcode. Both biases render on the page
- **Withhold crime rather than show it** where the postcode spans councils (~31.8% of postcodes). The section explains itself rather than vanishing
- **Null unplaceable entities rather than keep a wrong value with a provenance stamp.** Most consumers will not check `lga_source`
- **A targeted "null only if the council is not in the ABS set" rule was rejected** — it would NOT have caught Ceduna, because Maralinga Tjarutja is a valid council for 5690
- **ORIC registered addresses are not applied.** They resolve Oak Valley to CEDUNA, reproducing the hub-credit distortion
- **Did not edit the parent Notion Ceduna page** — its Next action, stage and consent status are Ben's working state

### Open Questions
- UNCONFIRMED: whether Ceduna Justice Reinvestment is funded via SA state money, sub-granted through FWCP, or genuinely unfunded. **Question for the room, not the database**
- UNCONFIRMED: whether the old 905-offence figure ever reached anyone in community. If it did it needs correcting in person
- Oak Valley and the Maralinga Tjarutja communities are now unplaced. The fix that stopped Ceduna being credited with their money also stopped them being placed at all

### Workflow State
pattern: diagnose-then-fix
phase: 5
total_phases: 5
retries: 2
max_retries: 3

#### Resolved
- goal: "make Ceduna true in CivicGraph before the community conversation" — DONE
- crime_strategy: suppress (done) → rebuild mapping (done) → re-ingest by suburb (done)
- entity_lga_strategy: resolve where an address exists, null where none does — applied
- notion_filing: corrections page + funding callout + run sheet — done

#### Unknowns
- next_community: UNKNOWN — Ben's pick
- oric_addresses: partial — method works, per-org human judgement needed

#### Last Failure
(resolved) Entity-LGA migration failed twice as one transaction. Cause was the **2-minute shell timeout on `!` commands killing psql**, not pooler locks as first diagnosed. Fixed by chunking with per-batch commits.

---

## Context

### Starting the next community: what already generalises

This was built for Ceduna but almost none of it is Ceduna-specific.

| Asset | Scope |
|---|---|
| `getPostcodeFundingPicture(postcode)` | **Any postcode.** Federal grants by recipient registered address |
| `PLACE_REGIONS` in `place-intelligence.ts` | Add a region entry, get `getPlaceIntelligence(key)` |
| `getLgaAttribution` crime guard | **National**, already live for every postcode |
| `postcode_geo` rebuilt from ABS | **National**, applied |
| `fetch-oric-addresses.mjs` | Any postcode, dry-run |
| `/place/far-west-coast` | Template for a curated region page |

**The transferable finding, and the thing to check first anywhere remote:** outstations are administered from the regional hub, so postcode, registered address and postal locality all point at the hub. Money meant for the outstations gets counted as the hub's. This will be true in Central Australia, the APY Lands, the Kimberley, Cape York — anywhere the paperwork lives in town. It is not a data fault to fix; it is a fact to state on the page.

**Expect the 64,801 wall.** Any remote community will hit it: ORIC corporations have no locality in any source we hold.

Central Australia already has a page (`/place/central-australia`, Mparntwe, Barkly, MacDonnell, Central Desert, APY) and its own `PLACE_REGIONS` entry. It is the obvious next region to re-check now that the geography underneath it changed.

### Why this session happened
Ben on the ground in Ceduna 5 Aug 2026 (Wirangu country; Ceduna, Koonibba, Scotdesco, Yalata, Oak Valley/Maralinga). Notion Goods Community OS page `f175fe4e8d994373af4355f87aa4538c`. A recorded yarn with Clifton (consent 6 Aug) about young people making beds "instead of going around stealing" — youth justice and community-owned production in one sentence. The Notion page said under The funding pathway: *"No qualified opportunity yet."* That is the line the database exists to fill.

### The two systems
Notion + GHL hold consent, protocol, who holds the relationship. CivicGraph holds the money map, the entity graph, the place data. The `shared_director` edges independently corroborate Far West Community Partnerships as the regional coordination door.

### Backups (all applied migrations reversible)
- `postcode_geo_lga_backup_20260808` (12,299 rows)
- `gs_entities_lga_backup_20260808` (609,416 rows)

### Commits on feat/place-funding-far-west (PR #175)
`5a7ba5d` place pages read GrantConnect · `be80734` crime withheld · `d0772ca` postcode_geo migration · `8ac9c2f` chunked entity-LGA migration · `2ffc0c9` header naming fix · `26e1d43` ORIC lookup (dry-run) · `d933f19` SA crime by suburb · `587e63b` Far West Coast page

### Notion filed
- New: [Ceduna: numbers we had wrong](https://app.notion.com/p/3b6ebcf981cf81688347ff6d44bdc947)
- Updated: [verified funding picture](https://app.notion.com/p/239907cc0080449f87221bce9c9460c5) (stale callout corrected)
- Updated: [Wednesday run sheet](https://app.notion.com/p/38d9f056b8394ddea7e2aaacdf7e520f) (youth justice lane)

Consent status for Ceduna is **Not checked** — everything stays internal.

### Memory written
`project_lga_attribution_rebuild.md` · `feedback_long_migrations_need_chunking.md`

### Related
Buyer-wedge stream paused and untouched: `thoughts/shared/handoffs/buyer-wedge-lighthouse/current.md`. Its open decision (third pack vs outreach, NSW DCJ recipient) still stands.
