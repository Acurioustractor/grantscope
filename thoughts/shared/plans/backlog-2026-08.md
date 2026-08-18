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

### 1. The two hourly crons · Ben · 1 line each
`usage-alerts` and `deliver-notifications` run hourly — ~1,440 invocations/month between them.
4-hourly cuts that 75%. The only cost is notification latency, which is a product decision.
**Kill-criterion:** if either genuinely needs to be hourly, say so and it stays hourly forever.

### 2. Lever 2 — BLOCKED, and not where we thought · proven 2026-08-18
Tried exactly as specified: `/reports/desert-overhead` (static route, every query already wrapped in
`safe()` with a fallback, so a build-time query failure cannot break the build — the ideal candidate).
`force-dynamic` -> `revalidate = 3600`. Build passed. **The route stayed `ƒ` Dynamic.**

**Cause:** `apps/web/src/app/layout.tsx:85` awaits `headers()` unconditionally to read the
`x-pathname` that `middleware.ts:41` sets, then branches on it to pick chromeless vs marketing
chrome. A root layout that reads `headers()`/`cookies()` makes **every route under it** dynamic, so
no page-level `revalidate` can ever produce a static or ISR route. Measured on that build:
**519 dynamic routes, 5 static, 11 SSG.**

So Lever 2 is not 28 mechanical page edits. It is one structural change first: move the chrome
decision out of root-layout pathname sniffing and into route-group layouts, so the root layout stops
touching request headers. Only then does `revalidate` on a page do anything.

**Kill-criterion:** if the route-group split is not worth its blast radius (it touches the layout
every public page renders), Lever 2 is cut and Vercel invocations stay where they are — the
build-skip and report caching were the affordable wins.

### 3. Cache the ~14 high-traffic PUBLIC pages · 1 hour
`/`, `/home`, `/suppliers`, `/grants`, `/grants/[id]`, `/charities/[abn]`, `/charities/insights`,
`/places/[postcode]`, `/giving`, `/giving/quality`, `/pipeline`, `/opportunities/ecosystem`,
`/embed/entity/[identifier]`, `/changes`. Same `unstable_cache` shape proven on the 22 report pages.
**Why these and not the other 67:** these are the ones a stranger can hit.

### 4. Grantee gaps — only the two worth it · harness makes each ~1h
- **Myer FY13-23 + FY25** — real volume; we hold 2024 only.
- **VFFF amounts** — its 7 edges all carry $0, so the data is currently inert. Either get amounts or
  delete the 7 rows; a funder→grantee edge with no dollars earns nothing in a money graph.

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
- **Re-scout before starting anything data-shaped.** The graph is the source of truth about what
  exists, not this file.

When an item is done, delete it from here. When an item has been skipped three times, move it to
**Cut** with a reason. This file should get shorter.
