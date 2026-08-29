---
date: 2026-08-29
topic: ACT funding sources and the opportunity radar
method: 48-agent ultracode workflow (run wf_385288f4-fb2), 6.48M tokens
status: findings, not yet actioned
artifact: https://claude.ai/code/artifact/fb3b27ad-d1d6-4e90-93d2-9ee699be2377
---

# Where ACT's money is, and why none of it reaches us

Produced 2026-08-29 by a six-phase workflow: 5 parallel readers over the existing funding
machinery, 6 multi-modal prospecting sweeps, an adversarial refuter per money claim, 4
independent radar designs each judged by 3 diverse lenses, a synthesis, then a completeness
critic that re-verified and **overturned the synthesis's central architectural claim**.

- 109 candidate money sources proposed, **10 survived adversarial refutation**
- Design ranking: relationship-radar 7.2 / minimum-viable-radar 6.0 / notion-native 5.5
- Two agents died to API errors: the relevance-engine design and one judge

## Read the critic first

Section 2 below is the synthesis. Section 3 is the completeness critic, and **where they
disagree the critic wins** — it verified, the synthesis had not. The critic's headline
correction is load-bearing:

> The synthesis concluded "every delivery mechanism ever built here has a queue, and no queue
> has ever had its drainer scheduled" and prescribed building a new queueless sender. That is
> false. `composeDeskDigest` (`apps/web/src/lib/services/act-desk-digest.ts:48`) already builds
> a daily grant email, has no queue, sends via Resend, and is already scheduled daily at 21:00
> in `vercel.json`. It dies on one line: `if (!key) throw new Error('RESEND_API_KEY not set')`.
> The key is in the local `.env`. It is a Vercel env-var gap (`/config-truth`), not a build.
>
> But its grant source ranks on `goods_relevance_score`, so restoring the key notifies about
> Goods and nothing else. **The Goods gravity is in the pipes, not the prose.**

## What was actually done on 2026-08-29, before this workflow

22 rows added to the Notion board `Funders & Opportunities`
(data source `ecfa025b-3275-42a4-8923-6cddf800adce`), each with link, context, eligibility,
next action and an explicit verification status. Board went 100 -> 122 rows. Four verified
against the funder's own page: Sunshine Coast Major Grants (6 Oct, Harvest), Closing the Gap
Major Capital Works Rd 3 (7 Sep, logged as a **buyer list**, not a grant), AGD National Justice
Reinvestment (no round, $20M/yr ongoing, first-ever JusticeHub row), DCCEEW First Nations Clean
Energy Pilot Grants (28 Sep).

---

# 2. Synthesis

# ACT Funding Radar: the answer

**Confidence tags on every figure.** `[V]` = I queried the source myself in this session. `[V-prior]` = verified by the adversarial review pass on 2026-08-29, not re-derived here. `[I]` = inferred from data I did have. `[U]` = unverified, taken on faith.

The honest headline: the money is real and mostly already in our database, but the amount ACT can actually apply for as ACT is far smaller than any of the big numbers suggest, and the reason nothing reaches you is not discovery. It is that no funding notification has ever reached a human by any channel, ever, in this project's history.

---

## 1. Where the money actually is

### (a) Already in our database, unused

| # | Source | Dollars reachable | Effort | Serves | Confidence |
|---|---|---|---|---|---|
| 1 | **ACNC private-grantmaker screen** (`mv_acnc_latest` + `acnc_charities`) | 2,729 Registered charities gave ≥$100K in their latest AIS with <20% government revenue, $3.41bn total. **Of those, 721 declare other charities as beneficiaries, $915M.** That subset is the only one that could fund an outside organisation. | hours (one SQL view) | all | `[V]` this session |
| 2 | **Indigenous royalty / native-title charitable trusts** | Yajilarra $98.9M, Nyiyaparli $31.2M, General Gumala $19.9M, PKKP $18.1M, Yinhawangka $11.5M, Noongar Boodja $10.2M, Groote Eylandt Aboriginal Trust $7.2M, Centrecorp Foundation $1.5M | hours to list, months to relationship | Maningrida, Barkly, Oonchiumpa, MMEIC, PICC, Goods | `[V]` this session |
| 3 | **`grantconnect_awards` re-compete** (`end_date` as a forward signal) | 1,690 awards / $3,574M / 69 programs / 16 agencies ending inside 18 months on the Indigenous+remote+youth+justice+community filter. 1,560 carry `gs_entity_id`. **ACT-or-partner addressable slice ~$300M** `[V-prior]`. Re-compete happens 23-47% of the time, not "almost always" `[V-prior]`. | hours, after normalising `grant_program` | all place projects | `[V]` counts, `[V-prior]` slice |
| 4 | **NIAA money we already hold** | `justice_funding` where `source='niaa-senate-order-16'`: 416 grant rows, $405M, FY2024-25, 13 programs, all six NIAA outcome areas plus ABA and ILSC | zero (it is a table) | Maningrida, Barkly, Oonchiumpa, PICC, MMEIC, Goods | `[V]` this session |
| 5 | **IPP procurement scoreboard** (`mv_indigenous_procurement_score`) | 2025 buyers at **zero** Indigenous suppliers: QLD Queensland Health $1,012M, NT Power and Water Power Services $439M, Homes Victoria $677M, **NT Dept of Logistics and Infrastructure Housing Program Office $62M across 9 contracts** | zero (live matview, already renders at `/reports/ipp-scoreboard`) | Goods, Custodian First Economy, PICC | `[V]` this session |

**On #1, the correction that matters most.** The famous "2,780 grantmakers, $3.84bn" screen is real, but 2,008 of those charities declare only *human* beneficiaries. Their giving is scholarships, hardship payments and intra-group remittance, not a round ACT can enter. The addressable set is **721 funders, $915M** `[V]`. Sliced by ACNC's own declared flags `[V]`:

