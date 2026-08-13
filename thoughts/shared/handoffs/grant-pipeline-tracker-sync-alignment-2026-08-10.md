# Grant Pipeline Tracker Sync Alignment

Last checked: 2026-08-10.

Notion database: Grant Pipeline Tracker (`2784ae13-61ba-4bbf-bb62-10c42c0553ee`)
Data source: `collection://3179e5da-b77c-4618-ad9a-55ac0798485d`
Current env target: `NOTION_GRANT_PIPELINE_DB=2784ae13-61ba-4bbf-bb62-10c42c0553ee`

## Decision

Use the Notion Grant Pipeline Tracker as the grant-writing workbench, not the canonical CRM or discovery system.

- GrantScope owns opportunity identity, source URL, funder, deadline, eligibility, scoring, verification, duplicate handling, and current opportunity status.
- GoHighLevel owns relationship movement, external owner-visible opportunity stage, supporter/community pathway stages, and follow-up accountability.
- Notion owns application-writing state: readiness score, missing documents, draft narrative, application checklist, questions, attachments, and review notes.

The key implementation rule is stable IDs first. Do not let fuzzy title matching create or update production records.

## Current State

Verified from Notion:

- The Grant Pipeline Tracker has useful fields already: `Grant Name`, `Stage`, `Amount`, `Application URL`, `Deadline`, `Funder`, `Key Requirements`, `Missing Documents`, `Notes`, `Project`, `Readiness Score`, and `Supabase ID`.
- Stage options are compatible with writing work: `Identified`, `Researching`, `Pursuing`, `Drafting`, `Submitted`, `Negotiating`, `Approved`, `Lost`, `Expired`.
- The "Closing Soon" view filters active writing stages with deadlines inside 60 days.
- The "Overdue / No Deadline" view catches active rows with no deadline or a past deadline.

Verified from Supabase mirrors:

- `notion_grants` is populated from this tracker, but `last_synced` is stale at 2026-03-22 for the rows inspected.
- Many Notion rows have blank `Supabase ID` or legacy values such as `LM7`, not GrantScope UUIDs.
- `funding_ghl_handoffs` currently has no recent rows for the August BFGN opportunities; the explicit GrantScope-to-GHL handoff path is underused.
- GHL has the active pipeline surfaces:
  - `Grants`: application-level stage, including `Grant Opportunity Identified`, `Application In Progress`, `Grant Submitted`, `Grant Declined`.
  - `Goods Supporter Journey`: relationship/funder movement such as `Identified`, `Qualified`, `Cultivating`, `Ask made`, `Renewing`, `Stewarding / Reporting`.
  - `Goods - Community Pathways`: place/community movement such as `Invitation`, `Listening`, `Modules selected`, `Review and adapt`.

## Current Opportunities to Reconcile

These should be treated as the first sync test set because they appear across Notion, GrantScope, or GHL:

