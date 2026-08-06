# Backfill: what existing data prompts People and Obligation minting

Decision record for wayfinder [#156](https://github.com/Acurioustractor/grantscope/issues/156),
part of map #143. Explicitly NOT a bulk import — minting stays a human
decision (#145, #147); this doc fixes the prompt list and the mismatch
starting state. Grounding counts (2026-08-06): 5,118 `ghl_contacts`,
1,106 `ghl_opportunities` (30 Won, all `acquittal_status='pending'`, none
with `acquittal_due_date`), 102 `org_contacts` (45 funder-type).

## People: curated slice seeds the candidates rail

The "Not yet people" rail on `/org/act/people` (people spec §5) seeds from a
**curated slice**, not the full contact pool:

- GHL contacts attached to any **open or won** GHL opportunity
  (`ghl_opportunities.ghl_contact_id` → contact), plus
- `org_contacts` rows of type `governance`, `funder`, or `political`.

Everything else is reachable only by the rail's search. No Person row is ever
created by the seed — the slice is candidate visibility, minting stays
one-at-a-time through the modal (warmth + next action + review-by mandatory).
Existing desk watch-items ("watch Brian M Davis") are minted manually as their
People come up; the watch text becomes the next action.

## Obligations: live grants only; blanket-close history

- Only Wons with **active reporting or delivery terms** (current-FY grants,
  anything with known obligations like Balnaves reporting) enter the
  mismatch set.
- Historical rows — the "— historical funding (Xero-reconciled)" imports and
  discharged old grants — get a **bulk none-owed flag** behind one explicit
  confirm listing the rows it covers. Reversible per-Ask (delivery spec §5).
- The live/historical split is proposed by the agent (received dates, names,
  pipeline), confirmed by Ben in the triage sitting — never applied silently.

## Landing: one triage sitting, then the desk switches on

The backfill lands in a **single triage sitting** (a one-off checklist session
working the prompt list through the mint-on-Won batch modal), run **before**
the desk's Won-without-Obligations decision rows are enabled. The desk never
floods with 30 decision rows on day one; it starts from an honest, already-
triaged state. From then on, mint-on-Won and the mismatch flow run live
(delivery spec §4–5).

## Build order implication

1. Ship the We-owe tab + mint modal (delivery spec) with desk mismatch rows
   feature-flagged off.
2. Run the triage sitting (day shift, with Ben).
3. Enable desk mismatch rows + Obligation/People desk kinds.
