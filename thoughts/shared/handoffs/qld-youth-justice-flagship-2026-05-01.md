# QLD Youth Justice flagship — handoff (2026-05-01)

**Status:** shipped through commit `598962c` on `main`. Production live.

## What this is
A flagship investigative report at `/reports/youth-justice/qld/sector` (+ `/share/qld-youth-justice` chromeless mirror + `/long-read` narrative companion). Built across 25+ commits. Now 7 volumes / 26 sections / 5 promise→action→outcome chains / 50+ click-to-expand drawer cards / cross-state companion routes for NSW/VIC/WA.

## Story arc (the editorial spine)
```
TODAY (V1) → why they're there (V2) → who paid (V3) → who runs it (V4) →
what works (V5) → where (V6) → what's accelerating (V7) → §25 promise→
action→outcome chains → what would shift it (closing 4 moves)
```

## Key files
- `apps/web/src/app/reports/youth-justice/qld/sector/page.tsx` — flagship dashboard (~2600 lines)
- `apps/web/src/app/reports/youth-justice/qld/sector/long-read/page.tsx` — long-read narrative (live data + 17 findings)
- `apps/web/src/app/reports/youth-justice/[state]/sector/page.tsx` — NSW/VIC/WA cross-state pages
- `apps/web/src/app/share/qld-youth-justice/{page,long-read/page}.tsx` — chromeless wrappers
- `apps/web/src/components/reports/DetailDrawer.tsx` — click-to-expand drawer (`<dialog>`-based)
- `apps/web/src/lib/civicgraph-summary.ts` — ministerial / hansard / coroner body-text summarisers
- `scripts/scrape-qld-bills.mjs` — Playwright scraper, parliament.qld.gov.au
- `scripts/scrape-qld-coroners.mjs` — Playwright scraper, coronerscourt.qld.gov.au
- `scripts/scrape-nsw-bills.mjs` — NSW bills (template for VIC/WA)
- `scripts/migrations/2026-05-01-qld-bills.sql` + `bills-coroners-jurisdiction.sql` + `qld-yj-policy-tables.sql` + `yj-bills-view.sql`

## Live tables/views feeding the report
- `civic_ministerial_statements` (jurisdiction='QLD' YJ-tagged) — 12 most recent in §23
- `civic_hansard` (497 records, 80 QLD YJ-relevant) — §24.5 cards, party-volume bar
- `parliament_bills` (jurisdiction-aware, 56 QLD + 100 NSW) — §24.6 active + §24.7 passed
- `coroners_findings` (jurisdiction-aware, 39 QLD ingested, 8 in-custody flagged) — §24
- `v_qld_yj_bills_active` — hansard-derived bill mention volume
- `v_qld_watchhouse_latest` — live watchhouse occupancy (twice-daily refresh)
- `mv_yj_report_acco_gap` — 12% / 88% split
- `alma_interventions` — 16 QLD-tagged in §16, 6 unfunded in §17
- `lga_cross_system_stats` — pipeline_intensity scores in §4

## Section map (use these anchors)
- `#vol-1` Volume 1 — The State Today (§1 watchhouse · §2 bed problem + planned facilities · §3 CTG)
- `#vol-2` Funnel (§4 LGA pipeline · §5 NDIS · §6 mental-health blind spot · §7 education→welfare)
- `#vol-3` The Money (§8 spend ratio · §9 top recipients · §10 ACCO gap · §11 foundations · §12 procurement)
- `#vol-4` The Network (§13 multi-system providers · §14 director interlocks · §15 political donations)
- `#vol-5` Evidence (§16 ALMA · §17 unfunded · §18 royal commissions)
- `#vol-6` Place (§19 LGA hotspots · §20 case studies · §21 Maranguka)
- `#vol-7` Policy & Live (§23 ministerial statements · §23.1 structural backdrop · §24 oversight + LIVE coronial · §24.5 Hansard · §24.6 active bills · §24.7 passed bills · §25 promise→action chains · §25.5 synthesis)

## Drawer pattern (already wired)
- §23 ministerial cards → drawer with lede bullets, body excerpt, key-value, topics
- §24 coronial cards → drawer with catchwords, cause of death, key excerpt, key-value
- §24.5 Hansard cards → drawer with opening sentence, speech excerpt, speaker key-value
- §24.7 bills cards → drawer with curated key amendments + opposition voices + capital backing + outcome proxies (BILL_DETAILS const, 6 entries)
- §16 ALMA cards → drawer with full description, evidence/cultural/cost key-value, methodology note

