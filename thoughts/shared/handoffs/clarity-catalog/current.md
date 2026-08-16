---
date: 2026-08-16T03:00:00Z
session_name: clarity-catalog
branch: main
status: active
---

# Work Stream: clarity-catalog → clarity-console

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-16T03:00:00Z
**Goal:** The `/clarity` **console rebuild**. Issue #190 (the 26-question registry) is DONE. Two design grillings produced two plans; four slices shipped; a data audit found a $12.12bn correction.
**Branch:** `main` at `a851a9e`, everything pushed, clean tree. PRs #215–#218 all merged. **8 migrations applied.**
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (731 pass, 79 files) · `node --env-file=.env scripts/run-clarity-answers.mjs --dry-run` (**17/19 ok**, up from 16/19)
**Local:** dev server on 3013 (`--turbopack`). `/clarity` needs no login locally (`admin-auth-bypass.ts`). **Vercel preview does NOT bypass** and Ben's sign-in there failed — unresolved, see Open Questions.

### Now
[->] **The justice_funding correctness lane is CLOSED end to end** — rule, view, sentinel, both matviews, seven app queries, and the labels. Nothing is in flight. Next: either the `justice_*` DB column rename (dual-name transition, another nine-object rebuild + 33 files), or back to part 2 of the console plan (slice D, `/search`).

### The reframe — most important thing in this ledger
Grilling 2 was triggered by Ben's verdict on the shipped console: *"very code tech speak… wanna see real data and how it all connects."* Going looking for what to build, three times the answer was **it already exists**:

| Looked for | Found |
|---|---|
| A real-data surface | **54 report dirs in 13 themes** — qld-youth-justice, child-protection, donor-contractors, who-runs-australia |
| A way to show connection | **`/entity/[gsId]`, 958 lines, 16 parallel cross-system queries** |
| A search | **`unified-search.tsx`, 495 lines**, already grouped by kind |
| An ACT workspace | **62 pages under `/org/[slug]`** |

**276 page routes exist. `/clarity` indexed 1,479 DB objects and zero of them.** Navigation and coherence problem, not a build problem. Part 2 is mostly connection and deletion.

### This Session
- [x] **Merged #215, #216, #217.** Issue #190 closed; slices 1, 3 and E on main.
- [x] **Slice 1 — `/clarity/o/[key]`**, a page for every object. ~60 curated fields that had nowhere to be read.
- [x] **Slice 3 — the index becomes the front door.** 1,479 objects, six nouns, **15,052px down from 70,614 showing 257 MORE objects.** Old ledger → `/clarity/catalogue`. 747 unfiled, two causes kept visibly apart.
- [x] **Slice E — one visibility vocabulary.** `public → org → operator → withheld`, generalising `/atlas`.
- [x] **Slice B — theme pages** at `/reports/theme/[slug]`. Accountability & Power is count-only (10 of 20 review-status reports live there and it names individuals).
- [x] **Slice C — real money.** Youth Justice: **$1.04bn, 4,665 grants, 1,404 organisations**, each linking to its entity page.
- [x] **Audit + 5 applied migrations** (see below).

### THE DATA FINDING — carry this forward
`measure_kind = 'grant'`, documented in CLAUDE.md as *the* mandatory filter, is incomplete.

| filter | rows | total |
|---|---|---|
| `measure_kind='grant'` | 126,673 | **$46.10bn** |
| …minus aggregate-shaped recipient names | 126,627 | $38.01bn |
| …**and `is_aggregate IS NOT TRUE`** | **125,300** | **$33.98bn** |

**26% off the headline.** I corrected it twice in two hours — the first correction was itself wrong. `measure_kind` and `is_aggregate` are independent; neither implies the other (1,358 rows are grant AND aggregate, $12.06bn; 330 expenditure_aggregate rows are is_aggregate=false, $17.39bn).

**Coverage:** 47 views read `justice_funding`, **4** reference `measure_kind`. 100 app files reference it, **2** do.

