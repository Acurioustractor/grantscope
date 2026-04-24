# GrantScope Testing Pack

Generated 2026-04-10.

This pack is for one job: validate whether GrantScope's current wedge is strong enough to convert into a repeatable product.

The wedge to test is:

- `always-on grant pipeline`
- `foundation prospecting before rounds open`
- `alerting that creates real pipeline work`

This is not a broad market-research exercise. It is a 30-day validation loop across data quality, user flow, and willingness to pay.

## What To Validate

GrantScope needs to prove four things in order:

1. The data is trustworthy enough to act on.
2. New users can get to value quickly.
3. Alerts create repeat visits and pipeline activity.
4. Real buyers will pay for the product without a long custom-sales cycle.

## Primary ICP

Test these groups in order.

### ICP 1: Grant consultants and freelance grant writers

Why first:

- immediate ROI
- repeated use across multiple clients
- already used to paying for research leverage
- faster purchase cycle than large institutions

Target sample:

- `10` consultants
- mix of solo operators and firms with `2-10` staff

### ICP 2: In-house nonprofit grants and fundraising leads

Why second:

- strong need signal
- credible self-serve buyer
- validates whether the product works outside consultant workflows

Target sample:

- `10` nonprofit grants or fundraising leads
- org size target: `A$500k-A$20m` annual revenue

## The 3 Validation Loops

Run these in parallel every week.

### 1. Data Truth Loop

Objective:

- measure whether the product is correct enough to trust

Method:

- review `100` matched grants
- review `50` foundations
- score each row using the review scorecard template

Use:

- [/Users/benknight/Code/grantscope/thoughts/plans/grantscope-data-review-scorecard-2026-04-10.md](/Users/benknight/Code/grantscope/thoughts/plans/grantscope-data-review-scorecard-2026-04-10.md)
- [/Users/benknight/Code/grantscope/thoughts/plans/grantscope-data-review-scorecard-template.csv](/Users/benknight/Code/grantscope/thoughts/plans/grantscope-data-review-scorecard-template.csv)

### 2. User Flow Loop

Objective:

- observe where users get value and where they stall

Method:

- run `5` live sessions per week
- give each participant one real funding task
- observe the exact path:
  - `/profile`
  - `/profile/matches`
  - `/tracker`
  - `/alerts`
  - `/home`

Use:

- [/Users/benknight/Code/grantscope/thoughts/outreach/grantscope-interview-script-2026-04-10.md](/Users/benknight/Code/grantscope/thoughts/outreach/grantscope-interview-script-2026-04-10.md)

### 3. Willingness-To-Pay Loop

Objective:

- find out whether the product is valuable enough to buy now

Method:

- run `2-week` guided pilots
- ask for a concrete payment decision at the end
- do not accept vague interest as validation

Use:

- [/Users/benknight/Code/grantscope/thoughts/outreach/grantscope-pilot-plan-2026-04-10.md](/Users/benknight/Code/grantscope/thoughts/outreach/grantscope-pilot-plan-2026-04-10.md)

## 30-Day Execution Calendar

### Week 1

- recruit first `10` consultant pilots
- recruit first `5` nonprofit pilots
- run `5` observed sessions
- complete first `100 grant / 50 foundation` review
- establish day-0 funnel baseline from `/ops`, `/alerts`, and `product_events`

### Week 2

- onboard active pilot users
- run weekly digest and alert review with them
- run second `100 grant / 50 foundation` review
- identify top 10 repeated trust issues and top 5 repeated flow failures

### Week 3

- ask pilot users for a concrete payment decision
- test revised onboarding and alert framing on new users
- compare consultant vs nonprofit activation rates
- review which alerts actually created tracked grants

### Week 4

- decide whether to keep current wedge, narrow it, or reposition it
- decide whether to keep Community -> Professional self-serve as primary motion
- convert the strongest pilots into paying users or paid design partners

## Exact Success Metrics For The First 30 Days

These are the metrics that decide whether the product is working.

### Data Quality

- `matched grant precision >= 70%`
  - definition: grant scored `correct` or `usable but incomplete`, not `wrong/noisy`