Pattern: `<DetailDrawer trigger={<card />} title={...} subtitle={...} sourceHref={...}>{<DrawerSection> / <DrawerKeyValue>}</DetailDrawer>`. Server-renders the body text using the summarisers in `civicgraph-summary.ts`.

## §25 chain set (5 chains)
1. 🔴 Adult Crime Adult Time — outcomes worsening
2. 🟡 Path to Treaty repeal — institutional removal, no replacement
3. 🔴 Bail monitoring — promise lands, outcome contradicts (children → remand → watchhouse)
4. 🔵 Detention capacity expansion — capital pipeline delivering
5. 🔵 Townsville Step Up Step Down (preventive) — proof-of-concept, scale TBD

## Gotchas / tribal knowledge
- **Dev-server cache is sticky** — visual changes sometimes don't show until you `touch` the file or wait 30s+. Production rebuilds clean. Don't fight it; ship to verify.
- **`scrape-ministerial-statements`'s portfolio field** has body-text bleed with `\u00XX` JSON escapes. `cleanPortfolio()` in page.tsx handles it. The `civicgraph-summary.ts` `decodeEscapes()` is the canonical decoder.
- **`exec_sql` RPC** only accepts SELECTs (rules in MEMORY.md). UPDATE/INSERT/DELETE require `psql -f`. `pg_trgm` is in `extensions` schema not `public`.
- **`mv_yj_report_state_top_orgs`** column is `total` not `total_funding` — fixed in `topOrgs` query, but easy to break again.
- **`mv_yj_report_unfunded_programs.geography`** is `text` not `text[]` — use `geography::text ILIKE '%QLD%'` not `'QLD' = ANY(geography)`.
- **Cleveland Dodd inquest** is WA, NOT QLD — explicit yellow callout in §24 to prevent reader confusion.
- **Playwright** installed at workspace root via `pnpm add -Dw playwright` + `npx playwright install chromium`. Existing scrapers handle absence gracefully.

## Pending / next-session ideas (in priority order)
1. **Add bill-text scraping** — fetch Explanatory Note PDF text per bill so §24.7 drawers can show the actual amendment text (not just curated key amendments). Bills have `source_url` linking to `documents.parliament.qld.gov.au/bills/YYYY/NNNN/...` — Playwright can pull it.
2. **NSW/VIC/WA bills + coroners scrapers** — `scrape-nsw-bills.mjs` is the template; same Playwright pattern needed for `parliament.vic.gov.au`, `parliament.wa.gov.au`, NSW Coroners (`coroners.nsw.gov.au`), VIC (`coronerscourt.vic.gov.au`), WA (`coronerscourt.wa.gov.au`).
3. **Structured outcome ingestion** — recidivism by year, detention bed-day cost, ACCO retention rates. §25 chain "outcomes" columns are currently proxy-data; richer outcome ingestion would make the chain status lines defensible.
4. **NSW bills classifier** — current YJ_KEYWORDS in `scrape-nsw-bills.mjs` don't catch NSW bill-naming conventions ("Children (Detention Centres)", "Children (Criminal Proceedings)"). 100 NSW bills ingested but 0 YJ-flagged.
5. **Run a full critic-agent review** on the bigger version (last review caught 2 fabrications in earlier draft; could surface more in the post-Volume-7 expansion).
6. **TLDR / hero block** at the top of the dashboard for someone arriving cold from LinkedIn — currently the report assumes the reader scrolls.
7. **Apply the same template to a different sector** (e.g. Multicultural already has FECCA/ECCV; YJ is the worked example; next could be DV, Indigenous health, or housing).

## Recent commit shortlist (all on `main`)
- `598962c` rebuild headline stats strip (8 story-shaped cards, killed 581 national ALMA)
- `6f990fb` tighten §24.6 active-bills filter
- `5c337f5` chain 5 + active-bills strip + ALMA drawers
- `f3029c8` chain 4 (bail monitoring)
- `4aa72f2` bill drawers + §25 promise→action→outcomes chain
- `90e551b` click-to-expand side drawers + summariser
- `ab61b54` rebuild §23 (clean cards, fix portfolio bleed) + jurisdiction migration
- `1af46df` NSW/VIC/WA cross-state companion routes
- `9fc7166` §24.7 bills view (hansard-derived)
- `e77fdcb` live Hansard wiring + coroners scraper scaffold

