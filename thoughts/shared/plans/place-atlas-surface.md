# The Atlas: one full-screen surface for the place data

**Written:** 2026-08-08, after PRs #175/#176/#177 landed. **Status: proposal, nothing built.**

## The problem it solves

The place work now lives on five surfaces that do not know about each other: `/map` (boxed
at 600px inside a container), `/place/*` (deep prose pages), `/places` (postcode gaps),
`/reports/reallocation-atlas`, `/graph`. Each holds a piece; none can be projected in a room
and explain itself. Ben's ask: a full-screen map that explains, all the data easy to reach,
connected to Goods.

## Shape

**`/atlas` — map fills the viewport.** Everything else overlays it.

1. **Layers, not pages.** Money held / money delivered / unplaced share / SEIFA / schools
   (ICSEA) / overcrowding / crime-where-honest / renewal cliff. The layer registry is typed
   and carries, per layer: the caveat paragraph ("what this number contains" — the five
   misattribution mechanisms, distilled to one paragraph each), the geography it is honest
   at, and a consent tier (see Goods below). Selecting a layer shows its caveat. The explain
   is not a help page; it is attached to the number.

2. **Place rail.** Click a council or search a place → side panel with the mini
   place-report (the council/RegionReport data already built) and a link to the full
   `/place/*` prose page. The prose pages stay the depth; the Atlas is the door.

3. **Story mode.** A fixed sequence for a room: where money is recorded is not where it
   lands → Utopia's $93.6M sitting in Alice Springs → the unplaced layer → the renewal
   cliff (58–64% ending within 24 months everywhere). Five steps, each one map state +
   one paragraph. This is the community-conversation artifact.

4. **Take the data.** Per-council CSV/JSON from the panel; shareable URLs
   (`/atlas?place=ceduna&layer=unplaced`) so a link IS the presentation; the map API
   already returns the full payload — formalise it as the documented endpoint rather
   than building a second one.

## Goods

The Goods ledger is the inverse layer and the strongest demonstration of the thesis:
CivicGraph shows money recorded, Goods shows things delivered.
Alice Springs: $2,441M held, 16 beds. Utopia: no council area at all, 147 beds.

**Consent gates this, and the gate holds.** All three Notion rows are Publish-to-site =
NO; Utopia consent is Not checked. So:

- Build the Goods layer **org-side first**: an "On the map" view inside
  `/org/act/goods/*`, reusing the same Atlas component with the layer enabled.
- The layer registry's consent tier (`public | org | withheld`) is enforced
  **server-side** — strip fields in the RSC/API, never blur or hide client-side
  (the Phase-6 flight-payload lesson).
- Public activation is per-place, only when a consent flag flips in the data. The Atlas
  with story mode is the right artifact to bring TO the consent conversation — the open
  question from the ledger (would someone from Utopia or Hope Vale recognise
  themselves?) is answered in person, with this on the screen.

## What not to do

- Do not fold the `/place/*` prose pages into the map. Depth and door are different jobs.
- Do not put any Goods figure on a public surface before the flag exists.
- Do not adopt a new viz stack. Leaflet + the existing boundary file carry all of this;
  the 16MB boundary GeoJSON already loads on `/map` today.

## Sequence (one session each)

1. `/map` → full-viewport `/atlas` shell + typed layer registry (the two existing metrics
   become the first two layers, caveats attached).
2. Place rail + shareable URLs + CSV export.
3. Story mode with the four-region findings.
4. Goods overlay org-side, behind the login.
5. Public Goods activation — blocked on the consent conversation, by design.

## Open questions for Ben

- Does `/atlas` replace `/map` (redirect) or sit beside it? Proposal: replace — two maps
  is a fork nobody maintains.
- Story mode voice: the place pages' register ("we cannot tell you X") projected in a
  room reads differently than on a screen alone. Worth a read-aloud pass before a real
  session with community.
