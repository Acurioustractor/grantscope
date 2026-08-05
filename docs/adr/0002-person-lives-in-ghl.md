# The Person lives in GHL; roles live in Supabase; CivicGraph annotates

A Person (a human ACT deliberately cultivates) extends the Ask pattern from
ADR 0001: not in GHL = not a Person, and minting a Person = creating/claiming
the GHL contact. GHL owns existence, warmth (one value per Person, with a
"warm via" holder), owner, next action, and last touch; on any state
disagreement GHL wins silently.

Two deliberate deviations from a pure GHL master, both forced by the GHL
capability audit (#144: no cross-contact task queries, no custom-field
hydration on search):

1. **Supabase holds a read-mirror** of Person state, synced by the daily
   reconcile agents — the desk and workspace surfaces query the mirror, never
   GHL live. Every mirrored fact carries `last_synced_at` and a stale badge
   past 24h.
2. **Person↔Org roles (works-at, board-of, decides-for) are Supabase-owned**,
   not mirrored. They are ACT's structural knowledge, changed by human
   decision in the workspace, and GHL has no native place for them.

CivicGraph person data (board interlocks, `mv_person_influence`, shared-
director "opens" evidence) annotates read-only — Signals about potential
People, never People.

Rejected: CivicGraph/Supabase as writable master (two masters → drift, same
argument as ADR 0001); warmth per role or per Ask (warmth is about the human,
not the hat; stages already cover Ask progress); auto-minting People from
datasets (159K person rows are not relationships).

Decided 2026-08-06 (Ben, grilling session, wayfinder ticket #145).