- **`justice_funding_clean` reports $117.47bn vs an honest $33.98bn** — 3.1x. It did not expose `measure_kind`, so no caller *could* fix it. Now fixed (migration 20260816020000).
- **462 of 848 whole-of-state budget rows carry a `gs_entity_id`, $37.49bn** — they land on six government departments.
- **`mv_entity_total_funding.justice_total` lists QUEENSLAND RAIL as the #2 recipient of justice funding in Australia, $4.1bn.** 13 rows, correctly labelled grants, actually Transport Service Contracts and a Rail Concession Scheme. **`measure_kind` would NOT catch this — only topic scoping does.** 28-file blast radius. **STILL UNFIXED.**

Full audit: `thoughts/shared/data-map/justice-funding-filter-audit.md`

### Migrations applied this session (production, on explicit instruction)
| | |
|---|---|
| `20260816020000` | `measure_kind` + `is_aggregate` on `justice_funding_clean`. Additive; no number moved (still 151,866 / $117.47bn). |
| `20260816030000` | Register `justice-money-to-orgs` ($33.98bn) + `measure_kind_contamination` sentinel. |
| `20260816040000` | Exemption for the new question. |
| `20260816050000` | `is_aggregate` added to 3 questions; 4th exempted. |
| `20260816060000` | **`mv_entity_total_funding` rebuilt.** justice $77.08bn → **$31.59bn**, donations $77.99bn → **$12.00bn**. $111.48bn of phantom money. Both defects — the donations one (missing `receipt_type`) was found while fixing the justice one. |
| `20260816070000` | Superseded — correct SQL, wrong drop strategy. |
| `20260816080000` | **Nine-object rebuild, APPLIED.** `mv_entity_power_index` + all 8 dependents. justice $83.53bn → **$32.20bn**, donations $77.99bn → **$12.00bn**, rows 188,189 → 185,265. **$117.32bn removed.** |

### THE APP LAYER — traced and fixed 2026-08-16
Every remaining "Justice Funding" label traced to its query. **None applied a topic filter; none applied the money filters.** Seven fixed:

| surface | defect |
|---|---|
| **`api/justice/closing-the-gap`** | **A RATIO.** Indigenous funding ÷ total, denominator **$120.56bn vs an honest $34.04bn — 3.5x**. The Indigenous share of justice funding was understated by roughly that factor. A contaminated numerator is a wrong number; a contaminated denominator is a wrong ARGUMENT. |
| `api/justice/evidence-pack` ×3 | 31 `expenditure_aggregate` rows worth **$1.72bn** are ALMA-linked — an evidence pack sent to a funder could report $1.7bn of state budget as one intervention's funding |
| `api/justice/interventions` | same ALMA-linked contamination |
| `places/[postcode]` | state-scoped only; QLD alone has 106 aggregate rows in scope |
| `org/[slug]/intelligence` | summed the ENTIRE table, $120.56bn, labelled "Justice Funding". It IS a deliberate platform-wide panel (I first read it as unscoped and was wrong) — but number and label were both wrong |
| `entity/[gsId]` | ran its OWN unfiltered queries, so after the matview fix the same page showed two contradictory figures. **A contradiction I introduced.** |

**Labels renamed** where untrue: "Justice Funding" → **"Recorded Grants"**, presence chip "Justice" → "Grants", on entity page (3), compare, org-sections (2), org intelligence. Queensland Rail's public page no longer calls $4.1bn of Transport Service Contracts "Justice Funding".

**`applyGrantFilters()` / `GRANT_FILTER_SQL`** added to `lib/justice-money.ts` so the next caller inherits the predicate. It deliberately applies only TWO of three filters: PostgREST's `in` is case-sensitive, so a name list would silently fail to match `'Total'` while looking like protection. Affordable because `is_aggregate` catches 31 of the 46 aggregate-named rows and **$8.03bn of their $8.09bn**; residual is 15 rows / $60.1m.

**`mv_entity_power_index` does NOT derive from `mv_entity_total_funding`.** It reads the base tables directly and carries both defects independently, at FOUR sites — two dollar sums and two PRESENCE flags. `system_count` feeds `power_score`, so an unfiltered presence flag reorders a ranking 28 files read. Current: justice $83.53bn (honest ~$32.38bn), donations $77.99bn (honest ~$12.00bn).