| Opportunity | Current Notion state | Current GrantScope/GHL state | Reconciliation |
|---|---|---|---|
| SEDI Capability Building / SEDI First Nations | Notion has `Social Enterprise Capability Building Grants`, stage `Pursuing`, no real Supabase UUID | GrantScope has SEDI general `5e52c7ef-a1b1-4319-b57c-421448dc3f27` and SEDI First Nations `89e7a97d-6d2d-43d1-8d27-e1d690968702`; GHL has SEDI rows in both Grants and Goods Supporter Journey | Split into two Notion rows or explicitly label one as general SEDI and one as First Nations SEDI. Store real GrantScope UUID and GHL ID. |
| Catalysing Impact Stage 2 | Notion `Researching`, ACT-GD, amount $400k, no deadline | GrantScope row `478495a0-e727-44b4-a22b-541ca3816c66`; GHL row exists; QBE relationship also lives in Goods Supporter Journey | Keep Notion as writing brief/readiness, GHL Supporter Journey as relationship, Grants pipeline only if a specific application round is active. |
| REAL Innovation Fund - Oonchiumpa Goods EOI | Notion `Submitted`, amount $1.2m | GrantScope row `0f774f83-29ff-4f59-8b77-53c29040a214`; GHL stage appears stale/lost in mirror | Decide whether this is closed, still reviewing, or superseded; then update all three systems from one decision. |
| Snow Foundation - Oonchiumpa Operational Funding Year 1 | Notion `Submitted`, no deadline | GrantScope row `06e54747-406d-4d2b-a1c1-2753dbe450e6`; GHL has Snow as supporter journey with historical funding | Treat as relationship/supporter ask, not an open grant round unless a current ask is confirmed. |
| Aboriginal Investment NT Business Start-Up Grant | Notion `Researching`, amount $100k | GrantScope row `2a233fa7-4867-4288-a0d3-0ff1eb2d25e9`; GHL row exists | Good candidate for writing workbench once NT applicant authority and project scope are confirmed. |
| First Nations Clean Energy Advice Grants | Notion `Researching`, deadline 2026-09-03 | GrantScope row `ef5fe660-2e34-4101-bceb-5ead991bd4a8`; no GHL ID in current query | Use as an active deadline-driven writing row only if applicant and clean-energy advice scope are real. |
| FRRR Strengthening Rural Communities - Small & Vital | Notion `Researching`, deadline 2026-09-17 | GrantScope has `Connectedness Stream (via FRRR)` and older FRRR rows; GHL has declined FRRR grant rows and Goods supporter history | Needs source verification and canonical row selection before any GHL promotion. |
| RADF Small Grants / Major / Mentorship | Notion has ACT-HV pursuing rows | GrantScope/GHL has Sunshine Coast RADF rows, including stale/lost rows | Good pilot for Harvest grant-writing workflow, but not Goods. Keep separate project code and avoid polluting Goods pipeline. |

## Field Mapping

GrantScope to Notion:

| GrantScope | Notion Grant Pipeline Tracker |
|---|---|
| `grant_opportunities.id` | `Supabase ID` |
| `name` | `Grant Name` |
| `provider` | `Funder` |
| `amount_max` else `amount_min` | `Amount` |
| `deadline` else `closes_at` | `Deadline` |
| `url` | `Application URL` |
| `requirements_summary` / eligibility summary | `Key Requirements` |
| project code from decision/handoff | `Project` |
| computed readiness | `Readiness Score` |
| missing evidence checklist | `Missing Documents` |
| verification/update timestamp | `Last Updated` |

Notion to GrantScope:

- Only allow writing/readiness fields to flow back automatically:
  - `Readiness Score`
  - `Missing Documents`
  - selected `Notes`
  - `Application URL` if GrantScope URL is blank and the row has a stable `Supabase ID`
- Do not let Notion overwrite funder, deadline, amount, status, or canonical URL unless the update is explicitly reviewed.

Notion to GHL:

- Notion `Stage` should not directly move GHL supporter/community stages.
- Notion can propose Grants pipeline movement only after an explicit decision:
  - `Pursuing` or `Drafting` may create/update a Grants pipeline opportunity only when `Supabase ID`, project code, applicant entity, owner, next action, and amount sought are present.
  - `Submitted` can move a Grants opportunity to `Grant Submitted`.
  - `Approved` can move to won/approved only with award evidence.
  - `Lost` / `Expired` can move to declined/lost only when the official decision or deadline evidence is recorded.

## Stage Mapping

| Notion writing stage | GrantScope decision/status | GHL Grants stage | Meaning |
|---|---|---|---|
| Identified | `discovered` / `watching` | Grant Opportunity Identified | Possible opportunity, not yet scoped. |
| Researching | `watching` | Grant Opportunity Identified | Eligibility/source verification in progress. |
| Pursuing | `pursuing` | Application In Progress only after explicit handoff | Internal decision to pursue. |
| Drafting | `applied` | Application In Progress | Application writing has started. |
| Submitted | `submitted` | Grant Submitted | Submitted with evidence. |
| Negotiating | `submitted` / `won_pending_conditions` if added later | Application In Progress or custom review stage | Funder follow-up, conditions, clarification. |
| Approved | `won` | Approved / won | Award evidence received. |
| Lost | `lost` / `passed` | Grant Declined / lost | Rejected or deliberately passed. |
| Expired | `expired` | Grant Declined / lost if a GHL grant opp exists | Deadline passed without submission. |

