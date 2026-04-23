# Civic Scope x Goods V1 CEO Signoff Package

Prepared: 24 Apr 2026
Audience: CEO / internal release signoff
Status: Internal operating release package

## Release Frame

This is not a public launch. V1 proves that Civic Scope can turn Goods on Country's scattered operating context into a decision system:

- where community demand is highest
- who can buy or distribute Goods products
- who can fund the next stage
- who needs follow-up
- what action happens next

The CEO should be able to complete the walkthrough in under 15 minutes and understand the operating loop without builder narration.

## Verified Surfaces

| Surface | Role | URL |
|---|---|---|
| CEO/project dashboard | Compiled Goods decision brief, capital routes, procurement routes, foundation board, pipeline, contacts, reference signals | `/org/act/goods` (requires signed-in CivicGraph session) |
| Discovery workspace | Community need, buyer ranking, capital targets, grants, GHL export, weekly snapshot | `/goods-workspace` (requires signed-in CivicGraph session) |
| Goods v2 QBE cockpit | Weekly execution, QBE timeline, capital strategy, target intake, identity review, GHL push | `https://www.goodsoncountry.com/admin/qbe-program` |

## Live Snapshot

Verified from the GrantScope database on 24 Apr 2026.

| Metric | Count |
|---|---:|
| Goods communities | 1,546 |
| NT/QLD Goods communities | 995 |
| Goods buyer/partner entities | 4,952 |
| High-fit buyer targets | 1,020 |
| Open Goods procurement signals | 256 |
| Goods tracked assets | 404 |
| ACT Goods pipeline items | 22 |
| ACT Goods pipeline value | $3.655M |
| Seeded Goods foundation relationships | 6 |
| Active foundation conversations | 3 |
| Goods project contacts | 8 |

Top current community demand signals:

| Community | State | Beds | Washers | Fridges | Known buyer | Priority |
|---|---:|---:|---:|---:|---|---|
| Maningrida | NT | 930 | 116 | 116 | Maningrida Progress Association Inc | lead |
| Wadeye | NT | 918 | 115 | 115 | Northern Land Council | lead |
| Galiwinku | NT | 841 | 105 | 105 | Northern Land Council | lead |
| Wurrumiyanga | NT | 630 | 79 | 79 | Tiwi Land Council | lead |
| Milingimbi | NT | 493 | 62 | 62 | Milingimbi and Outstations Progress Resources Aboriginal Corporation | lead |
| Ngukurr | NT | 463 | 58 | 58 | Ngukurr Progress Aboriginal Corporation | lead |

## Six-Slide CEO Deck

HTML deck: `/Users/benknight/Code/grantscope/apps/web/public/reports/civic-scope-goods-v1-ceo-signoff.html`

When the web app is running, open:

```text
http://127.0.0.1:3003/reports/civic-scope-goods-v1-ceo-signoff.html
```

Slide outline:

1. **What This Is**
   Civic Scope is the decision layer behind Goods. It connects community need, product demand, buyer pathways, funders, grants, CRM, and QBE execution.

2. **Why Goods Needs It**
   Goods is no longer just a product pilot. It needs a system to manage demand, capital, procurement, community partners, proof, and follow-up.

3. **How It Works**
   Data flows from CivicGraph, Goods wiki/project context, Goods asset records, foundations/grants, GHL/CRM, and Goods v2 into three working views.

4. **What The CEO Can See Today**
   The CEO dashboard shows recommended focus, operating queue, capital routes, procurement routes, decision brief, foundation board, pipeline, contacts, and reference signals.

5. **What The Team Can Do Today**
   The team starts with high-need NT/QLD communities, identifies buyer gaps, ranks buyers and funders, exports targets, pushes selected outreach into GHL, then works actions through QBE.

6. **Release Decision**
   Sign off V1 for internal operating use when smoke tests pass, past deadline rows are labelled, and the CEO can complete the walkthrough without builder support.

## 12-Minute Walkthrough

### 0:00-1:00 - Open the CEO frame

Open `/org/act/goods`.

Show:

- workspace strip
- freshness chips
- recommended focus
- lane navigation

Say:

> This is the Goods operating brief. It is not a long report. It tells us what the system thinks we should look at first, then lets us move into capital, procurement, foundations, pipeline, or references.

### 1:00-3:00 - Decision Brief

Open **Decision Brief**.

Show:

- operating thesis
- capital thesis
- procurement thesis
- vehicle/applicant path
- ownership pathway
- current priorities
- proof points
- readiness gaps

Say:

> This turns the Goods wiki and working context into a decision brief: what we are building, what capital is needed, how procurement fits, and what still blocks signoff.

### 3:00-5:00 - Capital and Foundations

Open **Capital Routes** and **Foundations**.

Show:

- Snow Foundation
- QBE Foundation
- Minderoo
- Paul Ramsay
- Australian Communities Foundation
- Nova Peris Foundation

