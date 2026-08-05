# UX spec: the People surface (/org/act/people)

Build-ready spec for wayfinder [#154](https://github.com/Acurioustractor/grantscope/issues/154),
part of map #143. Consumes Person vocabulary (#145 / ADR 0002), dual-level
opens (#146), watch-items (#148), and the surface map (#149). Domain contract:
`CONTEXT.md` → "People surface". Skin: Quiet Ledger, same tokens as One Desk.

## 1. Route and scope

- **`/org/act/people`** — org-wide (ACT-gated like the desk, `isActSlug`).
  People are the one cross-project noun; there is no per-project people page.
- **Replaces `/org/act/contacts`** (Ben, 2026-08-06): the contacts route
  becomes a redirect to `/people`. Un-minted GHL contacts and org_contacts
  rows stop being a surface of their own — they reappear only as minting
  candidates (§5). Delete `contacts/` after the redirect ships one release.
- Layout: **desk-style split** — list left, detail pane right, selection via
  `?rec=` param. No `/people/[id]` route in v1; the desk's Person rows link to
  `/org/act/people?rec=<id>`.

## 2. Data

All reads hit the **Supabase mirror**, never GHL live (ADR 0002):
- Person: name, warmth (one value) + warm-via holder, owner, next action +
  review-by/due, last touch, `last_synced_at`, GHL contact URL.
- Roles (Supabase-owned, not mirrored): works-at / board-of / decides-for /
  opens-into, each pointing at an Org.
- CivicGraph annotations (read-only): board interlocks, influence, shared-
  director evidence — displayed with their own `last_synced_at`.

Stale badge on any mirrored fact older than 24h (existing data-trust rule).

## 3. List

Row grammar mirrors the desk's Person rows (#150 Variant B):

```
[person]  Brian M Davis · watch: grants committee   Goods  Harvest   via Nic   2d
```

- Solid `person` chip · name · next-action context in plain words · **project
  chips** (small outline chips, from roles/next-action project ties) ·
  *via <holder>* (omit when direct) · `Due` on review-by.
- **Ordering: next-action due first** — overdue, then soonest review-by, then
  the dateless tail sorted by warmth (warmest first). Same deadline-first
  rhythm as the desk. (Dateless People can exist only pre-backfill or after an
  explicit release — minting always sets a date, §5.)
- Group headers reuse the desk horizon bands: Overdue / This fortnight / This
  quarter / No date.
- Rail filters: warmth band · project · role type · `due only` toggle. Plain
  words, chips, same chip style as the desk rail.
- Header count line: `N people · M due this week · K overdue` + the standard
  page title. No Target read — People never feed Target math.

## 4. Detail pane

Top-to-bottom:

1. **Header**: `person` chip + warmth word + *via <holder>* + stale badge.
   Name in display type; owner + last touch on a muted line.
2. **Roles** — plain-words lines, one per role: "works at Snow Foundation",
   "board of Anyinginyi", "**opens into** NIAA" (opens-into visually marked —
   it's the bias-rule payoff). Each Org name links to its org/workspace page.
   Inline `+ add role` (Supabase write; picker: role type + Org search).
3. **Next move box** (same warm box as the desk): the next action / watch text
   + review-by date. Actions: **Done — set next** (must set a new next action
   + date, or explicitly *Release* — drops the Person to the dateless tail
   with a confirm; never a bare dismiss, per #148) and **Edit**.
4. **CivicGraph evidence** (collapsed section): board interlocks, influence
   score, shared-director opens evidence, each with `last_synced_at`. Labelled
   "evidence" — annotations, never state.
5. **Link row**: `Open in GHL ↗` (contact URL, SoR) · links to any live Asks
   where this Person is the warm-via or opens-into path ("warms 2 Asks →").

Writes: warmth, next action, owner edits go **to GHL** (via API) and
optimistically update the mirror; roles write to Supabase directly. If the GHL
write fails, surface the error — never write relationship state only to the
mirror.

## 5. Minting flow

Minting = creating/claiming the GHL contact (ADR 0002). **Mandatory at mint**
(Ben, 2026-08-06): warmth (+ via if indirect) **and** a next action **with a
review-by/due date**. No inert People.

- **Entry point**: `+ Mint a person` button on /people, opening a single modal:
  1. Name search — searches the GHL contact pool AND CivicGraph person rows
     simultaneously. Existing GHL contact → **claim** it; no match → create.
  2. Warmth select (+ warm-via Person picker when not direct).
  3. First role (optional but offered): role type + Org.
  4. Next action text + review-by date (required; default +14d).
  On submit: create/claim GHL contact → write warmth/next-action to GHL →
  mirror row + roles to Supabase → row appears in the list.
- **Candidates rail** (replaces the old contacts page's job): a collapsed
  "Not yet people" section under the list — GHL contacts and org_contacts rows
  that aren't minted, shown as one-line signals with a `mint` affordance that
  pre-fills the modal. Never mixed into the People list proper.
- Other mint entry points (CivicGraph person pages, Ask detail "record the
  human behind this bridge") reuse the same modal, pre-filled; those surfaces
  wire up in build sessions, the modal is the one flow.

## 6. Desk handshake

- Person rows appear on the desk only when review-by ≤ 7d or past (#152);
  the desk's `Open person →` targets `/org/act/people?rec=<id>`.
- Completing a watch here or on the desk is the same action (same endpoint);
  both enforce set-next-or-release.

## 7. Empty/edge states

- Empty list (pre-backfill): explainer line + `+ Mint a person` + the
  candidates rail expanded by default.
- GHL sync down (`last_synced_at` > 24h everywhere): banner "Relationship
  state may be stale — synced Xh ago", surface stays readable.
- A Person with zero roles is valid (org-less People, #145) — roles section
  shows only `+ add role`.

## Out of scope

Backfill of existing GHL contacts into minted People (#156); per-project
people views (explicitly rejected in #149); warmth history/timeline; any
Target involvement.
