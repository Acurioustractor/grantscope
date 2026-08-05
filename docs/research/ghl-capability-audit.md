# GHL capability audit — People warmth and Obligations

Resolves issue #144 (child of map #143). Question: what can GoHighLevel actually hold for (a) person-level warmth/next-actions and (b) post-Won Obligations, and which constraints force the system-of-record decision.

Sources: GHL marketplace API docs (v2, `services.leadconnectorhq.com`, `Version: 2021-07-28`), GHL support articles, and first-hand evidence from this repo's working scripts (`scripts/seed-goods-grants-ghl.mjs`, `scripts/reconcile-foundations-ghl.mjs`, `scripts/cleanup-goods-supporter-journey.mjs`). Confidence labels: **verified** (proven by our own scripts or explicit docs), **inferred**, **unverified**.

## (a) Person-level warmth

Three viable homes on the contact:

1. **Tags** (current approach — verified working). The `goods-hot / goods-warm / goods-steady / goods-cooling / goods-cold` vocabulary plus `qbe-tier-1`, `instrument:*`, `engagement:personal-vip`, `needs-followup` already lives on contacts and is read back by `reconcile-foundations-ghl.mjs` into `org_project_foundations.ghl_tags`. Tags are free-form strings: cheap to write, filterable in UI smart lists and workflows, but nothing enforces mutual exclusivity — a contact can be both `goods-hot` and `goods-cold` and only convention prevents it.
2. **Contact custom field** (SINGLE_OPTIONS dropdown). Verified pattern: we already create and PUT custom fields via `POST/PUT /locations/{loc}/customFields` and write them on records as `customFields:[{id, field_value}]` (proven on the opportunity model with `capital_status`, `funding_type`; contact model uses the same API surface — inferred for contacts specifically but low risk). A dropdown enforces one-value warmth and is workflow-triggerable on change. Migration cost: backfill from tags.
3. **Score/number field**. Same mechanism, numeric. GHL also has native "engagement score" configuration in UI (unverified via API).

**Recommendation-shaped finding:** tags are already the de facto store and are synced; switching to a single-select custom field buys integrity (one warmth value) at the cost of a migration. Either way GHL can hold person warmth fine — no capability constraint forces warmth out of GHL.

## (a) Next-actions: contact Tasks API

- `POST /contacts/:contactId/tasks` with `title`, `body`, `dueDate`, `assignedTo`, `completed` — plus GET/PUT/DELETE per task and `GET /contacts/:contactId/tasks` to list a contact's tasks. Docs: https://marketplace.gohighlevel.com/docs/ghl/contacts/create-task/index.html (verified fields against doc page).
- **Constraint (the big one): tasks are contact-scoped in the API.** There is no documented location-wide `tasks/search` or query-by-due-date endpoint in the public v2 docs (searched; only per-contact list + task webhooks like `TaskComplete` exist — https://marketplace.gohighlevel.com/docs/webhook/TaskComplete/index.html). Building a "what's due this week across everyone" desk view from the API means N calls (one per contact) or mirroring tasks into Supabase on write/webhook. GHL's own UI has a task manager, but the API doesn't expose an equivalent cross-contact query. **Unverified:** whether a newer versioned endpoint adds this; nothing found in docs or community as of 2026-08.
- Tasks have no custom fields, no stages, no monetary value, and completion is a boolean — fine for "call Sarah by Friday", too thin for structured obligations.

## (b) Obligation candidate homes

An Obligation = a post-Won commitment (acquittal report due, milestone delivery, invoice tranche, renewal window).

### Option 1: second pipeline of opportunities
- Opportunities support: multiple pipelines per location, multiple opportunities per contact (sub-account setting "Allow Multiple Opportunities per Contact"; support doc https://help.gohighlevel.com/support/solutions/articles/48001066144), monetary value, stages, status (open/won/lost/abandoned), and **opportunity custom fields via API** — verified first-hand: `seed-goods-grants-ghl.mjs` creates opps with 10 custom fields including dates and dropdowns.
- **Constraint (verified, in memory + deferred-follow-ups list): the API CANNOT create pipelines.** A "Goods — Obligations" board is a one-time UI step by Ben; stages likewise UI-managed. Acceptable for a stable lifecycle (e.g. Due → In prep → Submitted → Acquitted), painful if obligation types need distinct lifecycles.
- **Constraint (verified first-hand):** the opportunity search endpoint does NOT hydrate custom fields — you must `GET /opportunities/{id}` per opp. Any dashboard over obligations pays N+1 reads or caches in Supabase.
- Every opportunity requires a `contactId` (422 otherwise — verified). Obligations to a funder org map naturally to the funder contact; internal obligations would need a placeholder contact (same pattern as the "GrantScope Triage" contact `uAsIUWBHez3DzVex8rtm`).

### Option 2: tasks
Too thin (no value, no stages, no custom fields, no cross-contact due-date query). Good as the *reminder surface* generated from obligations, not as the store.

### Option 3: custom objects
- Since ~Oct 2025 custom objects are available **on all plans** (Starter/Unlimited/Pro), 10 objects per location, unlimited records: https://help.gohighlevel.com/support/solutions/articles/155000006631-custom-objects-in-all-plans-higher-limit
- API exists and covers schema creation, record CRUD, search, and associations (relations to contacts/opportunities): https://marketplace.gohighlevel.com/docs/ghl/objects/custom-objects-api/index.html
- **Caveats:** API is newer and less battle-tested than contacts/opportunities; workflow-trigger and UI (board/list view) support for custom objects is materially weaker than pipelines — records live in a generic list, no kanban, weaker smart-list filtering (inferred from docs + support articles; not exercised first-hand). We have zero existing code against it.

## Constraints that force the decision

1. **No API pipeline creation** — any pipeline-based Obligation home needs a Tier-2/3 manual UI setup step and cannot be provisioned per-project programmatically. If Obligations should be schema-defined and reproducible from code, that pushes toward custom objects or Supabase.
2. **No cross-contact task query by due date** — GHL tasks cannot serve a "what's due" desk view via API. If next-actions must drive a CivicGraph UI, the queryable copy has to live in Supabase (GHL tasks as mirror/reminder at most).
3. **Search doesn't hydrate opportunity custom fields** — obligation dashboards over a pipeline pay per-record GETs; practical at Goods scale (tens), bad at hundreds.
4. **Custom objects: API-complete on paper, immature in workflows/UI, unused by us** — choosing them means being an early adopter with no kanban board for Ben to work in.
5. **Three-pipeline doctrine (decided 2026-08-04):** GHL is system of record for *relationship state*. Warmth is relationship state → GHL holds it (tags today, single-select field if integrity matters). Obligations are closer to *production/delivery state*; nothing in GHL's model fits them without contortion, which is an argument for Supabase (or Notion production rooms) as Obligation SoR with a GHL pipeline or tasks as the human-facing reminder surface only.

**Net:** GHL comfortably holds Person warmth (no constraint forces it out). For Obligations, GHL *can* hold them in a manually-created second pipeline with custom fields, but constraints 1–3 mean any programmatic/desk-view use ends up mirrored in Supabase anyway — so the honest options are "GHL pipeline as SoR, Supabase cache" (human-first) vs "Supabase as SoR, GHL tasks as reminders" (system-first).
