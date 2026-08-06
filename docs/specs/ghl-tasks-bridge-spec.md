# GHL tasks bridge — boundaries (wayfinder #161)

Decided 2026-08-06 grilling session. Part of map #158. The digest (#160) is
the read channel; this bridge is the act channel — due desk work appearing as
GHL tasks so it reaches the phone. The desk stays primary.

## Which items become tasks — due work only, never decisions

Three sources, same due windows as the digest's "going due" section:

1. **Asks' dated next actions** — due or overdue.
2. **People / watch next actions** — review-by ≤ 7d or past.
3. **Obligations** — due ≤ 7d or overdue.

Explicitly excluded: decision-due rows (Signals / Grant Rounds). Deciding
pursue/pass needs the evidence around the row; a phone task saying "decide on
X" is noise. Decisions live on the desk and in the digest only.

## Obligations are write-only projections (ADR 0003 holds)

Including Obligations does NOT cross ADR 0003, because of one absolute rule:
**GHL tasks are disposable projections, never read back.** Completing a task
in GHL changes nothing — Done happens in the workspace, and the bridge then
clears its task. No surface ever consults GHL tasks for Obligation state, so
there is no second opinion to lose to. ADR 0003 is about who owns truth, not
where reminders may appear. Excluding Obligations would make the bridge carry
the least important due items and omit the most important ones.

## Direction — strictly one-way, bridge-owned

The bridge only creates, updates, and deletes tasks it created, tracked in
`ghl_task_bridge` (source row → GHL task id). It never touches hand-made
tasks. No reconciliation, no read-back — reconciliation is what turns a
projection into a competing source of truth.

## Dedupe — idempotent on source row, self-cleaning

- One task per source row, keyed by source id.
- Due date moves → bridge updates its task.
- Item completes / drops in the owning system → bridge deletes the task
  (stale nags are how task lists die).
- Runs in the same daily 07:00 Brisbane edge-function pass as the digest —
  one composition of "what's due", two channels out. Desk, digest and tasks
  derive from the same window, so they agree by construction.

## Task anatomy

- Attached to the relevant GHL contact: the Person; the Ask's contact; for
  Obligations the funder/community Org's contact where one exists, else
  unattached.
- Title: `[desk] <next action>` — the prefix is the human-visible marker of
  bridge ownership.
- Due date: the item's date. Body: deep link to the desk row.
- No tags, no workflows touched — same isolation rule as the digest.