Say:

> This is a managed relationship board, not a list of names. Each funder has a stage, fit score, message alignment, ask shape, next touch, and readiness status.

### 5:00-7:00 - Procurement Routes

Open **Procurement Routes**.

Show:

- remote housing procurement anchor
- Homeland Schools bed pathway
- community-controlled demand anchor
- health and environmental health route
- corporate RAP procurement route
- procurement platform and compliance layer

Say:

> Goods is a product business and a procurement-infrastructure play. This view keeps those two paths visible at the same time.

### 7:00-10:00 - Goods Workspace

Open `/goods-workspace`.

Show:

- need-led search
- NT-only mode
- community map
- buyer gaps
- buyer ranking
- capital targets
- export buttons
- GHL push preview
- weekly operating snapshot

Say:

> This is the discovery engine. It starts from community need, moves to plausible buyers and capital paths, then exports a clean action set into the relationship system.

### 10:00-11:30 - Goods v2 QBE Program

Open `https://www.goodsoncountry.com/admin/qbe-program`.

Show:

- QBE timeline
- capital strategy
- target intake
- identity review
- push/open-contact actions

Say:

> Civic Scope finds and ranks the opportunity. Goods v2 runs the action. GHL records the relationship. Asset and procurement signals update the next decision.

### 11:30-12:00 - Release Decision

Say:

> V1 is ready for internal use when the signoff check passes, the walkthrough runs without dead ends, and stale items are visibly historical rather than presented as live next actions.

## Signoff Checklist

Run:

```bash
cd /Users/benknight/Code/grantscope
/Users/benknight/Code/grantscope/scripts/goods-signoff-check.sh
```

Manual smoke:

- Sign in to CivicGraph before opening the protected routes.
- `/org/act/goods` renders workspace strip, sticky nav, pressure points, queue, capital, procurement, decision brief, pipeline, contacts, and foundation board.
- `/goods-workspace` loads community, buyer, signal, foundation, grant, and GHL pipeline data.
- Goods v2 QBE Program loads discovery intake, identity health, backfill review, and push/open-contact actions.
- CEO can complete the walkthrough in under 15 minutes.
- Past open pipeline deadlines display as `historical/past` in the pipeline table.

## Browser Smoke Status

Checked in the Codex in-app browser on 24 Apr 2026.

| Surface | Result | Notes |
|---|---|---|
| CEO deck | Pass | Static report loaded from `/reports/civic-scope-goods-v1-ceo-signoff.html`; desktop and mobile overflow checks passed. |
| `/org/act/goods` | Pass | Authenticated session loaded the Goods dashboard; project workspace, recommended focus, pressure points, operating queue, capital routes, procurement, decision brief, foundation contacts, contacts, and reference signals were present. |
| `/goods-workspace` | Pass | Authenticated session loaded the discovery workspace; community, buyer, signal, foundation, grant, GHL, and weekly snapshot surfaces were present. |
| Goods v2 `/admin/qbe-program` | Pass after production redeploy | Authenticated live route now exposes `Weekly cockpit`, `Identity health`, `Discovery intake`, `Backfill target IDs`, `Push to GHL`, `Open People`, and linked/needs-decision/unmatched/reviewed status chips. `Run identity check`, `Backfill target IDs`, and `Push to GHL` were not clicked during smoke testing because they can mutate CRM/contact state. |
| Goods v2 `/admin/qbe-actions` | Partial pass | Authenticated route loaded the weekly action board. State-changing action completion/review controls were not triggered during smoke testing. |

## Automated Check Status

Checked on 24 Apr 2026 after the Goods v2 production redeploy.

| Check | Result | Evidence |
|---|---|---|
| `scripts/goods-signoff-check.sh` | Pass | GrantScope `npx tsc --noEmit` completed, Goods v2 `npm run build` completed, and the script printed the manual smoke checklist with exit code `0`. |

## Past Deadline Rows

These rows are past their listed deadline but remain useful as historical context or next-round targets. The app now labels past open pipeline deadlines as `historical/past` without mutating the source records.

| Opportunity | Current status | Deadline | Treatment |
|---|---|---:|---|
| ACCOs GROW Program | upcoming | 2026-03-19 | Historical/past until next round is confirmed |
| Circular Markets Grants | upcoming | 2026-03-23 | Historical/past until next round is confirmed |
| Transforming QLD Manufacturing | prospect | 2026-04-16 | Historical/past until next round is confirmed |

## Release Decision Criteria

Sign off V1 for internal operating use if:

- the signoff script passes
- the two Civic Scope surfaces load with live data
- the Goods v2 QBE cockpit loads
- the CEO can identify the next funder, next buyer route, and next community demand signal
- stale/past items are not presented as urgent live deadlines

Do not sign off for public release yet. V1 is an internal operating system release.