## How to keep working
1. `cd /Users/benknight/Code/grantscope`
2. Dev server: `npx next dev --turbopack -p 3003` (already running on PID 36933 last we checked — `lsof -i:3003` to confirm)
3. Production: pushes to `main` auto-deploy via Vercel to civicgraph.app
4. Read this file + `git log --oneline -20` to orient
5. Read `MEMORY.md` for project-wide gotchas (Supabase access, dev-server quirks, exec_sql limits)

## What was working when we paused
- `/reports/youth-justice/qld/sector` — full flagship live
- `/share/qld-youth-justice` — chromeless public mirror
- All 5 chains in §25 rendering
- All drawers (50+ cards) functional
- Headline stats strip just rebuilt — production deploy in flight when session ended

## What might be worth doing first when you return
- Run `/preflight` to check DB + types + git
- Open the live page (or `localhost:3003/reports/youth-justice/qld/sector`) and scroll once with fresh eyes — the user has been steering off the live render so visual feedback drives priority
- Check the active-bills strip filter actually rendered the 3 narrowed bills on production (Castle Law / Education / Civil Liability) — local dev was sticky

---

## Session 2 — 2026-05-01 (afternoon, continuation)

Picked up the priority list from the morning handoff. Long session, some churn (rebuilt §9.6 three times before settling on the right grain), but everything below is now stable on `main`.

### Shipped this session

**Bill explanatory note pipeline**
- Migration `20260501010000_parliament_bills_explanatory_notes.sql` — added `explanatory_note_url`, `statement_of_compatibility_url`, `explanatory_note_text`, `explanatory_note_chars`, `explanatory_note_fetched_at` to `parliament_bills`. Recreated `qld_bills` view.
- `scripts/scrape-qld-bills.mjs` — extended for Exp Note URL + SoC URL extraction.
- `scripts/fetch-bill-explanatory-notes.mjs` (new) — downloads Exp Note PDFs, extracts text via `pdftotext -layout`, 800ms rate-limit between requests. 6/6 active QLD YJ bills extracted (7K–115K chars each).
- Long-read bill cards now show auto-extracted "From the Explanatory Note —" pull quote (Policy objectives section parsed via `extractPolicyObjective`).

**VIC + WA Playwright bill scrapers**
- `scripts/scrape-vic-bills.mjs` (new) — `legislation.vic.gov.au/bills/in-parliament`. 31 bills, 6 YJ-flagged (Raise the Age, Home Stretch, Charter of Human Rights amendments).
- `scripts/scrape-wa-bills.mjs` (new) — `parliament.wa.gov.au/Parliament/Bills.nsf/screenBillsProgress`. 62 bills, 5 YJ-flagged.
- Coverage now: QLD 56 (6 YJ) · NSW 100 (0 YJ — needs keyword tuning) · VIC 31 (6 YJ) · WA 62 (5 YJ).

**Outcome Math + ACCO retention**
- Migration `20260501020000_acco_retention_metrics.sql` — `v_acco_yj_retention_qld` view (joins `justice_funding × gs_entities` on `is_community_controlled`, computes year-over-year continuity). 13 retention rows backfilled into `outcomes_metrics`.
- Striking finding: ACCO retention 100% (2020-21→2021-22) → 28.6% (2023-24→2024-25). Surfaced as 4th card in Outcome Math block + headline-grid card + V3 narrative paragraph.
- New "Outcome math · what the spend buys" 4-card block (long-read V3 + dashboard TLDR): bed-night cost (≈$2,845/night), 12-month recidivism with delta (71.5%, +5.9pp), detention spend growth (+141% since 2017-18), ACCO retention.

**youth_population backfill**
- Migration `20260501030000_backfill_qld_youth_population.sql` — 18 QLD LGAs in `lga_cross_system_stats` got `youth_population` from ABS ERP June 2024 QLD state share (10.4%). Method written into row's `sources` jsonb. Idempotent.

**Cold-arrival TLDR hero (dashboard)**
- Punchline now leads with the alternative: *"QLD already supervises ~860 young people in the community, every day — 2.9× the number locked up. Yet detention costs $2,845/night, and 72% come back. The case for community-based support isn't hypothetical — it's already running, underfunded."*
- Three stat cards · "the funnel tonight" supervision strip · direction-of-travel triptych · 3 CTAs.