| Theme flag ∩ funds-other-orgs | Funders |
|---|---|
| Youth | 209 |
| Aboriginal and Torres Strait Islander | 130 |
| Pre/post-release (justice) | 46 |
| Natural environment | 36 |

Named and verified from that set this session: **Paul Ramsay Foundation $183.7M**, The Hospital Research Foundation $21.7M, **Judith Neilson Foundation $21.3M**, **ALFA (NT) Ltd $14.1M** (Arnhem Land, where Maningrida sits), **Movember $12.6M**, Sidney Myer Fund $9.9M, William Buckland Foundation $6.0M, **Documentary Australia $3.9M**, CommBank Foundation $3.1M, Myer Foundation $4.4M.

**On #2, a correction I found this session that changes the play.** Every one of the big royalty trusts has `ben_other_charities = false` `[V]`. Yajilarra, Nyiyaparli, Gumala, PKKP, Yinhawangka, Noongar Boodja, Groote Eylandt and Centrecorp fund their own members in their own determination area. **This is not a grant-application lane. It is a partnership lane where the traditional owner group is the decision-maker and ACT is a delivery partner.** The two exceptions, both flagged `ben_other_charities = true` and both in Arnhem Land: **ALFA (NT) Ltd ($14.1M) and Karrkad-Kanjdji Trust ($1.45M)** `[V]`. Those two are directly approachable for Maningrida work and neither is on the board.

**The staleness caveat, stated once and carried on every surface.** The AIS series ends at FY2023 `[V-prior]`. A 2023 giving figure answers "does this entity fund, and in what theme". It does not answer "do they have money this quarter". 42% of the screened funders have no website recorded in ACNC `[V-prior]`, so they cannot be crawled at any budget.

### (b) Reachable with a small build

| Source | Reachable | Effort | Confidence |
|---|---|---|---|
| **The 414 strong-fit recommendations already computed and never seen by a human.** `act_grant_recommendations`, `computed_at` 2026-08-28T17:00. 352 have no deadline, 62 have a future one | ACT-PI 268, ACT-GD 54, ACT-MY 54, ACT-JH 20, ACT-FM 11, ACT-HV 7. Five in-scope projects return zero | 1 day to deliver | `[V]` this session |
| **FRRR Strengthening Rural Communities, Small & Vital Round 30** for Mounty Yarns, fit score 93, closes **2026-09-17** (19 days) | up to $25K `[U]` | apply | `[V]` this session |
| **Perpetual IMPACT Philanthropy Application Program.** 2027 round opens 2 Nov 2026, closes 4 Dec 2026. Max $120K per application, 2 applications per org per round. Requires ACNC + DGR Item 1, so **Butterfly only** | ACT ceiling $240K/yr, not a share of $32M | calendar item + a classifier fix (`foundations.type='trustee'` is auto-stamped `non_grant`) | `[V-prior]` |
| **GrantConnect Forecast** (`/Fo/ListResult`). 143 published records, 97 programs, each with an Estimated Period of Release, 13 directly First Nations or remote. Zero in our DB. Plain unauthenticated HTML, same markup family `ingest-grantconnect-go.mjs` already parses | the only lead-time source in Australia | hours | `[V-prior]` |
| **AusTender ATM RSS.** 71 open tenders, 46 posted in 30 days. `sync-austender-open-tenders` is registered and has never executed once | the Goods federal bid lane | hours | `[V-prior]` |

### (c) Needs real work

| Source | Reachable | Effort | Confidence |
|---|---|---|---|
| **Supply Nation certification for Goods on Country.** In `social_enterprises` it is `source_primary='self-registered'`, `verification_tier='identified'`. Not certified | Unlocks the $7.43bn IPP lane `[V-prior]`. This is the single highest-leverage non-build action available | an application, weeks to months | `[V]` this session |
| Equity Trustees + APS trustee-aggregator lists, joined to `mv_acnc_latest`. The APS c/o-address fingerprint already returns 37 charities, 25 with AIS financials, $34.95M | ~1,000 non-advertising trusts become named and sized | days | `[V-prior]` |
| Community Foundations Australia directory | Real but small: $1K-$10K local grants, whole-foundation annual pools of $44K-$68K | 1-2 days scrape, week+ for catchment linkage | `[V-prior]` |
| Grantee lists at scale (~380 edges exist against 16,878 measured grantmakers) | the highest-value philanthropy signal, currently 0.02% covered | weeks | `[V-prior]` |

---

## 2. The ten orphaned projects

For eight of these, **the money is not a round to apply to. It is Commonwealth or trust money already held by a named partner with a contract end date in 2028.** ACT's route is a subcontract, invoiced by ACT Pty, not an application. ACT's own four ABNs return zero rows across `grantconnect_awards`, `justice_funding` and `austender_contracts` `[V-prior]`, so there is no public track record for a funder's due diligence to find. That is the real constraint.