## Implementation Plan

1. Normalize IDs in the Notion tracker.
   - Backfill real `grant_opportunities.id` into `Supabase ID` for high-confidence matches only.
   - Add `GHL Opportunity ID` and `Sync Status` fields if we want Notion to display live GHL linkage. Otherwise keep GHL IDs in GrantScope only.

2. Replace fuzzy Notion sync behavior.
   - Update `scripts/sync-pipeline-to-notion.mjs` so it writes `Supabase ID` directly, not `[CG:...]` inside `Notes`.
   - Upsert by `Supabase ID`, not by title.
   - Stop creating new Notion rows from `saved_grants` unless the saved row is tied to a canonical `grant_opportunities.id`.

3. Make `funding_ghl_handoffs` the only path from "we are pursuing" to GHL.
   - The handoff row must include `project_code`, `opportunity_id`, `amount_sought`, `applicant_entity`, `relationship_owner`, `next_action`, and `next_action_due`.
   - Successful handoff stores `ghl_opportunity_id`.
   - GHL callbacks update decision state, but do not rewrite writing content.

4. Use Notion for writing packets.
   - For each pursued opportunity, create/update a Notion tracker page with:
     - application questions,
     - evidence checklist,
     - missing documents,
     - budget draft,
     - narrative draft,
     - review comments.
   - Store the Notion page ID back on `act_grant_recommendation_decisions.notion_page_id` or a dedicated tracker link table.

5. Run a narrow pilot.
   - Pilot set: SEDI, Catalysing Impact Stage 2, Aboriginal Investment NT Business Start-Up, First Nations Clean Energy Advice Grants, one Harvest RADF row.
   - Success condition: each has a real GrantScope UUID in Notion, a clear GHL status, and no duplicate GHL opportunities created.

## Guardrails

- Never create a GHL opportunity from Notion title alone.
- Never treat Goods Supporter Journey stage as application-writing status.
- Never treat a Notion `Pursuing` row as authority to submit; it means the writing workbench is active.
- Expired Notion rows should be archived/marked expired in Notion, not used to close GrantScope records unless the canonical GrantScope row and source evidence agree.
- Relationship/supporter asks like Snow can have writing notes, but should not become Grants pipeline records unless there is a named grant round or current application process.

## Immediate Next Actions

1. Backfill canonical IDs for the pilot set in Notion.
2. Add `GHL Opportunity ID` and `Sync Status` to the Notion tracker if the team wants live linkage visible there.
3. Patch `scripts/sync-pipeline-to-notion.mjs` to upsert by `Supabase ID`.
4. Patch the Notion mirror ingest so `notion_grants.last_synced` reflects current rows again.
5. Use `funding_ghl_handoffs` for any opportunity promoted from writing to active GHL application management.

## Test Run - 2026-08-10

Commands run:

```bash
node --env-file=.env scripts/sync-pipeline-to-notion.mjs --dry-run
node --env-file=.env scripts/sync-act-opportunities-to-notion.mjs --dry-run --include-undecided
```

Results:

