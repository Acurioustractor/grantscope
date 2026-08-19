---
name: surface-sweep
description: Render every route in a section against the live database and report which are broken, blank, silently-partial or slow — attributing each failure to a page from the server log rather than guessing. Catches the pages that return 200 while all their queries fail. Use on /surface-sweep, "check the reports still work", "which pages are broken", before turning on a flag that changes what many pages read, or after a shared data-layer change.
---

# /surface-sweep — 200 is not the same as working

Before turning on `CIVICGRAPH_LIVE_REPORTS` — a one-line change that switched 61 public pages
from an empty stub to live queries — this sweep found:

- `/reports/donor-contractors` **crashed**: `dc.contract_years is not iterable`. Three of 2,065
  rows have a NULL array column, and fourteen sites iterate it. It could never have been hit while
  the page had no rows.
- `/reports/influence-network` returned **200 while every query failed** — it reads
  `mv_revolving_door` for nine columns that live on `mv_entity_power_index`, plus a statement
  timeout. It renders a confident zero.
- `/reports/picc` — `operator does not exist: uuid = text`.
- `/reports/youth-justice/qld/sector` — a write-shaped query rejected by `exec_sql`, plus a timeout.

**Three of those four return HTTP 200.** A status-code sweep would have passed them all. The
server log is where the truth is.

## Procedure

### 1. Start the server in the state you are testing

```bash
cd apps/web && CIVICGRAPH_LIVE_REPORTS=true npm run dev -- --turbopack -p 3013 \
  > <scratchpad>/dev.log 2>&1
```

Run it in the background and **keep the log** — step 4 depends on it. Port 3013 is canonical;
JusticeHub squats 3014, so verify the port maps to this repo before trusting any 200.

### 2. Enumerate routes from the filesystem, never by hand

```bash
cd apps/web/src/app/<section>
find . -name page.tsx | grep -v '\[' | sed 's|^\./||; s|/page.tsx$||' | sort
```

Dynamic routes (`[state]`, `[id]`) need real ids — fetch a handful from the database and test
those separately. A hand-written route list starts lying the first time someone adds a page.

### 3. Fetch each, recording more than the status code

Status, byte count, and a marker for the section's honest-empty component (`ReportUnavailable`
renders "Data unavailable"). Write to a TSV; do not stream 61 pages into the conversation.

Use `curl -sL` — without `-L` a 307 to a hand-built page reads as a failure. Expect this to take
30–60 minutes on a dev server, because each route compiles on first hit. Run it in the background.

### 4. Attribute failures to pages FROM THE LOG — this is the step that matters

```bash
grep "query failed" <scratchpad>/dev.log | sort | uniq -c | sort -rn
grep -B 8 "query failed" <scratchpad>/dev.log | grep -E "Compiled /|GET /|query failed"
```

The `-B 8` window is what ties a failed query to the route that ran it. Without it you have a list
of errors and no idea which page owns them.

### 5. Separate real failures from your own edits

If you edit files mid-sweep, Turbopack serves stale modules and you get 500s that are artefacts,
not findings: `(0, ...liveReportsEnabled) is not a function` for a function that exists and
typechecks. **Restart the server and re-fetch anything that failed** before reporting it. Two of
three 500s in the 2026-08-20 sweep were this.

### 6. Report in four buckets, not two

| bucket | meaning |
|---|---|
| **broken** | non-200, or 200 with an exception in the log |
| **silently partial** | 200, but the log shows failed queries — the confident-zero case |
| **blank** | 200, no errors, no data — is that honest or a defect? |
| **slow** | statement timeouts; they will behave differently under production load |

State the count you swept and the count you skipped. A sweep that quietly omits dynamic routes
reads as "everything is fine".

## What NOT to conclude

- **A 200 is not a pass.** Check the log for every route, not just the failures.
- **A blank page is not necessarily broken.** It may be honest — CLAUDE.md's rule is that a
  confident zero must be disclosed, not that it must be filled.
- **Do not fix everything you find mid-sweep.** Collect, then decide. Fixing a crash that blocks
  a flag flip is in scope; rewriting a page against the correct matview is its own PR.

## Definition of done

- [ ] Every static route in the section fetched; dynamic routes tested with real ids or explicitly
      listed as skipped
- [ ] Each failure attributed to a route from the server log, not inferred
- [ ] Stale-module artefacts eliminated by a clean restart and re-fetch
- [ ] Results in four buckets, with the swept and skipped counts stated
- [ ] Anything that blocks a pending change fixed; everything else written up, not silently carried
