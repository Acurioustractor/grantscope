# GrantScope Data Review Scorecard

Generated 2026-04-10.

Use this scorecard for the weekly truth loop.

## Review Sample

Every week, review:

- `100` grants
- `50` foundations

Split the sample:

- `50%` recent or high-fit results from user-facing surfaces
- `25%` alert-driven rows
- `25%` random rows from the broader corpus

Review these surfaces directly:

- `/profile/matches`
- `/alerts`
- `/tracker`
- `/home`
- foundation profile pages

## Scoring Categories

Every row gets one primary status:

- `correct`
  - accurate, current, and usable without caveat
- `usable_but_incomplete`
  - basically right, but missing one or more fields needed for confident action
- `wrong_noisy`
  - stale, misleading, irrelevant, broken, duplicated, or clearly false

## What To Check For Grants

Score these fields:

- title
- provider
- amount
- deadline
- open/closed status
- URL works
- match relevance
- why-this-matched explanation feels defensible
- user can decide whether to act

Mark major issue type:

- `dead_url`
- `closed_but_marked_open`
- `historical_not_live`
- `duplicate`
- `wrong_match`
- `missing_deadline`
- `missing_amount`
- `unclear_provider`
- `bad_category_or_focus`

## What To Check For Foundations

Score these fields:

- profile accuracy
- website / page quality
- program quality
- prior grantee quality
- relationship signal quality
- fit or prospect value

Mark major issue type:

- `wrong_foundation_identity`
- `dead_site_or_page`
- `no_actionable_program_info`
- `bad_grantee_extraction`
- `bad_relationship_signal`
- `too_thin_to_use`
- `stale_program_state`

## Acceptance Thresholds

These are the thresholds that matter:

- `>= 70%` of matched grants should be `correct` or `usable_but_incomplete`
- `>= 75%` of reviewed foundations should be `correct` or `usable_but_incomplete`
- `<= 10%` of sampled open grants should be `closed_but_marked_open`
- `<= 5%` of sampled rows should have broken primary URLs

If any threshold fails:

- stop adding new top-of-funnel marketing work
- assign the top issue buckets into product/data cleanup

## How To Use The CSV Template

Use:

- [/Users/benknight/Code/grantscope/thoughts/plans/grantscope-data-review-scorecard-template.csv](/Users/benknight/Code/grantscope/thoughts/plans/grantscope-data-review-scorecard-template.csv)

Fill one row per reviewed item.

Required columns:

- `record_type`
- `surface`
- `source`
- `record_id`
- `status`
- `issue_type`
- `match_relevance_score`
- `actionability_score`
- `notes`

## Weekly Review Output

At the end of each review session, summarize:

- top `5` issue buckets by count
- top `3` issue buckets by user harm
- top `5` sources producing wrong/noisy records
- top `5` foundations producing weak prospect value
- recommended fixes for next sprint