**Critic review + 4 fixes**
- TLDR hardcoded `$2,800+` fallback removed; "every recent law has expanded custody" softened to "every major Act since 2024"; 3 hardcoded `$1.88B`/`$1.49B` strings in long-read replaced with `{money(r.detention)}`/`{money(r.community)}`.

**Companion routes (NSW/VIC/WA) consume bills**
- `[state]/sector/page.tsx` shows "YJ-relevant bills before {state} Parliament" with bill name, sponsor, party, status + Bill / Exp Note / SoC links.

**§7 Disengagement Pipeline data**
- "The disengagement concentration" panel — 5 cards comparing top-10 hotspot LGAs vs rest of QLD across population / DSP / JobSeeker / Youth Allowance / low-ICSEA-school share, tone-coded red over baseline.
- Per-LGA welfare + school table for top 12 hotspots.

**§6.5 Every Announced Community Program**
- All 23 QLD ministerial announcements about youth community programs (`civic_ministerial_statements`, 36-month window, broad keywords incl. circuit breaker, kickstart, step up, family-led, career pathway).
- **Per-announcement match-and-deliverer chain**: each card has ✓ MATCHED / ⚠ FUNDED-separate-stream / ✗ NO-FUNDED-PROGRAM-MATCHED badge based on registry-pattern lookup. Matched announcements expand to show delivering orgs with entity-page click-throughs.
- Reality check: only ~13% (3/23) of recent QLD community-program announcements have a directly traceable funded line in `justice_funding`.

**§9.6 Programmes Registry (the spine)**
- Killed previous `§9.6 SPEND TRANSCRIPT` (generic-line-item aggregation that confused with names like "Young People" / "Social Services").
- New `QLD_PROGRAMME_REGISTRY` constant — **19 curated initiatives** with full chain: Announcement → Bill → $ Funded → Delivery status → ⚡ Circuit breaker leverage point.
- Items include: Making QLD Safer 2024 · ACAT 2025/2026 · bail monitoring × 2 · Castle Law · Wacol · Woodford · Cairns YDC · Townsville Step Up Step Down · Kickstart multi-region · **Circuit Breaker Sentencing ($80M / 4 yrs)** · Tribe of Mentors · Bail Support · Young Offender Support · Family Led Decision Making · Youth Criminal Rehabilitation · Path to Treaty (REPEALED) · HR Act override.

**§9.6 deliverer drawers (per registry card)**
- New SQL CTE: for each `program_name_pattern`, returns top 50 deliverers from `justice_funding × gs_entities` (gs_id, website, email).
- Each registry card with a pattern has inline `▶ Show all delivering organisations` table → entity-page click-through.
- Coverage: Circuit Breaker Sentencing → 1 (DYJ), Tribe of Mentors → 1 (Adapt Mentorship), Kickstarter Grants → 13, Bail Support → 43, Young Offender Support → 43, Family Led Decision Making → 5.

### Files touched this session
- `apps/web/src/app/reports/youth-justice/qld/sector/page.tsx` — major rebuild (≈+750 lines)
- `apps/web/src/app/reports/youth-justice/qld/sector/long-read/page.tsx` — outcome math, ACCO retention narrative, methodology, 3 hardcoded-figure fixes
- `apps/web/src/app/reports/youth-justice/[state]/sector/page.tsx` — bills consumption
- `scripts/scrape-qld-bills.mjs` — Exp Note URL extraction
- `scripts/scrape-vic-bills.mjs`, `scripts/scrape-wa-bills.mjs`, `scripts/fetch-bill-explanatory-notes.mjs` — NEW
- 3 new migrations (all applied to production Supabase)

### Pitfalls discovered (so future-you doesn't re-hit them)
1. **Turbopack module-cache corruption** — file edits saved to disk but the dev worker served stale compiled code. Fix: `lsof -i:3003 -sTCP:LISTEN -t | xargs kill` + restart `npx next dev --turbopack -p 3003`. Symptom: edits don't show in HTML even though `grep` finds them in the source file.
2. **`exec_sql` RPC + USING() collision** — `LEFT JOIN x USING (col)` errors with "common column name appears more than once" when intermediate CTEs select the same column. Fix: explicit `LEFT JOIN x ON x.col = y.col`.
3. **"Circuit breaker" naming collision** — used as metaphor for leverage points, but Circuit Breaker Sentencing is a real $80M QLD program. Disambiguate in any future copy.
4. **Generic program names in justice_funding** — top spend aggregates to names like "Young People" / "Social Services" — useless for narrative. Always filter via `is_aggregate=false` + name patterns when surfacing.
5. **NSW bill scraper has 100 bills, 0 YJ-flagged** — keyword set doesn't match NSW drafting conventions.

