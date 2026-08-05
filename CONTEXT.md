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

### Person
A human ACT deliberately cultivates, independent of any Org. Minted by a human
decision that this person matters (Brian M Davis, Jay) — appearing in a dataset
(GHL contact, CivicGraph person row) does NOT make a Person; those are Signals
about potential People. Same deliberate-commitment pattern as Ask vs Signal.
Carries one **warmth** value (ACT↔Person is a single edge) plus a "warm via"
holder ("warm via Nic"), an owner, and a next action. A Person can exist with
no Org role at all.

### Role (Person↔Org)
A typed connection between a Person and an Org — multiple hats, hats change,
the Person persists. Minimal starter set: **works-at**, **board-of**,
**decides-for** (sits on a committee/panel that decides an Ask's fate), and
**opens-into** (can introduce ACT into that Org — the Person-level warm
bridge; the *why* stays CivicGraph annotation, e.g. shared directorships). New
role types earn their way in, like Relationship types did. Roles are ACT's
structural knowledge and live in Supabase, not GHL.

### Watch-item (not an entity)
"Watch Brian M Davis" is NOT its own thing — it is the next action on a
cultivated Person (or Org). The commitment is the Person's cultivation itself;
the watch is what attending currently looks like. Every watch-style next
action carries a **review-by date** so it can't rot silently. It ends when the
awaited event happens (usually minting something — an Ask, an Obligation, a
warmth change) or the review-by date forces a keep-watching / let-go decision.
Never silent drift. Watches reach the desk as Person rows with due next
actions, not as a fourth row kind.

### Obligation
Work ACT owes because of a commitment — the post-Won and post-promise side the
money vocabulary missed. One entity with an **owed-to** type:
- **owed-to-funder** — reports, acquittals, anything a grant agreement requires
- **owed-to-community** — delivery, check-ins, promises made (the Maningrida
  follow-through, "Nic's video for Jay")
Human-minted only, prompted by events: a Won Ask prompts minting from the
grant's terms but never auto-creates; a community promise is minted when
someone records it. Minting = acknowledging the promise, not starting the
work. A Won Ask with no minted Obligations is a standing mismatch report
(same pattern as warm-but-unworked), never an auto-create.
Lifecycle is minimal: owner + next action + optional due date; **Open → Done**
plus **Dropped** (consciously released — renegotiated or let go, recorded,
never silently deleted). Overdue is derived from the due date, not a state.
Open-ended community work is Open with no due date, living on its next action.
Obligations don't negotiate, they discharge — no Ask-style stages; a
Submitted-vs-Acquitted split must earn its way in.

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
- **opens** — can introduce ACT into another Org (warm bridges: peer funders
  like KKT, LGANT offering the CDU intro). Kept for genuinely *institutional*
  bridges only; the moment you know the human behind the bridge, record it on
  the Person as an **opens-into** role instead (the bias rule). Cultivated
  like any relationship, with its own next actions; the mechanism behind the
  best Asks. On surfaces, an Org's opens display rolls up native bridges plus
  bridges via its People — always attributed ("via Jay"), derived at display
  time, never stored on the Org.

Example of why identity typing fails: Anyinginyi is simultaneously a Buyer
(washer quote), a Channel into Barkly, and a delivery collaborator. "Is X a
funder?" is the wrong question; ask "what relationships do we hold with X?"
(the Bryan false-negative came from asking the wrong question).

"Partner" survives only as spoken shorthand — never a data type or screen name.

## Screen ownership

### One Desk (`/org/act/desk`)
The directed queue. Its contract (widened 2026-08-06): **everything on it is
committed work of any kind, or a decision due now.** Exactly five kinds of
rows, deadline-first:
1. **Asks** — every live Ask (owner + next action). Always present.
2. **Money chases** — outstanding invoices (Asks against people who already owe).
3. **Decision-due items** — Signals / Grant Rounds above threshold, framed as
   one decision: *pursue* (mints an Ask) or *pass* (gone forever).
   Default thresholds: grants deadline ≤ 30d or fit ≥ 85; funders fit ≥ 85;
   open-stage buyers always in.
4. **Obligations** — open Obligations, due/overdue-first.
5. **People with due next actions** — cultivated People whose next action
   (including watches) is due.
The undecided tail (low-fit foundations, distant rounds, non-due People and
Obligations) lives in workspace lists and never touches the desk. No sibling
queue: checking the desk is sufficient.

### Money surfaces (`/org/act/goods/*` etc.)
Per-noun homes for grant-chasing browsing and research: Signals, Grant Rounds,
Orgs + Relationships, Asks lists, Targets — full lists (saved filters of the
one pool with density toggles), record detail, evidence. The desk links into
them ("Open full workspace →"); they feed decisions back to the desk.

### Delivery surfaces (same per-project workspace family)
Supports & delivery: Obligation lists + Obligation detail, per project — a
Goods acquittal lives in the Goods workspace.

### People surface (`/org/act/people`, org-wide)
The cultivated humans: People list + Person detail (roles, warmth, opens-into,
next actions/watches), project chips on rows. Org-wide, not per-project —
People are the one genuinely cross-project noun; splitting them would recreate
the identity-typing mistake the Relationship model exists to kill.

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
| Person existence, warmth, warm-via, owner, next action, last touch | **GHL** (Supabase read-mirror for surfaces) |
| Person↔Org roles | **Supabase** |
| Person evidence: board interlocks, influence, "opens" bridges | **CivicGraph** (read-only annotations) |
| Dollars received | **Xero** |
| The produced artefact (application doc, EOI) | **Notion** |

Rules:
- **Not in GHL = not an Ask** — it's still a Signal. Pushing to GHL is minting
  the Ask.
- **Not in GHL = not a Person** either — minting a Person = creating/claiming
  the GHL contact (ADR 0002). Surfaces query the Supabase mirror, never GHL
  live.
- **On any state disagreement, GHL wins silently.** CivicGraph's opinion
  appears only in mismatch reports (warm-but-unworked etc.), never as status.
- **Every foreign fact displays its age** (`last_synced_at`); stale badge when
  sync age > 24h (the daily reconcile agents' cadence).

### Banned: bare "opportunity"
The word meant four different things (grant_opportunities rows, GHL opportunity
cards, pipeline commitments, opportunity signals). In domain language and new
UI copy, always use Ask, Grant Round, or Signal. Legacy table/API names stay
until their next natural migration.