| Project | Named funder or buyer | Instrument | Confidence |
|---|---|---|---|
| **JusticeHub** | Paul Ramsay Foundation "Just Futures" and "Peer to Peer Program" (fit 68 each). Plus AGD Justice Reinvestment: $20M/yr ongoing from 2026-27 for up to 30 initiatives, via a community partner | Grant via Butterfly / partnership | `[V]` fits, `[V-prior]` AGD |
| **The Farm / Black Cockatoo Valley** | Great Barrier Reef Foundation Community Stewardship Round 1 (fit 68). Ian Potter Environment Grants ($46.18M given). **Jinibara People Aboriginal Corporation RNTBC**, Traditional Owners of the country The Farm, Harvest and June's Patch sit on, already holds $532,950 of QLD youth-justice contracts | Grant via Butterfly / partnership | `[V]` fit, `[V-prior]` rest |
| **Empathy Ledger** | **Documentary Australia $3.9M**, APNIC Foundation Brisbane $5.75M. Realistically the stronger route is earned revenue: it is a platform other orgs pay for | DGR gift via Butterfly / earned revenue | `[V]` Documentary Australia, `[V-prior]` APNIC |
| **SMART** (health) | **Movember $12.6M**, The Hospital Research Foundation $21.7M (SA) | Grant via Butterfly | `[V]` both |
| **CAMPFIRE** | CAMPFIRE HEALING INDIGENOUS CORPORATION (ABN 74845764368, ORIC, PBI) is already an NIAA grantee in Mount Isa | Partnership / subcontract | `[V-prior]` |
| **Mounty Yarns** | **FRRR SRC Small & Vital Round 30, closes 2026-09-17, fit 93.** Already receives $2.3M Commonwealth JR, $600K Paul Ramsay, $250K Dusseldorp, $150K Bill & Patricia Ritchie | Grant | `[V]` FRRR, `[V-prior]` rest |
| **Maningrida Justice Reinvestment** | **ALFA (NT) Ltd $14.1M and Karrkad-Kanjdji Trust $1.45M**, both Arnhem Land, both fund other organisations. Bawinanga Aboriginal Corporation holds $28.99M Jobs Land and Economy to 2028-06-30; Nja-marleya Cultural Leaders and Justice Group holds $1.27M | Partnership / subcontract, plus a genuine direct trust ask | `[V]` trusts, `[V-prior]` corps |
| **Barkly Backbone** | barkly alliance aboriginal corporation holds $1,225,253 of NIAA Culture and Capability, 2025-07-18 to 2028-06-30 | Subcontract | `[V-prior]` |
| **Oonchiumpa** | **Centrecorp Foundation, Alice Springs, $1.53M given FY2023, already on ACT's own receivables ledger.** Five-trust Alice Springs cluster, $105M assets | Partnership / grant | `[V]` Centrecorp, `[V-prior]` cluster |
| **MMEIC Justice** | Already holds $5.10M Justice Reinvestment to 2029-06-30 plus four NIAA Culture and Capability grants (2023, 2024, 2025, 2026) | Subcontract into money already flowing | `[V-prior]` |
| **Civic Scope** | Susan McKinnon Foundation, $30.85M given, $0 government revenue, $569M assets. But per CLAUDE.md the strategy is the buyer wedge | Grant via Butterfly, or earned revenue from buyers | `[V-prior]` |
| **DadLab / ConFit Pathways / BG Fit** | Movember $12.6M is the one named funder that fits all three | Grant via Butterfly | `[V]` |
| **June's Patch** | Sundale Community Foundation (~$52K annual pool), FRRR SRC | Small grant | `[V-prior]` |
| **Custodian First Economy** | Less than you would hope. No named philanthropic funder surfaced. The credible route is the 1,052 community-controlled entities that already hold government procurement, as a peer and partner list | Partnership / buyer | `[V-prior]` |
| **Contained / Diagrama** | Contained has 7 board rows and a config row (ACT-CN) that returns zero strong fits. Diagrama has neither | Unresolved | `[V]` zero fits |

**One config bug worth fixing on day one.** `act_grant_recommendation_projects.home_states` for ACT-MY is `'QLD'` `[V]`. Mounty Yarns is Mount Druitt, NSW. That single wrong value is why its recommendation list is padded with Create NSW arts rounds from 2024 and 2025.

---

## 3. Why the current system does not notify us

**Not one funding notification has ever reached a human, by any channel, in this project's history.** Five independent checks, all run this session:

| Lane | State | Confidence |
|---|---|---|
| `grant_notification_outbox` | 771 rows, **0 sent**, `max(attempt_count) = 0` | `[V]` |
| `deliver-grant-notifications` (the only queue drainer) | **0 rows in `agent_runs`. It has never executed once.** No schedule row, not in `vercel.json`, not in pg_cron | `[V]` |
| `digest_log` | 0 rows after 23 daily runs of `/api/cron/desk-digest`, which has returned 500 every day since it shipped 2026-08-06 | `[V]` |
| `funding_weekly_cycles` | 4 rows, all `delivery_status: 'in_app'`, which is a hardcoded string literal. The route has **no send step at all** | `[V]` |
| `procurement_alerts` | 53,223 rows, all unread. `procurement_notification_channels` = **0** | `[V]` |

**The structural pattern.** Every delivery mechanism ever built here has a queue, and no queue has ever had its drainer scheduled. The one thing that has worked every day for months, `act-global-infrastructure/.github/workflows/daily-brief.yml`, has no queue: it regenerates a document into a Notion page in one job.

**And the thing that has "worked" has never been able to report failure.** I read `/Users/benknight/Code/act-global-infrastructure/scripts/post-brief-to-notion.mjs`. Neither `clearToggleContent` (lines 51-75) nor `appendBlocks` (77-94) checks `response.ok` on any fetch `[V]`. A 401, 400 or 429 from Notion is swallowed, the script prints `✅ Brief posted to Notion` and exits 0. **Its unbroken green record is an exit-code record from a script that cannot exit non-zero on a delivery failure.** Do not copy it verbatim. Copy it with ten lines of error handling added.

### Debris (delete or archive)

- `scripts/sync-pipeline-to-notion.mjs` (319 lines), targets a database whose own Notion title reads *"ARCHIVED, merged into Funders & Opportunities, 10 Aug 2026"* `[V-prior]`
- `scripts/sync-act-opportunities-to-notion.mjs` (256 lines), never run, not in the registry `[V-prior]`
- `apps/web/src/app/api/ops/grant-recommendations/sync-notion/route.ts` (238 lines) and its button `[V-prior]`
- `apps/web/src/lib/services/funding-notion.ts` (54 lines), gated on `funding_ghl_handoffs` which holds 0 rows, so the gate has never opened `[V-prior]`
- `NOTION_GRANT_PIPELINE_DB` / `_DS` env vars, and `grantPipeline` in the sibling repo's config
- The 771 quarantined outbox rows, hand-stamped in SQL rather than sent
- `grant_opportunities.last_deadline_alert_at`: 883 stamped rows, no writer anywhere in the tree `[V-prior]`

