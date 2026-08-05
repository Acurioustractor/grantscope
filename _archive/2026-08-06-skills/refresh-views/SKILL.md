---
description: Refresh all GrantScope materialized views in dependency order with timing
---

# Refresh Materialized Views

Refresh all materialized views in the correct dependency order.

## Steps

1. Run the refresh script:
```bash
node --env-file=.env scripts/refresh-views.mjs
```

2. Report results to the user — show which views refreshed, how long each took, and total time.

3. If any view fails, show the error and suggest checking:
   - Whether the underlying tables have changed schema
   - Whether there are lock conflicts (another refresh running)
   - The view definition with `\d+ view_name`
