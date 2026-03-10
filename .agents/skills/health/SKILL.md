---
description: Data health + agent health dashboard — entity coverage, MV status, agent success rates
---

# /health — GrantScope Health Dashboard

Run the health check to see data coverage, materialized view status, and agent health.

## Steps

1. Run the health check:
```bash
node --env-file=.env scripts/health-check.mjs
```

2. Flags:
   - `--data` — data health only (table counts, entity coverage, MV status)
   - `--agents` — agent health only (success rates, stuck agents, freshness)
   - No flag — show everything

3. After showing results, highlight:
   - Any agents with 0% success rate — investigate and fix
   - Any stuck agents (running > 1 hour) — likely crashed, mark as failed
   - Entity coverage gaps — suggest enrichment scripts to run
   - Unpopulated materialized views — suggest refresh

4. Compare against North Star metrics in MISSION.md if the user asks about progress.
