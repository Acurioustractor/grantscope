# Moving the searchable surfaces into the shell

**Date:** 2026-08-20 · **Status:** thinking, no work started
**Trigger:** "we build some great dashboards in the admin that I liked, and not this" — the
`/search` shell versus `/reports/youth-justice/nsw`.

Every number below was measured on 2026-08-20, not carried forward from a doc.

---

## 1. What the shell actually is

`components/shell/shell.tsx` — dark rail, light canvas, one search box, filters that belong to
the rail. The route scanner calls it **"softened shell"**: Bauhaus identity, borders thinned to
1px, radius allowed. It is scoped by path prefix (`/dashboard`), plus `/search` and `/clarity`
which opt in via their own layouts.

**It is on 19 of 303 routes.** Bauhaus is on 201.

The rail today:

| group | items |
|---|---|
| primary | Dashboard · Search · Clarity · Themes · Entities · People · Places · Reports |
| browse | Foundations · Social enterprises · Charities · Grant recipients · Contract suppliers · Government buyers · Political donors |
| saved views | Youth justice money · ACCO share · Money vs evidence · Power: top 1% |
| ops | Overview · Data health · Claims · Grant recommendations |

That is a good spine. The nouns are right and the grouping is right. The argument below is not
"redesign it" — it is "most of what belongs in it is currently living somewhere else."

## 2. The triage: three kinds of public screen, not one

The mistake available here is moving all 201 Bauhaus routes into the shell. Two thirds of them
should not go.

### A. Nouns you browse, filter and search → **belong in the shell**

A catalogue surface has the same job every time: a list, filters, a sort, a row that links to a
detail page. That is exactly what the rail is for, and it is the reason `/search` feels finished
and `/reports/youth-justice/nsw` does not.

Currently living outside the shell:

| public route | pages | shell equivalent |
|---|---|---|
| `/entities`, `/entity/*` | 10 | Entities (exists, different surface) |
| `/foundations` | 11 | `/dashboard/browse/foundations` — **duplicate** |
| `/charities` | 5 | `/dashboard/browse/charities` — **duplicate** |
| `/social-enterprises` | 2 | `/dashboard/browse/social-enterprises` — **duplicate** |
| `/grants` | 2 | `/dashboard/browse/grants` — **duplicate** |
| `/suppliers` | 1 | none |
| `/person/*` | 2 | People (exists) |
| `/place/*`, `/places/*` | 8 | Places (exists) |
| `/power`, `/rankings` | 2 | none |
| `/procurement` | 4 | none |
| `/opportunities` | 1 | none |
| `/evidence`, `/evidence-packs` | 2 | none |
| `/sector` | 1 | none |

**Four nouns exist twice, in two different design systems.** Charities, foundations, social
enterprises and grants each have a public Bauhaus browse AND a shell browse. That is not a
styling inconsistency, it is two products. Deciding which one survives is the first decision,
and it is worth more than any amount of retokening.

### B. Arguments you read → **stay editorial, get their own treatment**

The 86 `/reports/*` pages are essays with charts. A dark rail does not help you read an
argument, and putting one there would make them worse. But "not the shell" is not the same as
"what they look like now" — they need a consistent *report* treatment, which is a separate and
smaller job than the shell migration.

The screenshot that started this is a report page, and its problem is not that it lacks a rail.
It is that its four hero tiles are `bg-red-50 / bg-blue-50 / bg-amber-50 / bg-emerald-50` with
`rounded-xl` — raw Tailwind defaults, no token within reach. 907 `rounded-*` and 462 off-palette
colour hits across `app/`. Nothing enforces the palette, which is why it accumulated silently.

### C. Front door → **stays loud**

`/pricing`, `/how-it-works`, `/about`, `/get-a-report`, `/home`. Bauhaus is right here. Leave them.

## 3. The thing that makes the same page look like two products

```
app/layout.tsx:180
className={`font-sans antialiased ${qlFontVars} ${isLoggedIn ? 'ws' : ''}`}
```