- `sync-pipeline-to-notion.mjs --dry-run` would sync 1,724 grant rows and 77 foundation rows. This is too broad for production use and confirms the script should not be run until it upserts by stable `Supabase ID` and uses an explicit active/project filter.
- `sync-act-opportunities-to-notion.mjs --dry-run --include-undecided` would create 400 pages and update 0. This is also too broad for production use. It validates the concern that "include undecided" should not be used as a general sync path.
- Pilot GrantScope/GHL query returned the expected seven records:
  - `2a233fa7-4867-4288-a0d3-0ff1eb2d25e9` - Business Start-Up Grant - Aboriginal Investment NT, GHL Grants identified.
  - `478495a0-e727-44b4-a22b-541ca3816c66` - Catalysing Impact Stage 2, GHL Grants identified.
  - `ef5fe660-2e34-4101-bceb-5ead991bd4a8` - First Nations Clean Energy Advice Grants, no GHL ID yet.
  - `0f774f83-29ff-4f59-8b77-53c29040a214` - REAL Innovation Fund - Oonchiumpa Goods EOI, GrantScope says submitted/reviewing but GHL mirror says lost. This is a real reconciliation issue.
  - `5e52c7ef-a1b1-4319-b57c-421448dc3f27` - SEDI Capability Building Grant, GHL Grants identified.
  - `89e7a97d-6d2d-43d1-8d27-e1d690968702` - SEDI First Nations Social Enterprise Grants, GHL Grants identified.
  - `06e54747-406d-4d2b-a1c1-2753dbe450e6` - Snow Foundation - Oonchiumpa Operational Funding Year 1, GHL Grants identified.
- Focused Notion query found pilot rows, but stable IDs are not ready:
  - Most pilot Notion rows have blank `Supabase ID`.
  - First Nations Clean Energy Advice Grants has legacy `Supabase ID=LM37`, not the canonical UUID `ef5fe660-2e34-4101-bceb-5ead991bd4a8`.
  - SEDI appears as `Social Enterprise Capability Building Grants`; it does not distinguish general SEDI from SEDI First Nations.

Conclusion:

The alignment model passes the read-only test, but the current sync scripts fail the safety test for production use because they would create broad duplicate pages. The next implementation step is a narrow pilot backfill/upsert path keyed by canonical `grant_opportunities.id`.

## Pilot Backfill/Upsert - 2026-08-10

Implemented a narrow pilot script:

```bash
node --env-file=.env scripts/sync-grant-pipeline-pilot.mjs
node --env-file=.env scripts/sync-grant-pipeline-pilot.mjs --apply
```

Behavior:

- Uses a hardcoded seven-row pilot allowlist keyed by `grant_opportunities.id`.
- Queries Notion first by `Supabase ID`, then falls back to the known mapped Notion page ID.
- Updates canonical fields only: `Grant Name`, `Supabase ID`, `Funder`, `Amount`, `Deadline`, `Application URL`, `Key Requirements`, `Project`, and `Last Updated`.
- Preserves Notion-owned writing fields such as `Missing Documents`, `Readiness Score`, and `Notes`.
- Preserves the existing Notion `Stage` on updates unless run with `--sync-stage`; it only sets `Stage` for created pages.
- Does not create or update GHL opportunities.

Apply result:

- Updated 6 existing Notion tracker rows.
- Created 1 missing tracker row for `SEDI First Nations Social Enterprise Grants`.
- No skipped rows, conflicts, or failures.

Post-apply verification:

- Re-running the pilot in dry-run mode resolved all 7 rows by canonical `Supabase ID`.
- It would update 7 existing rows and create 0 new rows.
- No duplicate-ID conflicts were reported.

Pilot UUID coverage now in Notion:

- `2a233fa7-4867-4288-a0d3-0ff1eb2d25e9` - Business Start-Up Grant - Aboriginal Investment NT.
- `478495a0-e727-44b4-a22b-541ca3816c66` - Catalysing Impact - Stage 2 Matched Funding.
- `0f774f83-29ff-4f59-8b77-53c29040a214` - REAL Innovation Fund - Oonchiumpa Goods EOI.
- `06e54747-406d-4d2b-a1c1-2753dbe450e6` - Snow Foundation - Oonchiumpa Operational Funding Year 1.
- `ef5fe660-2e34-4101-bceb-5ead991bd4a8` - First Nations Clean Energy Advice Grants Round 1.
- `5e52c7ef-a1b1-4319-b57c-421448dc3f27` - SEDI Capability Building Grant.
- `89e7a97d-6d2d-43d1-8d27-e1d690968702` - SEDI First Nations Social Enterprise Grants.
