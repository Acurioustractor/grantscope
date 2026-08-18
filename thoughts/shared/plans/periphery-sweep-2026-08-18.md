# Periphery sweep — 2026-08-18

The CLAUDE.md checklist run for real, four months after the 2026-04-24 scope cut. The tell it names
— **any screen showing a confident zero** — found four things. One of them is armed.

Method: pg_cron's job list and 7-day run history · `agent_schedules` joined against
`scripts/lib/agent-registry.mjs` and `agent_runs` · row counts on every table a cut surface touches ·
grep for consumers of each empty table.

---

## 1. `send-billing-reminders` is armed, daily, and in live-send mode

**The one to act on.** It is in the agent registry, it has an **enabled, auto-creating schedule on a
24-hour interval**, and it has **run 33 times, most recently 2026-08-18 05:31**.

The registry command is:

```
npx tsx --tsconfig apps/web/tsconfig.json scripts/send-billing-reminders.ts
```

**There is no `--dry-run` in it.** The script guards its send with `if (!DRY_RUN)` and then calls
`sendEmail()` through Gmail, `senderName: 'CivicGraph Billing'`, for trial-ending, payment-action and
cancellation reminders — a subscription product cut in April.

It has emailed nobody **because the data happens to be empty**, not because anything stops it:
`org_profiles` holds 3 rows and none are currently in a billing window, and `api_keys` holds 0. A
single row landing in `org_profiles` with a subscription status puts real billing email in a real
person's inbox for a product that does not exist.

Every other item in this document costs money or credibility. This one reaches a human.

## 2. Four schedules point at agents that are not in the registry

All four are `enabled = true` **and** `auto_create_task = true`, so the orchestrator keeps minting
tasks for them:

| schedule | interval | last actually ran (`agent_runs`) | `last_run_at` stamp |
|---|---|---|---|
| `bridge-community-directories` | 168h | 2026-06-06 | 2026-08-18 |
| `scrape-community-directories` | 168h | 2026-06-06 | 2026-08-11 |
| `ingest-open-community-directories` | 720h | 2026-06-06 | 2026-08-05 |
| `ingest-infoxchange-services` | 168h | **never** | 2026-08-17 |

None of the four exists in `scripts/lib/agent-registry.mjs` (185 agents) and none has a script on
disk. This is the deleted-cron pattern in the agent lane: the code went, the schedule stayed.

**The second half is worse than the first.** `last_run_at` reads within the last two weeks for all
four while the run log says June — or never. **The stamp is written when the task is created, not
when work succeeds**, so `agent_schedules` reports a freshness the run log contradicts. Anything
reading that column for staleness — including a human eyeballing it — is being told a job is healthy
when it has not executed since June.

## 3. The ops activation funnel measures an empty table

`apps/web/src/app/api/ops/route.ts` computes a six-stage activation funnel — linked account, weekly
active, profile ready, shortlist started, pipeline started, alert created — plus per-stage nudge
logic, over `pilot_participants`.

**`pilot_participants` holds 0 rows.** Every stage renders 0. This is the funnel the 2026-08-18
ledger flagged; it is still there, and it still reads as a measurement of a programme rather than as
the absence of one.

## 4. `retry-missed-reactions` runs 2,880 times a month for one reaction, in February

pg_cron job 1, every 15 minutes. It scans `integration_events` for events with no matching row in
`event_reactions` and re-fires a webhook.

- `event_reactions` holds **1 row, written 2026-02-27** — the only reaction ever recorded.
- `integration_events` volume: **8,860 (March) → 543 (April) → 0 (May) → 204 → 104 → 61 (August)**.
- It is the **top source of cron failures in the database** — every `job startup timeout` in the last
  10 days is this job.

The flow it retries died with the April cut. It is still the busiest scheduled job in the system.

## 5. `usage-alerts` — already on the queue, restated here for completeness

Hourly Vercel cron reading `api_keys` (**0 rows**) for keys over 80% of their rate limit. Its partner
cron `deliver-notifications` was deleted by #267. Eight files still reference `api_keys`, four of them
live API routes (`/api/keys`, `/api/agent/keys`, `/api/agent/usage`, `/api/admin/api-usage`).

---

## What came back clean

- **`vercel.json` crons**: 11 paths, all resolve to a route file — now guarded by
  `apps/web/src/lib/vercel-config.test.ts`, which is the fix from #268 doing its job.
- **pg_cron**: 7 jobs; six do real work. The clarity refresh, both MV refreshes, the pg_net cleanup
  and the ACT pipeline auto-pass all run on time with clean status.
- **The issue tracker**: down to two open issues, both live (#190 wayfinder map, #274 its frontier).

## The pattern, again

Three of the five findings are a schedule outliving its purpose, and **all three report success**.
A cron that fires, a schedule that stamps `last_run_at`, a funnel that returns 0 — none of them
errors. The 2026-04-24 lesson was that deleting code does not propagate; the sharper version is that
**the periphery fails by continuing to work**, which is why only a deliberate sweep finds it.

Nothing here has been changed. Every fix is a shared-state write and belongs to Ben.