**The filters were verified before the attempt and every entity that drops out is an artifact:**
- Justice presence: five state justice departments carrying budget rows, plus **"TOTAL RPA" ($4.74bn)** — a spreadsheet total resolved to a graph entity *and given an ABN*.
- Donation presence: **6,005 of 10,983 donor ABNs (55%)**, including the **AUSTRALIAN ELECTORAL COMMISSION at $1.04bn** — the regulator that publishes the data, ranked as a billion-dollar political donor.

**The sentinel caught a 40% error within minutes of being applied.** It is `block` severity and permanently tripped by design (71.81% of dollars in the table are not money to an organisation), so every question must filter or write an exemption. `youth-justice-total` went **$1,534.2m → $0.916bn**; the 21 rows carrying $618.5m were the qld-historical-grants column totals. `evidence-gap` 778→777 orgs. All four exemptions written NARROWER than the sentinel so none can justify an unscoped justice figure later.

### Next
- [ ] **The `justice_*` DB COLUMN rename** — `justice_dollars`, `justice_total`, `in_justice_funding` still say "justice" in the schema. Needs a DUAL-NAME transition (add new names alongside, migrate 33 files, then drop old), because PostgREST would break the app between a flag-day migration and the deploy. Another nine-object rebuild. The COMMENTs on both matviews already state what the columns hold.
- [ ] **Decide the `justice_total` naming** (superseded by the above, kept for the reasoning). Queensland Rail is now #1 at $4.10bn in `mv_entity_total_funding` and is NOT fixable by filtering — its rows are genuine grants from `qgip`, a whole-of-Queensland-government register that is 81% of all grant rows and only 19.7% topic-tagged. Rename across 28 call sites, or scope by source.
- [ ] Then part 2: **D** (`/search`, reconcile the two existing components, extend 3 kinds → 8), **F** (report status at every link), **G** (themes above the noun index), **H–K**.
- [ ] From part 1: slice 2 (inline edit for 667 stubs), 4 (nouns propose/confirm), 5 (row viewer + consent), 6b (code scanner — **prerequisite for the orphan detector**, which would otherwise report 1,151 false orphans).
- [ ] Decide per-view whether each of the 35 unfiltered money views is wrong FOR ITS PURPOSE. A "state expenditure" view SHOULD include budget rows.

### Decisions
- **Completeness at the index layer, refusal at the claim layer.**
- **A screen may be stricter than its data, never looser.** Data declares a floor; `mostRestrictive()` makes a page inherit the worst of what it reads. Testable.
- **Absence is always stated, never silent.** Exception: a count of 1 in a small community is a name (`SMALL_COUNT_THRESHOLD = 5`).
- **Findings first, plumbing last**, every surface.
- **Key numbers on public pages come ONLY from registered questions.** No lifting figures from report prose.
- **Accountability & Power review reports are counted, not linked.**
- **Stories link to projects, never to data.** Project-mediation is the only version that cannot re-identify.
- **No free-text querying.** Saved parameterised queries + the row viewer; they carry their caveats with them.
- **ACT extends `/org/act` (62 pages)**, not a fourth front door.
- Visibility vocabulary is **NOT** the commercial `Tier` ladder. Paid-for vs allowed-to-see.
- **Withheld beats promoted, always.** If an object is in both lists, that is a bug and it resolves towards consent.