### Next 3 actions (recommended priority)
1. **NSW bill keyword tuning** — update `YJ_KEYWORDS` in `scripts/scrape-nsw-bills.mjs` to match NSW drafting (children criminal proceedings, bail review, etc.). Re-run. Aim: ≥3 NSW YJ-flagged bills.
2. **§6.5 keyword matching hardening** — pattern list is regex-based. Add Step Up Step Down → registry no-funding-match, Career Pathways → linked program lookup. Aim: <30% of announcements falling into NO-MATCH bucket.
3. **VIC + WA detail-page sponsor/status** — `--detail` mode returns null for VIC/WA. Investigate `legislation.vic.gov.au/bills/{slug}` and `parliament.wa.gov.au/.../BillProgressPopup` DOMs, update `fetchDetail()` selectors. Aim: parity with QLD enrichment.

### What's stable as of session-end (2026-05-01 afternoon)
- All sections render, type check clean, server returns 200.
- Page now ≈2,650 lines — nearing the limit where component-splitting is worth doing.
- Full chain end-to-end traceable: announcement (§6.5) → bill (§9.6) → $ funded → recipient (drawer) → entity page (governance + relationships).

---

## Session 3 · 2026-05-01 (evening, continuation)

### Shipped this session

**§6.5a Curated Delivery Ledger imported into /sector**
- Pulls the same 10 announced QLD YJ programs from `qld-youth-justice-announcements.ts` that feed the QLD overview page. Each row clicks to open a `DetailDrawer` (existing native-`<dialog>` client component) with provider leads, source chain, and missing-proof checklist, rendered inline.
- Drawer content per item: status badge, summary, why-it-matters, service-area chips, provider leads (name + ABN + status + known facts + ask-next + contact), source chain (every `sourceLinks` entry as clickable URL with kind label and note), missing-proof bullet list with "punch list" framing.
- Counter strip: announced total, money flowing count, provider seen count, announced only count, not yet visible count.

**`/share/qld-youth-justice` lock-down**
- `isShare` flag (already used elsewhere on the page) extended to gate three click-throughs:
  1. §6.5a ledger rows render as plain `<div>` instead of `<Link>`. Footer text replaced with "Provider leads, full source chains, named contacts, and missing-proof checklists for each program live in the CivicGraph workspace. Request access ↗".
  2. §6.5b live-feed deliverer drawers: "→ entity page" link replaced with non-clickable "CivicGraph entity (workspace access)".
  3. §9.6 Programmes Registry deliverer drawers: same swap.
- Anonymous /share/ visitor sees ALL the curated data (provider names, ABNs, contacts, sources, missing-proof) but cannot click through to authenticated workspace pages.

**§6.5b live feed: per-announcement match-and-deliverer chain hardened**
- Extended regex patterns: `kickstart|intensive early intervention|early intervention program` → Kickstarter Grants. Added `tough new drug|drug law|adult crime, adult time|drug penalt|anti.social behaviour` → registry's drug-bill legislation entry.
- New status buckets: ◇ ADJACENT (Career Pathways, Youth Week, Youth Justice School: real youth programs but not YJ-funded) and — NON-YJ (perinatal MH, cybercrime, applied research disability, firearms/Wieambilla: caught by broad SQL keyword filter but not actually YJ).
- Result: NO MATCH bucket dropped from 12 cards (52%) to 0 cards (0%). Final breakdown: 10 MATCHED, 5 FUNDED-separate-stream, 1 LEGISLATION-no-$-vehicle, 2 ADJACENT, 5 NON-YJ.

**Plain-English relabel**
- Status badges and counter labels swept of jargon:
  - `named-program SQL` → `money flowing` (badge: ✓ Money is flowing · program named in funding data)
  - `provider SQL` → `provider seen` (badge: ⚠ Provider seen · lead, not proof)
  - `official-only` → `announced only` (badge: ◇ Announced only · no money trail yet)
  - `not-visible-yet` → `not yet visible` (badge: ✗ Not yet visible · awaiting tender / contract)
  - `sql signal` → `visible in funding data` (provider lead pill)
  - `tracker signal` → `visible in tracker` (provider lead pill)

