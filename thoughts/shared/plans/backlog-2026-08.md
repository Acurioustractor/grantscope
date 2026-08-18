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

### 1. `scripts/wizard-pm2-startup.sh` · Ben · 2 min
The orchestrator was down two days and nothing said so. `pm2 save` is done; only the launchd job is
missing, and it needs a sudo line. Until it runs, one reboot repeats the whole outage.
**Why first:** smallest action on the list, closes an entire failure class.

### 2. The two hourly crons · Ben · 1 line each
`usage-alerts` and `deliver-notifications` run hourly — ~1,440 invocations/month between them.
4-hourly cuts that 75%. The only cost is notification latency, which is a product decision.
**Kill-criterion:** if either genuinely needs to be hourly, say so and it stays hourly forever.

### 3. Lever 2, proven on ONE page · half an hour
`force-dynamic` → `revalidate` is the **only** thing that cuts Vercel *invocations*. The build-skip
and the report caching did not touch them. The risk is real — ISR prerenders at build time, so the
build queries Supabase, which is a known way to break builds here.
**Do:** pick one low-traffic public report, switch it, watch the build. If the build survives, the
pattern is proven and the next 20 are mechanical. If it breaks, we know in one page instead of 28.

### 4. Cache the ~14 high-traffic PUBLIC pages · 1 hour
`/`, `/home`, `/suppliers`, `/grants`, `/grants/[id]`, `/charities/[abn]`, `/charities/insights`,
`/places/[postcode]`, `/giving`, `/giving/quality`, `/pipeline`, `/opportunities/ecosystem`,
`/embed/entity/[identifier]`, `/changes`. Same `unstable_cache` shape proven on the 22 report pages.
**Why these and not the other 67:** these are the ones a stranger can hit.

### 5. Grantee gaps — only the two worth it · harness makes each ~1h
- **Myer FY13-23 + FY25** — real volume; we hold 2024 only.
- **VFFF amounts** — its 7 edges all carry $0, so the data is currently inert. Either get amounts or
  delete the 7 rows; a funder→grantee edge with no dollars earns nothing in a money graph.

### 6. Close the 6 stale issues · 5 min
#246-#251 are open for browsers that shipped days ago. A tracker that lies about what is outstanding
is worse than no tracker.

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
