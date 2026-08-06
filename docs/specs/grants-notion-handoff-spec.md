# Grants → Notion process handoff — spec (wayfinder #162)

Decided 2026-08-06 grilling session. Part of map #158. Standing rules hold:
Notion owns produced artefacts; GHL owns Ask state and wins silently; the
desk is the one surface checked.

## On *pursue*: nothing lands in Notion automatically

Pursue mints the Ask in GHL, full stop (existing behaviour). The Notion page
is created when **production starts**, via `/make-the-ask` — one page per
Ask, holding the draft, the funder's real requirements, and the evidence
pack. Auto-creating a page on every pursue would build a graveyard of stubs
for Asks that die at "open door"; a page's existence must keep meaning
"someone is producing this".

## Progress tracking: the five Ask stages in GHL, only

No Notion status field, no checklist database. A Notion status would be a
second opinion against GHL's stage — exactly what "GHL wins silently" bans.
Application sub-steps (attachments, budget table, support letters) live
inside the Notion page as a plain checklist: document content owned by the
doc, never synced anywhere.

## Loop closure: artefact link + the normal stage rail

One new piece of state: an **`artefact_url` annotation on the Ask** —
Supabase-side, keyed on the GHL opportunity id (the same pattern
`act_obligations.artefact_url` uses; never a GHL field).

- `/make-the-ask` sets it when it parks the page — a produced doc can never
  be orphaned from its Ask.
- The desk's Ask detail pane shows "Open draft in Notion ↗" when present.
- Submission is a human stage change to **Asked** in GHL; the desk reflects
  it through normal sync.
- **Won** triggers the existing mint-Obligations prompt; a grant Ask's
  acquittal Obligation carries its own `artefact_url` to the report doc.

The full loop: desk pursue → GHL Ask → Notion production (linked) → GHL
stage change → desk. No new channel, no writeback from Notion.

## Deliberate non-rule

An Ask at "In conversation" or beyond with no `artefact_url` is NOT a
mismatch — plenty of Asks need no document. No nag exists in that direction;
only the forward link (parked page → URL set) is enforced.

## Build notes

- `act_ask_artefacts` (ghl_opportunity_id text pk, org_profile_id,
  artefact_url, set_by, set_at) or an equivalent annotation column where Ask
  annotations already live — decide at build time; the vocabulary above may
  not flex.
- `/make-the-ask` skill gains the URL write as its final parking step.