`.ws` repaints every `bauhaus-*` colour with `!important`, thins `border-4` to 1px, and is
excluded from the global `border-radius: 0` rule. So **every page in the app renders differently
depending on whether you are signed in**, and the version we show the public is the one nobody
is looking at while they work.

This needs a decision before any migration, or the migration gets evaluated against the wrong
rendering.

## 4. What we have data for and cannot search

The rail's seven browse entries cover foundations, social enterprises, charities, grant
recipients, contract suppliers, government buyers and political donors. Measured today, here is
what the database holds that has **no searchable surface anywhere**:

| dataset | rows | why it matters |
|---|---|---|
| `grant_opportunities` | 26,137 (**4,452 open**, 354 closing within 60 days) | the only forward-looking money in the building. Everything else is history. |
| `state_tenders` | 199,719 | read by report pages, browsable nowhere |
| `acnc_ais` | 360,844 | charity financials by year — the charities browse is the register, not the money |
| `mv_entity_power_index` | 185,393 | `/power` exists as one page, not as a browsable surface |
| `mv_board_interlocks` | 39,757 | see the people gap below |
| `ato_tax_transparency` | 26,241 | who pays no tax — no surface at all |
| `alma_interventions` + `alma_evidence` | 2,145 + 631 | "what works" — the evidence half of the product |
| `mv_revolving_door` | 3,586 | entities with 2+ influence vectors |
| `mv_funding_deserts` | 1,955 | on the Atlas, not searchable |
| `abr_registry` | 20.0M | the ABN register |
| `asic_companies` | 2.17M | company register |

**The people gap is the sharpest.** Search returns people from `mv_board_interlocks` — which by
definition only contains people on **two or more** boards. `person_identities` holds 230,000
resolved identities. So roughly **83% of the people we know about cannot be found by searching
for them**, and nothing on the page says so.

`grant_opportunities` is the sharpest *product* gap: 4,452 currently-open opportunities, and no
way for anyone to browse them. Note the data needs a date filter before it ships — the table's
latest deadline is 2051-03-31, so an unfiltered count would claim 26,137 open opportunities.

## 5. The live map

`/atlas` — full-viewport, **9 layers**, 8 public and 1 consent-gated:

Funding deserts · Recorded money · Justice money · Federal grants · SEIFA disadvantage ·
Unplaced organisations · Funding renewal cliff · What works here · Goods in community (gated)

`/map` 307-redirects to it. The layer registry is typed, the consent tiers are enforced in code,
and the placement provenance is stamped per-row (`lib/atlas/stamps.ts`).

**It is not in the rail.** "Places" in the rail goes to `/dashboard/places`, a different surface.
So the best place-based thing we have built is reachable only if you already know the URL.

The Atlas is also the natural home for three of the unsearchable datasets above — funding
deserts is already a layer, and tenders and opportunities are both inherently place-shaped.

## 6. The decisions, in the order they block each other

1. **Signed-in vs signed-out rendering.** Is `.ws` the design, or is Bauhaus the design? Right
   now both are, conditionally. Nothing else can be judged until this is settled.
2. **Which of the four duplicated nouns survives** — public Bauhaus browse, or shell browse.
   This is one decision applied four times, not four decisions.
3. **Does the shell go public?** Today it is behind `/dashboard`. Moving catalogue surfaces into
   it either means the shell becomes the public browse experience, or the public keeps a second
   one. Answering (2) mostly answers this.
4. **Report treatment** — separate track, separate PR, does not wait on 1–3.
5. **Atlas into the rail**, and whether Places means the Atlas or the dashboard page.

## 7. What is worth doing before any of it

The palette drift is unenforced. Whatever design wins, a build-failing lint banning raw Tailwind
colour classes on the surfaces we care about stops the next 462 hits from accruing while the
migration is in flight. That is cheap, it is independent of every decision above, and without it
the migration is a snapshot rather than a state.