### Traps confirmed by query
- `clarity_object.object_key` / `clarity_edge.src|tgt_object` are **bare**; `clarity_question_ingredient.object_key` is **`public.`-prefixed** and CHECK-constrained. Wrong form returns nothing rather than erroring.
- **Postgres sorts NULLs FIRST in `DESC`** — a naive "top recipients" query returns the rows with no amount.
- **Topic tags overlap**: youth-justice ∩ diversion = 98 rows; child-protection ∩ family-services = 2. Dedupe by `id`.
- **`history` contains `story`** — a `/story/` pattern withholds 5 history tables and misses `quotes`. Consent floors are an explicit list.
- **A domain-only consent rule leaks**: `story_analysis`, `transcript_analysis` (ai_agents_pipeline), `tour_stories` (media_narrative), `partner_storytellers_v` (no domain).
- `refs_app`/`refs_script`/`refs_migration` are 0 on all 1,479 — scanner never ran. `owner_app` = 'neither' on all. `null_pct` null on all 16,124 columns.
- `importance` tied at `0.0225` for 424 objects — cannot rank.
- **Before any `gh pr merge --delete-branch`, run `git log origin/<branch>..HEAD`** and push what it lists. A ledger commit was stranded this way and had to be recovered from a dangling commit.
- **MATVIEW GRANTS LIVE IN `pg_class.relacl`, NOT `information_schema.role_table_grants`.** The latter returns ZERO grants for every matview and would have silently stripped `service_role` and `agent_readonly` on rebuild — a failure that surfaces only when something breaks in production.
- **PostgREST's `in` is case-sensitive.** A name-exclusion list of lowercase values does not match `'Total'` and reads as protection while doing nothing. Use raw SQL with `lower(btrim(...))` where the exclusion must be exact.
- **Before any `DROP MATERIALIZED VIEW`, enumerate dependents.** `BEGIN; DROP MATERIALIZED VIEW x CASCADE; ROLLBACK;` prints the full list safely. `mv_entity_total_funding` has 0 dependents; `mv_entity_power_index` has **8**. I checked the first and assumed the second — the transaction caught it, I did not.
- **A matview definition may exist ONLY in the database.** `scripts/refresh-total-funding-mv.mjs` merely refreshes; nothing in the repo held the definition. Rebuild migrations should be written by capturing `pg_get_viewdef` and applying targeted edits programmatically, not by retyping.
- Public home `app/page.tsx` has **5 broken HTML entities in JS string literals** (lines 175, 183, 213, 244, 246) rendering as literal `&rsquo;`. Pre-existing, unfixed, live.

### Open Questions
- **UNRESOLVED: Ben cannot sign in to the Vercel preview.** "Invalid login credentials" for `benjamin@act.place`, which IS in `ADMIN_EMAILS` and DOES exist in `auth.users` on `tednluwflfhxyucgwigh`. Either the password or **preview env vars point at a different Supabase project**. Vercel SSO blocked me from checking. Compare Preview vs Production `NEXT_PUBLIC_SUPABASE_URL`.
- **Consent on `transcripts` is FIVE independent flags**, not one boolean: `consent_for_ai_analysis`, `_quote_extraction`, `_theme_analysis`, `_story_creation`. `floorFor()` is binary — safe direction, but **slice 5's row viewer must read them per row**.
- Whether the Accountability & Power count-only rule survives Ben seeing it applied.
- Whether each of the 35 unfiltered money views is wrong for its purpose — per-view judgement, not a sweep.
- The commercial `Tier` ladder is unreconciled with the visibility vocabulary. Must be before anything is sold.
- Six `/clarity` rendering defects remain unfixed **by design** — slices B–G delete most of the surfaces they live on.
- Still open from before: `person_roles` aggregate exposure; the `/foundations/backlog` caller; three unexplained criticals (2026-04-02); 9,607 duplicate canonical names.

### Workflow State
pattern: console rebuild, two plans
phase: part 1 slices 1/3/E merged; part 2 slices B/C in PR #218
retries: 0

#### Resolved
- issue #190 / the 26-question registry — DONE
- "does /clarity look right" — **ANSWERED, and the answer was no.** It read as tech-speak. That produced grilling 2 and part 2.
- "is the documented money filter correct" — **NO.** 26% overstated. Corrected in CLAUDE.md, in code, and in the registry.

#### Unknowns
- **preview_login: BLOCKED.** Ben has still not seen any of this on a deployed URL.
- **mv_entity_total_funding: KNOWN WRONG.** Queensland Rail as #2 justice recipient. Unfixed.
- http_write_paths: the three `/api/clarity` routes have still never served a request.
