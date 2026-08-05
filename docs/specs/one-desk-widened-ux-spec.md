# UX spec: the widened One Desk

Build-ready spec for wayfinder [#153](https://github.com/Acurioustractor/grantscope/issues/153),
part of map #143. Consumes the #150 Variant B row-shape prototype
(`prototype/desk-row-shapes` branch) and the #152 thresholds. Domain contract:
`CONTEXT.md` → "One Desk" (five row kinds). Target file:
`apps/web/src/app/org/[slug]/desk/page.tsx` + `lib/services/act-one-desk.ts`.
Skin stays Quiet Ledger; no new visual family.

## 1. Row kinds

The desk shows exactly five kinds. Two changes to the existing enum:

| kind | chip word | source | notes |
|---|---|---|---|
| `funder` / `grant` / `buyer` | `funder` / `round` / `buyer` | existing | unchanged (decision-due rows) |
| `money` | `owed` | existing | unchanged (invoice chases) |
| `obligation` | `we owe` | Supabase (ADR 0003) | **replaces** the legacy `commitment` kind — the old `work` chip disappears; committed work IS an Obligation (#150) |
| `person` | `person` | Supabase mirror of GHL (ADR 0002) | cultivated People whose next action / watch is due ≤ 7d or past |

Eligibility (from #152, defaults; rail filters may widen later):
- **Obligations**: open AND (overdue OR due ≤ 30d OR undated). Undated is always eligible.
- **People**: next action review-by/due ≤ 7d away or past.

## 2. Row layout (Variant B, locked in #150)

Both new kinds keep the existing row grammar — solid kind chip · name column ·
right-aligned facts — plus exactly one extra fact each:

**Obligation row**
```
[we owe]  Acquittal — Snow Foundation capital block   → funder      12d
[we owe]  Return the trailer to Anyinginyi            → community   3d overdue
```
- Chip: solid, same style as existing kinds; new token `bg-ql-kind-obligation`.
- After the name: a small owed-to tag `→ funder` / `→ community` (muted mono,
  same size as the `decide` pill but borderless text). This is the one extra fact.
- Right side: `Due` component unchanged; undated renders the existing `—`.

**Person row**
```
[person]  Brian M Davis · watch: grants committee     via Nic       2d
```
- Name column: person name, then watch/next-action context in plain words
  (`· watch: …` or the next-action gist), truncating as one line.
- Extra fact: warm-via holder as italic `via <holder>` before the due date.
  Omit when warmth is direct (no via).
- Right side: `Due` on the review-by/due date.

No amount column on either kind (People and Obligations carry no `$` on the desk).

## 3. Ordering (Ben, 2026-08-06)

**Fully interleaved by date.** One deadline-first pool: all five kinds sort
together into the existing horizon groups (Overdue / This fortnight / This
quarter / No date) purely by due date. Kind never affects order; the chip
carries the distinction. An Obligation due in 3d sits above an Ask due in 5d.

**Undated Obligations pin the top of the No-date group**, above fit-ranked
undated Signals. Rationale: they're committed work with no date — surfacing
them first is the standing nudge to date-or-drop (per #152, undated must never
hide). Within the pinned set, newest-minted first. Undated People rows don't
exist (a watch always has a review-by date; enforced at minting).

## 4. "Do this now" hero

**Any kind can be the hero.** The hero remains simply the top row of the
filtered pool — if the most urgent thing on the desk is an overdue acquittal
or a lapsed watch, that IS the move. No change to hero markup; the `next` line
for a Person row is its next action text, for an Obligation its next action.

## 5. Header

Count line becomes four plain counts:

```
N asks · M decisions due · K owed · P people [· H handled today]
```

- `owed` = eligible Obligation rows (the chip word doubles as the count word).
- `people` = eligible Person rows.
- Target read (committed / needed / asked) is unchanged and stays on the line
  below — Obligations and People never feed Target math.

## 6. Rail / filters

- Kind filter set becomes: `Funders · Grant rounds · Buyers · Money owed to us
  · We owe · People`. The legacy `Committed work` filter disappears with the
  `commitment` kind.
- `KIND_FILTER_LABEL`: `obligation: 'We owe'`, `person: 'People'`.
- Project filter: Obligations are per-project (their project). Person rows are
  org-wide — under a project filter, show a Person only if the due next action
  or a role ties them to that project; otherwise they drop out of the filtered
  view (they always survive the unfiltered desk).

## 7. Detail pane (right side)

Existing pane structure (chip + signal line, name, facts, Next move box, mark
buttons, link row) is reused; per-kind deltas:

**Obligation selected**
- Facts row: owed-to tag + due. Signal line: project + "minted from <Ask>"
  when the source Ask is known.
- Link row: `Open in delivery workspace →` — the per-project delivery surface
  (`/org/act/<project>/obligations/<id>`, family per #149/#155 spec). No GHL
  button (Obligations never live in GHL).
- Mark buttons: Done / Dropped (the two terminal states from #147) replace the
  generic handled buttons for this kind. Both require no reason; Dropped asks
  a one-line confirm since community-owed drops are a relationship cost.

**Person selected**
- Facts row: warmth word + `via <holder>` + review-by due. Signal line: roles
  in plain words ("works at Snow Foundation · opens into NIAA").
- Link row: `Open in GHL ↗` (the Person's contact — GHL is SoR, ADR 0002) and
  `Open person →` linking `/org/act/people/<id>` (spec #154).
- Mark buttons: `Done — set next` (completing a watch must set a new next
  action or explicitly release the Person back to /people; never a bare
  dismiss, per #148 "ends by event or decision, never drift").

**Staleness**: Person rows display `last_synced_at` age per the data-trust
rule (stale badge > 24h). Obligations are native — no badge.

## 8. Links down to the three surface families

| From | To |
|---|---|
| money-kind rows (funder/grant/buyer/owed) | existing money workspaces (`workHref` unchanged) |
| Obligation rows | per-project delivery surface (Obligation detail) |
| Person rows | `/org/act/people` detail (+ GHL contact) |

The desk never embeds full lists of any family; "Open full workspace →" is the
only downward path (contract: checking the desk is sufficient, browsing
happens in the workspaces).

## 9. Empty/edge states

- A horizon group renders only if non-empty (existing behaviour).
- Zero eligible rows overall keeps the existing "Nothing matches this filter."
  — plus, unfiltered-empty gets "Desk clear." with counts of non-due items per
  family as links (e.g. "3 obligations later · 12 people cultivated").
- `DeskRecord` gains: `kind: 'obligation' | 'person'`, `owedTo?: 'funder' |
  'community'`, `via?: string`, `personId?`, `obligationId?`; `commitment`
  kind and its label/style entries are deleted.

## Out of scope for this spec

Minting flows (Won prompt → Obligation is #155; Person minting is #154), the
backfill (#156), rail-filter widening controls, and any Target changes.
