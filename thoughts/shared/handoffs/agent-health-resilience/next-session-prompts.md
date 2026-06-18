# Next-session prompts — bridge write-path rewrite

> Written 2026-06-18 end-of-session. Decided with Ben: do this as a **fresh pass after `/clear`**.
> The SessionStart hook auto-reloads the ledger (`current.md`), so these prompts just point at the
> task + set guardrails. Full context (broken writes, exact dedup index, fix pattern) is in the
> ledger's **"Now — NEXT TASK"** section.

State at handoff: `main` @ `ee617a4` · no open PRs · #86/#87/#88 all merged · graph 603,572 entities · ~1.96M edges.

---

## Primary kickoff prompt (both agents)

```
Resume the "Now — NEXT TASK" in the agent-health-resilience ledger: convert the two
bridge agents' WRITE paths to set-based psql so they're re-runnable and actually recover
the dropped edges.

Scope:
- bridge-justice-to-graph.mjs (justice_funding → grant edges) and bridge-person-roles.mjs
  (person_roles → directorship/member_of edges).
- Replace their per-row/REST relationship writes with INSERT INTO gs_relationships … SELECT …
  ON CONFLICT (source_entity_id,target_entity_id,relationship_type,dataset,COALESCE(source_record_id,''))
  DO NOTHING via psql — the buildRelationshipsSetBased pattern in build-entity-graph.mjs.
- For justice: lift the justice_funding edge SELECT into scripts/lib/graph-edge-datasets.mjs,
  have build-entity-graph build it, and add it to the completeness gate. Confirm the gate then
  reports justice_funding.

Constraints:
- Additive only (ON CONFLICT DO NOTHING) — don't delete existing edges.
- Verify the dedup index before writing SQL (idx_gs_rel_dedup, on the COALESCE expression).
- Validate each: dry-run candidate count → live run → check-graph-completeness.mjs shows OK.
- Don't run both write-heavy agents concurrently (shared pooler saturates — caused
  TypeError: terminated last session). Sequential only.
- Stop criteria: justice + person edges recovered AND the gate run is clean. If a write still
  errors, diagnose by reproduction, don't guess.

Tier reminders: live data writes + push/PR/merge need my explicit go (ask first). Use effort
xhigh — this is a schema-contract + multi-file design task.
```

---

## Faster scoped variant (justice only first — the bigger ~20K-edge win)

```
Resume the ledger NEXT TASK but JUST bridge-justice-to-graph.mjs first. Rewrite its broken
relationship upsert (PostgREST can't match the COALESCE expression index) as a set-based psql
INSERT…SELECT…ON CONFLICT DO NOTHING, lifting the justice_funding edge SELECT into
graph-edge-datasets.mjs so build-entity-graph builds it and the completeness gate watches it.
Validate with check-graph-completeness.mjs. Additive only, sequential, ask before live writes /
PR. Effort xhigh. Leave bridge-person-roles for a follow-up.
```

---

## Quick notes

- Start with `/preflight` (DB/env/git/types) — confirms `main` @ `ee617a4` and the gate is present.
- To see the gate's current verdict before changing anything:
  `node --env-file=.env scripts/check-graph-completeness.mjs`
  (shows the 4 gated datasets; justice_funding won't appear until the rewrite adds it.)
- Verified facts for the task (don't re-derive):
  - Only dedup index: `idx_gs_rel_dedup UNIQUE (source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id,''::text))`; pkey on `id`.
  - justice agent's program-entity creation already works (2046 created); only the relationship write is broken.
  - `bridge-justice-to-graph` runs LIVE by default (`--dry-run` to suppress); `bridge-person-roles` needs `--apply`.
