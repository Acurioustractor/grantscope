# Community records — domain spec (wayfinder #159)

Decided 2026-08-06 grilling session. Part of map #158 (engagement layer).
Vocabulary here is canonical; CONTEXT.md carries the glossary entry.

## What a Community is

A **Community** is a place ACT is deliberately engaged with — Barkly, Utopia
(Urapuntja), Palm Island (Bwgcolman). Human-minted, same reality test as Ask
and Person: a decision that ACT is engaged there creates the record; appearing
in a dataset never does. There is no Community-Signal tier — the whole list is
hand-minted, expected size 5–15.

**Identity is the name Ben's team actually uses**, not an ABS code. The three
charting examples are three different kinds of geography (LGA-scale region,
homelands cluster, island community); keying on LGA would force Utopia into
"Barkly LGA" and mint records for places ACT doesn't work.

**Geo codes are annotations, not identity.** LGA codes, postcodes, SA2s attach
optionally so CivicGraph evidence joins in (funding deserts, SEIFA, contracts,
entities in the area). A Community with zero geo codes is valid.

Naming: UI noun is **Community** (not "Place" — "owed-to-community" already
exists in the vocabulary). Indigenous place names first, colonial in brackets.

## Relation to existing nouns — hub, not hierarchy

Communities connect by typed edges; nothing is required to have one. It is a
lens things opt into, never a parent.

| Edge | Meaning | Example |
|---|---|---|
| Org → Community (`in`) | Org is based in / of the place | Anyinginyi ↔ Barkly |
| Org → Community (`distributes-into`) | Channel relationship made explicit | RASAC → its communities |
| Person → Community (`anchored-in`) | Person belongs to / is anchored in the place | Jay ↔ his community |
| Obligation `community_id` (nullable) | What we owe the place | Maningrida follow-through |
| Ask / Target `community_id` (nullable) | Community-scoped chases and goals | "3 live Channels in the Barkly" |

Orgs and People can touch multiple Communities (edge tables, not FKs on the
Org/Person row). The Obligation join is the highest-value one: "what do we owe
Barkly" is currently unanswerable.

## What one record shows

The Community page is a **read surface composed of existing state** — four
panes, all derived:

1. **Who we know there** — People and Orgs via edges, with their warmth.
2. **What we owe** — open Obligations tagged to the Community
   (`owed-to-community` first, but any tagged Obligation shows).
3. **What's live** — Asks, Targets, and Channel relationships tagged there.
4. **Last touch** — max last-touch across its People / Orgs / Obligations.

Stored state on the record itself is minimal: name, slug, notes/context blurb,
geo annotations, minted-by/when. **No warmth on the Community** — warmth stays
on People and Orgs; an aggregated community-warmth number would be fake.

## Ownership

Supabase-native (`act_communities` + edge tables) — work-truth side of the
ADR 0003 rule. GHL involvement zero. CivicGraph joins read-only with
`last_synced_at` ages. Rationale: docs/adr/0004-communities-live-in-supabase.md.

## Desk interaction — none

Communities never mint desk rows; the desk contract stays five row kinds. A
Community surfaces work only through what it already contains (its Obligations
going due, its People with due next actions). The page lives in the workspace
family (`/org/act/communities/[slug]`), linked from desk rows the way Org
pages are. "No sibling queue" holds.

## Build notes (for the implementation session)

- Tables: `act_communities` (id, name, slug, notes, geo jsonb, minted_by,
  minted_at), `act_community_links` (community_id, subject_type
  org|person, subject_ref, link_type in/distributes-into/anchored-in) —
  exact shape may flex at build time; the vocabulary above may not.
- `act_obligations.community_id` nullable FK; Ask/Target tagging rides the
  existing annotation pattern (Asks live in GHL — the tag is a Supabase-side
  annotation keyed on the GHL opportunity id, never a GHL field).
- Wiring order per #158: this vocabulary unblocks Community ↔ Obligations /
  People wiring.
