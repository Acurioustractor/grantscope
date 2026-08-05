# CONTEXT — ACT one-system workspace domain language

The ubiquitous language for the ACT operating workspace (One Desk + the project
workspaces). Decided in grilling sessions with Ben; challenge any code or copy
that disagrees. Started 2026-08-05.

## Glossary

### Ask
A deliberate, committed chase for money from a specific source — a grant
application, a funder approach, a buyer deal. Has an owner, a stage, and a next
action. This is what GHL pipeline cards and CivicGraph "pipeline commitments"
both actually are. If nobody has decided to chase it, it is not an Ask — it is
a Signal or a Grant Round.

### Grant Round
A time-boxed open door in the world (a fundable round with a deadline). Exists
whether or not ACT cares about it. Lives in CivicGraph (`grant_opportunities`).
Becomes the subject of an Ask when a human decides to apply.

### Signal
A machine-discovered maybe (matched foundation, detected round, procurement
lead) that no human has decided on yet. Discovery-side only. Promotion path:
Signal → Ask (human decision), never automatic.

### Org
An organisation as an entity — one row, one GHL contact. An Org is never "a
funder" or "a partner" as identity; it *holds Relationships* with ACT.

### Relationship
A typed connection between an Org and ACT. One Org can hold several at once,
and relationships evolve. Types:
- **funds** — gives money without buying product (grants, philanthropy)
- **buys** — pays for product or services (revenue; kept a separate track from
  funds — the QBE rule)
- **distributes** — a Channel: moves ACT product to communities (RASAC,
  Tangentyere, health services, stores)
- **auspices** — legal/DGR routing (Butterfly Movement Ltd)
- **collaborates** — works on a program together (e.g. Oonchiumpa: ACT works on
  their program with them — setup first, then a facility; the relationship
  deepens over time)
- **opens** — can introduce ACT into another Org (warm bridges: shared board
  directors, peer funders like KKT, LGANT offering the CDU intro). Cultivated
  like any relationship, with its own next actions; the mechanism behind the
  best Asks.

Example of why identity typing fails: Anyinginyi is simultaneously a Buyer
(washer quote), a Channel into Barkly, and a delivery collaborator. "Is X a
funder?" is the wrong question; ask "what relationships do we hold with X?"
(the Bryan false-negative came from asking the wrong question).

"Partner" survives only as spoken shorthand — never a data type or screen name.

## Screen ownership

### One Desk (`/org/act/desk`)
The directed queue. Its contract: **everything on it is either committed work
or a decision due now.** Exactly three kinds of rows, deadline-first:
1. **Asks** — every live Ask (owner + next action). Always present.
2. **Money chases** — outstanding invoices (Asks against people who already owe).
3. **Decision-due items** — Signals / Grant Rounds above threshold, framed as
   one decision: *pursue* (mints an Ask) or *pass* (gone forever).
   Default thresholds: grants deadline ≤ 30d or fit ≥ 85; funders fit ≥ 85;
   open-stage buyers always in.
The undecided tail (low-fit foundations, distant rounds) lives in workspace
lists and never touches the desk.

### Workspace surfaces (`/org/act/goods/*` etc.)
Per-noun homes: full lists (saved filters of the one pool with density
toggles), record detail, evidence. Where browsing and research happen.
The desk links into them ("Open full workspace →"); they feed decisions back
to the desk.

### Target
What the Asks serve: a per-project, per-relationship-type goal with a date
("Goods: $367–620K across five capital blocks by Jun 2027"; "Goods: 3 live
Channels in the Barkly"). Every Ask optionally points at a Target. Two honest
numbers derive from it everywhere: **covered** (written commitments against the
Target) and **in flight** (open Asks × stage weight). The primary Goods Target
today is the QBE-raise capital plan ($367–620K). One Desk's header reads
against Targets, not record counts.

### Stages (the five)
One human vocabulary for an Ask's lifecycle; every GHL pipeline stage and
legacy enum maps onto exactly one:
**Open door** (decided, no contact yet) → **In conversation** → **Asked** (a
specific amount is in front of them) → **Won** / **Lost**, plus **Dormant**
(parked). GHL remains the mechanical truth; the mapping table lives in code;
desk and reporting speak only the five. Values like `approach_now` are priority
flags on Signals, not stages. Money after Won is Xero's story (covered vs cash
received), not an extra stage.

## Data trust

The Ask lives in GHL; everything else annotates it. (Full rationale:
docs/adr/0001-ask-lives-in-ghl.md)

| Fact | Owner |
|---|---|
| Ask existence, stage, warmth, owner, next action, last touch | **GHL** |
| Evidence around the Ask: fit, deadlines, grant round facts, org intelligence, warm bridges | **CivicGraph** (read-only annotations, synced via reconcile agents) |
| Dollars received | **Xero** |
| The produced artefact (application doc, EOI) | **Notion** |

Rules:
- **Not in GHL = not an Ask** — it's still a Signal. Pushing to GHL is minting
  the Ask.
- **On any state disagreement, GHL wins silently.** CivicGraph's opinion
  appears only in mismatch reports (warm-but-unworked etc.), never as status.
- **Every foreign fact displays its age** (`last_synced_at`); stale badge when
  sync age > 24h (the daily reconcile agents' cadence).

### Banned: bare "opportunity"
The word meant four different things (grant_opportunities rows, GHL opportunity
cards, pipeline commitments, opportunity signals). In domain language and new
UI copy, always use Ask, Grant Round, or Signal. Legacy table/API names stay
until their next natural migration.
