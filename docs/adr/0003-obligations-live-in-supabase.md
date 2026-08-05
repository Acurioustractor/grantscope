# Obligations live in Supabase; GHL owns relationship truth, Supabase owns work truth

Obligations (work ACT owes because of a commitment — funder reports,
acquittals, community delivery promises) are Supabase-native: the first
Supabase-owned *state*, not a mirror or annotation. "Not in GHL = not real"
does not extend to them — an Obligation's reality test is minting (#147), and
there is no second opinion to lose to.

Why ADR 0001's rationale doesn't apply: an Ask's truth is created where the
emails and calls happen, so GHL owns it. An Obligation's state changes when
the work is done, and the doing happens in this workspace — correspondence
doesn't move it.

Rejected: a second GHL pipeline (the #144 capability audit showed it fights
the tool — hand-created pipeline, no cross-contact task queries, no
custom-field hydration on search — so every surface would read a Supabase
mirror anyway, making GHL a write-through cache with worse ergonomics);
Notion as state home (unqueryable by the desk without another sync loop —
Notion keeps the produced artefact, e.g. the report doc an Obligation
discharges into).

The resulting ownership rule: **GHL owns relationship truth** (Asks, Person
warmth/state — wins silently, per ADRs 0001/0002); **Supabase owns work
truth** (Obligations, Person↔Org roles); Xero owns dollars; Notion owns
produced artefacts. Watch-items ride the Person rail: GHL-owned next action +
review-by date, read via the Supabase mirror like all Person state.

Decided 2026-08-06 (Ben, grilling session, wayfinder ticket #151).