- `foundation prospect precision >= 75%`
  - definition: foundation page and relationship/prospect data are actionable for a user
- `open now trust score >= 85%`
  - definition: sampled grants marked open are actually open, current, and clickable

### Activation

- `profile_ready rate >= 80%`
  - users who reach `profile_ready` within 24h of signup
- `first shortlist rate >= 60%`
  - users who trigger `first_grant_shortlisted` within 24h of `profile_ready`
- `pipeline_started rate >= 40%`
  - users who trigger `pipeline_started` within 7 days of signup
- `first_alert_created rate >= 50%`
  - users who trigger `first_alert_created` within 7 days of signup

### Alert Retention

- `alert click-through rate >= 20%`
  - users or events with `notification_clicked` or `digest_clicked` after send
- `click-to-track rate >= 20%`
  - attributed saved grants divided by alert clicks
- `alert-created pipeline rate >= 15%`
  - users with `saved_grants.source_alert_preference_id is not null` divided by users with active alerts

### Commercial Validation

- `pilot weekly active rate >= 70%`
  - pilot users who return at least once per week
- `payment intent rate >= 30%`
  - pilot users who say they would pay now or ask for procurement/billing steps
- `paid conversion or paid pilot commitment >= 20%`
  - consultants or nonprofits who convert to paid or commit to a paid design partnership
- `Sean Ellis score >= 40%`
  - users answering "very disappointed" to "How would you feel if you could no longer use GrantScope?"

## Instrumentation Map

Use these existing events and surfaces instead of inventing new tracking.

### Product Events

From [/Users/benknight/Code/grantscope/apps/web/src/lib/product-events.ts](/Users/benknight/Code/grantscope/apps/web/src/lib/product-events.ts):

- `profile_ready`
- `first_grant_shortlisted`
- `pipeline_started`
- `first_alert_created`
- `alert_clicked`
- `upgrade_prompt_viewed`
- `upgrade_cta_clicked`
- `checkout_started`
- `subscription_trial_started`
- `subscription_activated`

### Alert And Pipeline Evidence

Use:

- `alert_events`
- `grant_notification_outbox`
- `saved_grants`
- `/alerts`
- `/ops`

Key attribution fields:

- `saved_grants.source_alert_preference_id`
- `saved_grants.source_notification_id`
- `saved_grants.source_attribution_type`

## Review Queries

Use these directly with `node --env-file=.env scripts/gsql.mjs "..."`.

### 30-day product funnel

```sql
SELECT
  event_type,
  COUNT(*) AS events,
  COUNT(DISTINCT user_id) AS users
FROM product_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_type
ORDER BY users DESC, events DESC;
```

### Alert-attributed pipeline

```sql
SELECT
  source_attribution_type,
  COUNT(*) AS saved_grants,
  COUNT(*) FILTER (WHERE stage <> 'discovered') AS active_pipeline,
  COUNT(*) FILTER (WHERE stage = 'submitted') AS submitted,
  COUNT(*) FILTER (WHERE stage = 'won') AS won
FROM saved_grants
WHERE source_alert_preference_id IS NOT NULL
GROUP BY source_attribution_type
ORDER BY saved_grants DESC;
```

### Pilot cohort conversion

```sql
SELECT
  op.subscription_plan,
  op.subscription_status,
  COUNT(*) AS profiles
FROM org_profiles op
GROUP BY op.subscription_plan, op.subscription_status
ORDER BY profiles DESC;
```

## Decision Rules

At the end of the 30 days:

- keep the current wedge if activation, trust, and payment metrics all pass
- narrow to consultants first if consultants materially outperform nonprofits on activation and payment
- pause broader marketing if `open now trust score` or `matched grant precision` fail
- do not scale self-serve spend until at least `20%` of active pilots convert to paid or paid-commit

## Output Of This Testing Cycle

By the end of 30 days you should be able to answer:

- who gets value fastest
- where the product is still noisy
- whether alerts create real funding work
- whether users will pay for Professional or Organisation now
- which single ICP and workflow should define the next 90 days