All three surviving sync implementations write nine property names and eight Stage values that have **zero overlap** with the real board schema `[V-prior]`. Every write would 400 on the first unknown property. That is why none has ever written a row.

### Dormant by decision (leave alone)

- `docs/specs/grants-notion-handoff-spec.md` (2026-08-06, issue #162) rules that nothing lands in Notion automatically, to avoid "a graveyard of stubs". The board is hand-keyed **by design**. Any design that writes board rows is reversing a live decision and must say so out loud first.
- Five in-scope projects returning zero strong fits. The 2026-08-08 ruling recorded "Zero strong fits can be correct." Do not fix a zero by loosening the matcher.
- The API-key surface (per CLAUDE.md).

### Genuinely broken

| Fault | Evidence |
|---|---|
| `/api/cron/desk-digest` 500s daily and has since 2026-08-06. Cause is one line: `act-desk-digest.ts:179 if (!key) throw new Error('RESEND_API_KEY not set')`, caught by the route and returned as a JSON 500, invisible to Vercel error aggregation | `[V-prior]` |
| **6,626 rows are awards masquerading as open opportunities and still typed `open_opportunity`**: arc-grants 5,598, Lotterywest 768, ghl_sync 260. `brisbane-grants` (11,793) and `qld-arts-data` (2,648) are already correctly typed `historical_award` and are therefore already invisible to every semantic surface | `[V]` this session |
| The pool the recommendation engine scores is **frozen**. `alma_funding_opportunities` `max(created_at)` = 2026-08-21, 8 days stale, while `act_grant_recommendations.computed_at` = 2026-08-28 and the nightly MV refresh reports green | `[V]` this session |
| `nightly-grant-pipeline`: 47 runs since 1 July, 47 timed out | `[V-prior]` |
| The sibling repo's `sync-ghl.yml`: 60 consecutive failures since 2026-08-13 on an invalid GHL token, unnoticed | `[V-prior]` |
| 29 enabled `agent_schedules` rows have `auto_create_task = FALSE`, so the orchestrator never queues them | `[V-prior]` |

**The signature failure to design against:** green means nothing here. `send-grant-alert-digests` reported success 17 times having sent zero digests `[V-prior]`. Agent status is not a delivery signal.

---

## 4. The radar

**Funder Radar.** One job, six lanes, one regenerated Notion page, zero queues. The design test is the one that matters in this estate: *does it have a second job that has to run?* This has one.

### The load-bearing decisions

1. **The unit of record is the funder, not the opportunity.** A trust that gives $3M a year and has never published a round has no row to be in on an opportunity-grained surface. Every existing surface here is deadline-shaped and therefore structurally blind to the money that matters most.
2. **`cadence_kind` is a first-class column, and it decides which date field gets written.** A `relationship` candidate never receives a Due date. It receives a **next contact date that we set**. This is what makes deadline-blindness impossible by construction rather than by discipline.
3. **One script, one run row, one failure.** No pg_cron rebuild followed four hours later by a separate post, because a failed rebuild plus a successful post produces a fresh-looking page over stale data.
4. **Freshness is measured on the INGEST timestamp, not the matview.** `alma_funding_opportunities.max(created_at)`, verified frozen for 8 days while the MV refresh went green. The page leads with `DATA IS N DAYS OLD` when that gap exceeds 3 days.
5. **Read the board, do not write to it.** The mirror and the page do not touch spec #162 at all. Board-row writes are a week-3 item gated on Ben reopening #162.

### Files, tables, crons

| Thing | Build / reuse / delete | Effort |
|---|---|---|
| `supabase/migrations/<ts>_funder_radar.sql`: view `v_act_real_grantmakers` (the govt-revenue screen **plus `ben_other_charities`**), table `act_funder_radar` (funder × project × lane), table `notion_board_rows` (the read-only board mirror), function `rebuild_act_funder_radar()` | BUILD. Copy the shape of `rebuild_funder_intelligence()` and `rebuild_funder_board_paths()`, which already exist and work | 1.5 days |
| `apps/web/src/lib/notion/client.ts`: shared Notion REST client, 3 req/s limiter, **`res.ok` checked on every fetch, throws with the status and body**. No such helper exists today; four call sites each hand-roll their own | BUILD | half a day |
| `apps/web/src/lib/notion/board-schema.json` + `.test.ts`: checked-in snapshot of data source `ecfa025b`, title property `Funder / Opportunity`, the real Stage vocabulary. Test fails the build if a property the writer uses is absent from the snapshot | BUILD, modelled on the existing `vercel-config.test.ts` | hours |
| `scripts/funder-radar.mjs`: **the whole system.** Mirror the board, rebuild the radar, render markdown, regenerate one Notion page. **Render fully, then write once**, so a mid-flight failure never leaves a blank page. Exits non-zero on stale ingest, on <5 rendered items, or on any non-ok Notion response | BUILD. Borrow `parseMarkdownToBlocks` from `post-brief-to-notion.mjs`, add the error handling it lacks | 1.5 days |
| `apps/web/src/app/api/cron/funder-radar/route.ts` + one `vercel.json` entry, daily 21:00 UTC (07:00 Brisbane). Returns **non-200** on failure. Writes `agent_runs` with a typed `zero_reason` | BUILD. Do not model on `desk-digest`, which catches into a JSON 500 | half a day |
| `apps/web/src/app/ops/funder-radar/page.tsx`: Server Component. Last run, lane counts, suppressed candidates, stale-ingest flag | BUILD, SAFE lane, auto-merges | 1 day |
| INSERTs into `act_grant_recommendation_projects` for the 12 missing projects, and a fix to ACT-MY's `home_states` | REUSE the existing 12-row config table. **This is the "add relevance scorers" item, and it is data entry** | 2 hours, Ben supplies the keywords |
| `act_grant_recommendations`, `act-funder-intelligence.ts` (1,353 lines), `funder_board_paths`, `mv_acnc_latest`, `mv_indigenous_procurement_score` | REUSE UNCHANGED | 0 |
| The four dead Notion syncs, `NOTION_GRANT_PIPELINE_DB`/`_DS`, `scripts/lib/goods-relevance.mjs`, `funding-weekly-digest` and its cron | DELETE (`git mv` to `_archive/` with a RESTORE.md; Tier 3, needs your verb) | hours |

### The six lanes and how non-deadline money works

Only one of these has a deadline. That is the point.

| Lane | `cadence_kind` | Date written | Where the date comes from |
|---|---|---|---|
| `relationship_philanthropy` | relationship | **Next contact due** | last human touch + 90 days (60 if Priority = Now). The board's `Next contact due` property already carries a **native 08:30 Adelaide reminder**. Notion does the nagging, with zero code and zero cron `[V-prior]` |
| `trustee_aggregator` | relationship | Next contact due | calendar anchor. Perpetual IPAP opens 2026-11-02 |
| `recompete` | recompete | Due date = `end_date` minus 6 months | `grantconnect_awards`. That is when the agency scopes the successor. This date exists on no portal |
| `partner_held` | relationship | Next contact due = partner contract end minus 9 months | `grantconnect_awards` / `justice_funding`. That is when the subcontract conversation must start |
| `buyer` | buyer | Next contact due, driven by `contract_end` | `austender_contracts` + IPP scoreboard |
| `published_round` | deadline | Due date | `act_grant_recommendations`, the only lane that lags a portal |

The page has **two sections of equal weight**: "Closing soon" and "No deadline, still live". The second is the longer one, because 352 of the 414 current strong fits have no deadline `[V]`. And the page groups by the board's own `Money door` property, so a week whose only live items are relationship contacts reads as a full week of work rather than an empty radar. A deadline-only system prints zero on exactly the weeks the relationship work matters most.

Every row carries a **receiving entity**, decided by rule: ancillary funds and DGR-required money go to **The Butterfly Movement Ltd** (Item 1 DGR + PBI since 2012, the only ACT vehicle that can receive them); procurement and trading go to **A Curious Tractor Pty Ltd t/a Goods on Country**; NIAA/IAS and partner-held money goes to the **named community-controlled partner** with ACT as delivery partner. This is marked as a *suggested* route with its reason, never as a determination, because `dgr_required` is populated on 18 of 26,183 rows `[V-prior]`.

### Item quality, because the engine is not as good as its count suggests

Ranking the 414 raw would put a homelessness funder at the top of JusticeHub's list and a wombat-mange grant on PICC's. Verified this session: **ACT-JH's 20 strong fits come from only 6 distinct funders**, and Mercy Foundation "Grants to End Homelessness" occupies 3 of its top 5. ACT-FM's top 5 contains the Taronga Accelerator three times. Three rules, in the render:

- `DISTINCT ON (funder_abn, normalised_name)` before the cap
- an explicit deterministic tiebreak (163 rows tie at `fit_score` 63; without one the page reshuffles daily for no reason)
- a `home_states` penalty applied before the cap, after fixing ACT-MY

Cap: **3 items per project per lane**, roughly one screen. If it does not fit on one screen it has already failed.

### Machine rows are self-expiring (week 3, gated on #162)

If and when we do write board rows: hard cap of 12 rows in `Stage = Identified`, max 2 new per project per week, and any machine row with no human touch in 21 days auto-parks to `Canonical status = Closed / parked` with an appended source note. Never deletes, fully reversible. That makes the "graveyard of stubs" #162 was protecting against structurally impossible rather than merely avoided, and it caps the blast radius of an unobserved malfunction at 12 rows that remove themselves.

### Observability, in the only place anyone looks

The page's **first line**, not its footer:

```
FUNDER RADAR — generated 2026-09-05 07:02 AEST
Source data as at 2026-09-04 (1 day old). OK.
```

and when it is not OK:

```
⚠ DATA IS 8 DAYS OLD — ingest stopped 2026-08-21. This page is showing stale money.
```

The reader is the monitor. Every observability failure in this repo (four months of 404ing crons, 60 consecutive Actions failures, 23 days of invisible 500s, 53,223 unread alerts) was a signal that existed somewhere nobody opened. Behind that: a typed `zero_reason` on every `agent_runs` row (`quota_exhausted` / `no_candidates` / `stale_ingest` / `preflight_refused`), a non-200 from the route, and the schema test in CI. **A bare zero is never printed.**

---

## 5. Week one

The smallest slice that pays for itself is one day, and it delivers 414 per-project recommendations that were refreshed yesterday and no human has ever seen.

**Before any code, two decisions from you, both one line:**
1. Reopen issue #162 and confirm a regenerated *page* (not board rows) is acceptable. This unblocks everything and costs nothing.
2. Name the Notion parent page where "Funder Radar" should live.

| Day | Commit | Standing value |
|---|---|---|
| **1** | `fix(grants): reclassify arc-grants, Lotterywest, ghl_sync as historical_award` — one UPDATE over 6,626 rows. Both match RPCs and both vector indexes already filter on `grant_type`, so it propagates instantly to `/api/profile/matches`, `/api/grants/match`, `/api/chat`, `/api/search/universal` and `/grants/[id]` | Removes ~92% of the semantic noise across all seven embedded projects, with zero new code |
| **1** | `feat(radar): funder-radar script + notion client with error handling` — `notion/client.ts` (with `res.ok` checks), `scripts/funder-radar.mjs` reading `act_grant_recommendations` only, two sections, 3-per-project cap, dedup, deterministic tiebreak, stale-ingest banner. Run it by hand and send Ben the link | **Ships the whole point.** Best three funding doors for each of six projects, including JusticeHub's Paul Ramsay "Just Futures" |
| **2** | `feat(radar): add 12 missing projects to recommendation config; fix ACT-MY home_states` — INSERTs into `act_grant_recommendation_projects` for Oonchiumpa, MMEIC, Maningrida, Barkly, SMART, CAMPFIRE, ConFit, DadLab, June's Patch, Custodian, Diagrama, BG Fit. Picked up on the next nightly refresh, no deploy | The orphan projects enter the radar as data, not as six new scorers |
| **3** | `feat(radar): board mirror` — read the Funders & Opportunities board into `notion_board_rows`, render an "Overdue and stale" section. **Read-only, so it does not touch #162** | Closes the 15-past-due finding. The manual board review becomes one query, run nightly |
| **4** | `feat(radar): v_act_real_grantmakers + relationship lane` — the ACNC screen with `ben_other_charities`, sliced by beneficiary flags per project, with `next_touch_at` | JusticeHub, Maningrida, SMART and Empathy Ledger get their first named, sized funder lists |
| **5** | `chore: archive dead notion sync implementations` + `feat(radar): cron route, schema test, /ops surface` | Nothing left in the tree reads as nearly-finished |

**Do the FRRR application on day 1 in parallel.** Strengthening Rural Communities Small & Vital Round 30 for Mounty Yarns, fit 93, closes 2026-09-17, 19 days from today `[V]`. It is the single highest-scoring recommendation the system has ever produced and it has never been shown to a person.

**The acceptance test is not that the cron is green.** Green has been wrong every single time here. It is a human touch: a `saved_grants` stage move, an `opportunity_decision`, or a board row traceable to a page line. There have been 26 human stage moves in the project's history and none since 2026-05-15 `[V-prior]`. **One in the first fortnight is the signal that this worked. If Ben does not read the page in week one, stop and find out why before building week two.** That answer is worth more than the remaining fortnight of work.

---

## 6. What we chose not to do, and why

### Designs discarded

| Design | Why |
|---|---|
| **Notion Board Keeper** (write machine rows into the board from day one) | Its health signals all lived in surfaces nobody is obligated to open. Total silent death of all four passes would present as "a quiet week". Its two genuinely good ideas, the read-only board mirror and self-expiring capped machine rows, are grafted in |
| **The Funding Page as originally specified** (copy `post-brief-to-notion.mjs` verbatim) | The script it copies swallows every HTTP error and cannot exit non-zero on a delivery failure `[V]`. Its freshness check reads the matview, which goes green over an 8-day-frozen ingest `[V]`. Its "top 3 by fit_score" over a pool where 163 rows tie at 63 reshuffles daily for no reason. All three are fixed above |
| **A per-project keyword scorer** (cloning `goods-relevance.mjs` six times) | 267 lines of hand-tuned constants, dormant 93 days, tagging 124 of 26,183 rows, agreeing with the free semantic path on 14% of results `[V-prior]`. `act_grant_recommendation_projects` is a config table. Adding a project is an INSERT |
| **Any new email, Telegram, outbox or notification table** | Not one funding notification has ever reached a human by any channel `[V]`. Adding a fifth is the same mistake a fifth time |
| **A new Vercel cron for the rebuild, separate from the post** | Two schedules for one output reintroduces the two-step coupling that killed every queue |

### Money sources rejected, so nobody re-proposes them

| Source | Why | Confidence |
|---|---|---|
| **`political_donations` → corporate foundation crosswalk** | It is not a grantmaking flow at all. `donation_to` holds political parties. No ACT entity can be a recipient. And it is redundant: `foundations.parent_company` already bridges Minderoo→Fortescue, BHP Foundation→BHP, Rio Tinto Foundation→Rio Tinto on 122 rows | `[V-prior]` |
| **`state_tenders` as an open-tender feed** | `closing_date` is null on all 199,719 rows. It is QLD contract disclosure, not a tender feed | `[V-prior]` |
| **`foundations.total_giving_annual` as a ranking input** | 9,183 of 10,190 non-null values are exactly 25000, 100000 or 500000. Every existing funder ranking sorts on a placeholder. Retire it as an input, do not drop the column | `[V-prior]` |
| **Stronger Communities Programme** ($39-65M of an earlier headline) | Invitation-only via the local federal MP. There is no open application path and no data work creates one | `[V-prior]` |
| **`organizations` (JusticeHub's 104K hub) as a funder source** | 100% of its foundation-flagged rows with an ABN are already in `foundations`. No giving or revenue column exists anywhere in it | `[V-prior]` |
| **`mv_revolving_door` / `mv_gs_donor_contractors` as funder lists** | Accountability artefacts. 556 large corporates that donate politically and hold contracts. No ACT-reachable philanthropic money. Also: do not quote their dollar totals, they carry ~33% duplicate-contract inflation | `[V-prior]` |
| **Commercial aggregators** (Funding Centre, GrantGuru, The Grants Hub, Philanthropy Australia directory) | All paywalled or JS-login-gated. A buy decision, not a build. Philanthropy Australia's 200-funder directory duplicates 1.2% of what `acnc_ais` already measures in-house | `[V-prior]` |
| **More crawling as the lever for non-advertising philanthropy** | 42% of the screened grantmakers have no website recorded in ACNC. They cannot be crawled at any budget. The route is the trustee aggregator, six doors instead of eleven hundred | `[V-prior]` |
| **The `$3.74bn` / `$3.84bn` / `$958M` headlines** | All three are real sums of real rows and all three overstate what ACT can reach by roughly an order of magnitude, for different reasons: ACCHO-restricted eligibility, human-beneficiary trusts, and invitation-only programs. Use $915M (philanthropy that funds organisations) and ~$300M (partner-side Commonwealth re-compete) instead | `[V]` / `[V-prior]` |

### The one thing that is not a build and matters most

**Supply Nation certification for Goods on Country.** `verification_tier = 'identified'`, `source_primary = 'self-registered'` `[V]`. Every dollar in the $7.43bn IPP lane sits behind a certification ACT does not hold. That is an application, not an engineering task, and no radar will ever surface a way around it.

---

# 3. Completeness critic (overrides the synthesis where they conflict)

I verified rather than flagged where I could. Corrections, most important first.

---

**1. The notification channel the answer designs already exists, is already scheduled, and is Goods-only. This is the biggest miss.**

`composeDeskDigest` (`/Users/benknight/Code/grantscope/apps/web/src/lib/services/act-desk-digest.ts:48`) already builds a daily email whose **Section 1 is grant rounds** — its own comment says the pool applies "grants: deadline ≤ 30d or fit ≥ 85; funders: fit ≥ 85; open buyers always". It has **no queue**: it composes and sends in one job (`sendViaResend`, line 177), then writes `digest_log`. It is scheduled daily at 21:00 in `vercel.json` [V]. It fails on one line — `if (!key) throw new Error('RESEND_API_KEY not set')` (line 179) — and **`RESEND_API_KEY` is present in the repo's local `.env`** [V]. This is a Vercel env-var gap, i.e. a `/config-truth` case, not a build.

So the synthesis's load-bearing architectural claim — *"Every delivery mechanism ever built here has a queue, and no queue has ever had its drainer scheduled"* — is false. The queueless, scheduled, funding-aware sender it prescribes as the new design is already in the tree. That should reframe week one: set the env var, then widen one function.

**But widening is required, and this is where the Goods drift is structural, not rhetorical.** The digest's grant source is `getGoodsGrantsTriage`, which reads `grant_opportunities` ordered by `goods_relevance_score` (`goods-grants-triage.ts:62-65`) [V]. Its sibling inputs are `getGoodsBuyerPipeline`, `getGoodsCapitalWorkspace`, `goods-funder-scan`. Restoring the key would deliver notifications for Goods and nothing else — not the FRRR/Mounty Yarns item, not one of the twelve orphans. The fix is to add `act_grant_recommendations_current` across in-scope project codes as a second decision source in `composeDeskDigest`. That is roughly a day, against the proposed five.

Related contradiction inside the plan: it puts `scripts/lib/goods-relevance.mjs` on the DELETE list while the digest ranks entirely on `goods_relevance_score`. Deleting the scorer without rewiring `goods-grants-triage.ts` freezes the digest's ranking column.

**2. `act_grant_recommendations` is a materialized view that inner-joins `projects`. The Day-2 plan silently returns zero without that.**

It is `relkind='m'` [V], tier `nightly`, enabled, `max_age_hours=36` [V] — so "picked up on the next nightly refresh, no deploy" is right *provided* the project also exists in `projects`, because the MV opens `act_grant_recommendation_projects arp JOIN projects p ON p.code = arp.project_code` [V]. Good news, verified: all twelve exist — **ACT-OO** Oonchiumpa, **ACT-MM** MMEIC Justice, **ACT-MN** Maningrida, **ACT-SM** SMART, **ACT-JP** June's Patch, **ACT-BB** Barkly Backbone, **ACT-BG** BG Fit, **ACT-CE** Custodian Economy, **ACT-CM** CAMPFIRE, **ACT-CT** ConFit Pathways, **ACT-DG** Diagrama, **ACT-DL** DadLab [V]. Use those codes; an INSERT with a code absent from `projects` produces a confident zero.

Two more mechanics the plan misses: the MV has **no `funder_abn` column** (only `funder_name`) [V], so `DISTINCT ON (funder_abn, normalised_name)` cannot run as written; and `tr_passed` suppresses a funder for a project at ≥2 `passed` decisions — 62 already exist [V] — while pg_cron runs `act-auto-pass-stale-pipeline()` daily [V]. A radar that drives auto-passes progressively blinds itself.

**3. "414 strong fits, never seen by a human" is wrong for about 92 of them, and the real fix is one line.**

`/home` already renders `act_grant_recommendations_current` at `fit_score >= 50` (`apps/web/src/app/home/page.tsx:452`) for a hardcoded array: `ACT-HV, ACT-EL, ACT-JH, ACT-GD, ACT-CORE, ACT-FM` (line 435) [V]. Per-project strong fits [V]: ACT-PI 268, ACT-MY 54, ACT-GD 54, ACT-JH 20, ACT-FM 11, ACT-HV 7. So JusticeHub's 20 and Goods' 54 **are** on a surface today; the genuinely unsurfaced 322 are ACT-PI and ACT-MY, which are missing from that array. Adding two strings to `ACT_PROJECT_CODES` surfaces both. The honest claim is "never *pushed*, and the two largest piles are not even on the pull surface."

**4. The ACT-MY diagnosis is causally inverted, and its factual premise is contested by the repo.**

Measured [V]: the Create NSW rows score `geography_score = 0` and reach fit 78 purely on `theme_score = 50`. `home_states='QLD'` is already penalising them. Changing it to NSW as proposed would **raise** those rows, not remove them. The real lever is a geography floor, not the config value.

And the premise is disputed by the config itself: ACT-MY's `theme_keywords` are `mount isa, north queensland, regional partnership, transport…` and its notes read "especially around Mount Isa" [V]. If Mounty Yarns is Mount Druitt NSW, then the entire keyword list is wrong, not one field — a one-line fix would leave the scorer pointed at Mount Isa. This needs Ben to adjudicate before either edit.

Also worth disclosing: FRRR's fit 93 is partly self-referential — `frrr` is literally a theme keyword for ACT-MY [V]. The item is real (SRC Small & Vital Round 30, deadline 2026-09-17, verified [V]) but its rank is inflated by a funder-name keyword match.

**5. Day 1's two commits are unrelated systems; the first does not improve the second.**

The reclassification arithmetic is right — arc-grants 5,598 + Lotterywest 768 + ghl_sync 260 = 6,626, and brisbane-grants/qld-arts-data are already `historical_award` [V]. Both `match_grants_for_org` and `search_grants_semantic` do reference `grant_type` [V], so the semantic-surface benefit is real. But the recommendation MV never reads `grant_type`. It reads `alma_funding_opportunities` filtered on `opportunity_type='open_grant' AND verification_status='verified'` — a pool of **2,613 rows, 2,180 of them with no deadline** [V] — and only **10 arc rows exist in alma at all** [V]. So "removes ~92% of the semantic noise" should not be presented as improving the per-project recommendations shipped in the same day.

**6. $915M reproduces, but "721 funders" reads as breadth it does not have.**

My independent screen [V]: 2,793 funders / $3.84bn; `ben_other_charities` subset **724 funders / $916M**; `max(ais_year) = 2023`. The royalty-trust correction holds — Yajilarra, Nyiyaparli, Gumala, PKKP, Noongar Boodja, Groote Eylandt and Centrecorp are all `ben_other_charities = false`; ALFA (NT) Limited and Karrkad-Kanjdji Limited are `true` [V].

Missing qualifier: **the top 10 funders are $372.8M of the $916M (40.7%), and 589 of the 724 give under $1M a year** [V]. The genuinely new material is a long tail of sub-$1M givers, not $915M of addressable breadth — several of the named giants (Paul Ramsay, Myer, Buckland, Movember) ACT already knows. Minor: Karrkad-Kanjdji's ACNC registered state is **VIC**, not NT [V], so "both in Arnhem Land" is a program claim, not a register fact.

**7. Debris the sweep missed — and it is the exact pattern CLAUDE.md warns about.**

`vercel.json` declares 10 crons; pg_cron holds 6 jobs; neither includes these [V]:
- **`vercel-cron:system/alerts/deliver` — `failed` on 11 of 11 consecutive daily runs**, 2026-08-18 to 2026-08-28. A scheduled alert *drainer*, failing silently every day, invisible.
- `vercel-cron:contained/daily-digest` — `success` daily with `items_found = 0`. A confident zero, which CLAUDE.md names as the tell.

**8. Entity routing ignores the column that actually has coverage, and the config is stale against the Butterfly constraint.**

`dgr_required` non-null on **18** of 26,197 [V] — the synthesis is right. But `accepts_pty_ltd` is non-null on **1,871** rows, 1,822 true [V], and is already read by `goods-grants-triage`. That is the usable routing signal and it goes unmentioned. Separately, `act_grant_recommendation_projects.entity_preference` reads `sole_trader_then_pty` on 9 of 12 rows and `pty_ltd` on the rest; `dgr_required` is `false` on all 12 [V]. **No config row routes to Butterfly**, and the sole trader wound down 30 June 2026 — two months ago. Stale config against the hard DGR-through-Butterfly-only constraint.

**9. Two figures to downgrade from `[V]`/`[V-prior]` to unverifiable-from-here.**

- "23 daily runs of `/api/cron/desk-digest`, 500 every day": `agent_runs` contains **zero** rows for desk-digest [V]. `digest_log` is 0 rows [V], so the *outcome* is verified, but the run count has no DB or repo source — Vercel logs only. State it as such.
- "`goods-relevance.mjs` tagging 124 of 26,183 rows" does not reproduce: `goods_relevance_score` is non-null on **24,982 of 26,197 (95%)** [V]. The 69-rows-≥60 figure is about the threshold, not coverage.

**10. Project inventory is incomplete.** `ACT-GP` (Gold Phone) is `in_scope = true` in the config with 0 strong fits and appears nowhere in the synthesis [V]. `projects` also holds ACT-JC (JusticeHub Centre of Excellence), ACT-PC, ACT-PS, ACT-ER [V]. The "five in-scope projects return zero" count is correct (ACT-CORE, ACT-CS, ACT-GP, ACT-EL, ACT-CN) [V], but ACT-GP is never named among them.

---

**On the two halves.** (a) Where the money is: strong, and the corrections that matter most — `ben_other_charities`, the ACCHO restriction, the 23-47% re-compete rate — are the kind that survive contact. (b) Better notification: under-answered, because it designs a new channel without noticing the working one is already built, scheduled, and one env var from sending.

**On orphan drift.** Section 2 genuinely serves the orphans — named funders, named instruments, and the honest point that eight of them are subcontract routes rather than applications. That half does not drift. **The build does.** Day 1 ships a list that is 65% ACT-PI; the orphans get nothing until Day 2; and the only working delivery plumbing ranks on `goods_relevance_score`. The Goods gravity is in the pipes, not the prose, which is why it survived a rewrite.

**Solid and I would not touch it:** the five-lane delivery post-mortem, the `post-brief-to-notion.mjs` missing-`res.ok` finding, the `cadence_kind` design, spec #162 as a live decision, the rejected-sources table, and Supply Nation certification as the highest-leverage non-build action. ACT's four ABNs return **zero** rows across `grantconnect_awards`, `austender_contracts` and `justice_funding` [V] — the no-track-record constraint is real and is the sharpest thing in the document.