**Full em-dash + AI-vocab sweep**
- New tool `scripts/sweep-ai-tells.mjs` (reusable). Replaces ` — ` and ` &mdash; ` with `, ` and swaps AI-vocab tells for plainer verbs (underscore→show, highlight→show, showcase→show, pivotal→key, delve→look, intricate→detailed, interplay→overlap, bolster→back, enduring→lasting, crucial→critical, enhance→improve, foster→build, valuable→useful, boasts→has, meticulous→careful, vibrant→active, robust→strong, tapestry→set, nestled→sited, groundbreaking→new, renowned→known, exemplifies→shows). Strips fillers ("It's important to note that", "It's worth noting that", "in the heart of", "diverse array", "valuable insights").
- Files swept: QLD /sector page (211 dashes), long-read (149), [state] companion (12), /share metadata for both /sector + /long-read.
- 372 prose em dashes → 0. ~50KB shaved off the source.
- Edge cases preserved: `'—'` em-dash fallback strings in `money()` / `fmt()`, SQL queries inside backticks, Promise.all comma boundaries (`>,` after TS generics), `, ...spread` operators, database-driven content (ALMA program names, Hansard quotes).

**Hydration error fixed**
- DetailDrawer wraps trigger in `<button>`. Initial trigger was also `<button>`, causing nested-button hydration mismatch. Swapped trigger to `<div>`.

### Files touched this session
- `apps/web/src/app/reports/youth-justice/qld/sector/page.tsx` — ledger import + drawer wrap, /share lock-down, jargon relabel, em-dash sweep
- `apps/web/src/app/reports/youth-justice/qld/sector/long-read/page.tsx` — em-dash sweep
- `apps/web/src/app/reports/youth-justice/[state]/sector/page.tsx` — em-dash sweep
- `apps/web/src/app/share/qld-youth-justice/page.tsx` — metadata em-dash cleanup
- `apps/web/src/app/share/qld-youth-justice/long-read/page.tsx` — metadata em-dash cleanup
- `scripts/sweep-ai-tells.mjs` — NEW reusable copy-sweep tool

### Pitfalls discovered this session
1. **DetailDrawer trigger must not be a `<button>`** — the component already wraps in its own `<button>`. Use a `<div>` or `<span>` instead.
2. **Be careful with `<` `>` regex when sweeping TSX** — first sweep version included `/(>|^)\s*,\s+/g` to clean leading-comma artifacts. That matched closing-`>` of TS generics like `Promise<X>,` and silently deleted Promise.all comma boundaries, breaking the entire `getReport()` tuple. Removed the rule.
3. **`/,\s*\./g` matches `, ...spread`** — the trailing-comma-period cleanup ate the comma in `}, ...(condition ? [...] : [])` patterns. Fixed with negative lookahead `(?!\.)`.
4. **`'—'` fallback strings** — sweep replaced `return '—';` (used for missing-value display) with `return ',';`. Restore via targeted `sed 's/return '\\'',\\'';/return '\\''—'\\'';/g'`.
5. **Database content stays** — ALMA program names and Hansard quotes contain real em dashes. Don't rewrite those, the sweep only touches source code.

### Next 3 actions (recommended priority)
1. **Critic review of the swept copy** — run a critic agent over the now-em-dash-free pages to flag any sentences that read awkwardly after the bulk transformation. Some commas may have created comma splices or ambiguous phrasing that a human read won't catch.
2. **NSW bill keyword tuning** (carried from session 2) — 100 NSW bills, 0 YJ-flagged. Update `scripts/scrape-nsw-bills.mjs` keyword set.
3. **VIC + WA detail-page sponsor/status** (carried from session 2) — `--detail` mode returns null. Investigate detail-page DOMs and update `fetchDetail()` selectors.

### What's stable as of session-end (2026-05-01 evening)
- 3 commits this session: `676876d` (programmes registry + deliverer drawers), `391c086` (delivery-ledger drawer + share lock-down + AI-tell sweep).
- Type check clean across all touched files.
- /share/qld-youth-justice renders 200 with full curated data + zero leak to authenticated routes.
- /reports/youth-justice/qld/sector renders 200 with all click-throughs preserved for staff.
- Em dashes in prose: 0. Em dashes in DB-driven content (ALMA names, Hansard quotes): preserved verbatim.
