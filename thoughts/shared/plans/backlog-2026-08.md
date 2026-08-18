# The queue — 2026-08-18

One ranked list. **Anything not on it is cut.** The point of writing it down is the cutting, not
the listing: a backlog that only grows is a way of never deciding.

Three rules, each from something that went wrong this week:

1. **Re-scout before doing.** The parked grantee list said "five sources need extractors". All five
   were already part-ingested and one funder was double-counted by $240M. Query the graph first.
2. **An item that survives three sessions untouched is cut, not carried.** Being on a list is not
   evidence of value; doing it is.
3. **Cheap and reversible goes first.** A one-line cron change beats a 129-file refactor even if the
   refactor is worth more, because it finishes.

---

## Do — in this order

**Every item carries the date its facts were last checked.** An item older than its evidence is a
guess wearing a plan's clothes — re-scout before acting on anything not checked this week, and move
the date when you do.

### 1. `/api/cron/usage-alerts` — delete it, don't reschedule it · scouted 2026-08-18
This item used to read "the two hourly crons, `usage-alerts` and `deliver-notifications`, ~1,440
invocations/month; 4-hourly cuts that 75%." **Both halves were wrong within a day of being written:**

- `deliver-notifications` **no longer exists** — #267 deleted it the same day, along with `run-due`.
  `vercel.json` now has 11 crons and only one hourly. So the figure is ~720/month, not ~1,440.
- Rescheduling is the wrong verb. The route reads `api_keys` to alert on keys over 80% of their rate
  limit. **`api_keys` holds 0 rows** (measured 2026-08-18). It has alerted on nothing since the April
  scope cut removed the product it serves.

So this is the same class as #267, not a tuning question: delete the cron, and decide whether
`/api/cron/usage-alerts` and the `api_keys` table go with it.
**Kill-criterion:** if API keys are coming back as a product, it stays and this item is cut instead.

### 2. Lever 2 — one decision, not 28 edits · proven 2026-08-18
`/reports/desert-overhead` was switched `force-dynamic` -> `revalidate = 3600` on the ideal
candidate (every query already `safe()`-wrapped). Build passed; **the route stayed `ƒ` Dynamic**.

`apps/web/src/app/layout.tsx:85` awaits `headers()` unconditionally to read middleware's
`x-pathname`, which makes **every** route under it dynamic — 519 dynamic, 5 static, 11 SSG. No
page-level `revalidate` can take effect until the chrome decision moves into route-group layouts.

**The decision is Ben's:** restructure the root layout (touching the layout every public page
renders), or cut Lever 2 and accept that Vercel invocations stay where they are.
**Kill-criterion:** if the restructure is not worth its blast radius, cut it — the build-skip and
the report caching were the affordable wins, and they are already banked.

### 3. Grantee gaps — the two that carry dollars · scouted 2026-08-18, re-measured 2026-08-18
- **Myer FY13-23 + FY25** — confirmed: 39 rows, `grant_year` 2024 only, 12 of them with no amount.
- **VFFF amounts** — confirmed exactly as written: 7 rows, **all 7 carry no dollars**. Either get
  amounts or delete the rows.

**But the framing is too narrow, and this is new.** `foundation_grantees` holds **6,001 rows across
181 funders, of which 1,065 (17.7%) carry no dollars**. The queue singles out VFFF's 7 and Perron
while **Paul Ramsay alone has 159 zero-amount rows of 161** — twenty times VFFF. Gandel 51 of 51,
Tim Fairfax 19 of 19, CBA 14 of 14, ACF 12 of 12, Lord Mayor's 11 of 11.

If "an edge with no dollars earns nothing in a money graph" is the rule, it is a **policy question
about 1,065 rows**, not an errand about 7. Decide the policy before doing either.

---

## Cut — with the reason, so nobody re-adds them

| cut | why |
|---|---|
| **The 83 internal uncached pages** (`/org` 47, `/clarity` 16, `/ops`, `/dashboard`) | A handful of hits a day, from Ben. Caching saves nothing measurable and risks staleness on the screens where live truth matters most. **`/ops/health` must stay uncached by design** — a cached health screen is a lie. |
| **F12 name casing** (`QUEENSLAND RAIL LTD` vs `Legal Aid Queensland`) | Many all-caps names are correct as registered. The "fix" is guesswork that can make correct names wrong. The people browser already does the safe half. |
| **A12 floating widgets** | It is a browser extension overlay, not our chrome. Not ours to fix. |
| **96 leftover `foundation_grantees` rows** | $87,150 across 96 rows, in a $34bn graph. Below the noise floor. |
| **HMST 816 held-out names** | Mostly defunct pre-2000 Victorian orgs. Resolving them creates edges to entities that no longer exist. |
| **Telethon 45 · Lotterywest 65 held-out** | Same class, smaller. Revisit only if entity coverage materially improves — not as a task. |
| **Perron grantee data** | Names only, no amounts. Same reasoning as VFFF: an edge with no dollars earns nothing. |
| **Catalogue retire-or-keep · docs-in-rail IA · 475 unfiled round 2** | Carried across three sessions untouched. That is the answer. Grooming, not value. |
| **`/clarity` dark-inside-light framing** | Listed as UNCONFIRMED for weeks with nobody blocked on it. |

---

## The process

**Weekly, not daily.** Take the top item, finish it, and only then look at the list again.

- **SAFE work lands unattended** (CLAUDE.md Landing Policy) — `scripts/`, `migrations/`, `lib/`,
  `api/`, `ops/`, `admin/`, docs. No permission round-trip.
- **VISIBLE work stops for Ben** — anything a visitor renders, including shared chrome.
- **Every item states its kill-criterion.** If it cannot be stated, the item is grooming.
- **Every item carries the date its facts were last checked**, and the date moves only when someone
  re-checks them. Two of the four items here were wrong within 24 hours of being written — one named
  a cron that had already been deleted, the other aimed at 7 rows when the real question covers 1,065.
  An undated item cannot announce that it has gone stale, so it gets obeyed instead of questioned.
- **Re-scout before starting anything data-shaped.** The graph is the source of truth about what
  exists, not this file.

When an item is done, delete it from here. When an item has been skipped three times, move it to
**Cut** with a reason. This file should get shorter.
