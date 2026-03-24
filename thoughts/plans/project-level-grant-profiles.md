# Plan: Project-Level Grant Profiles

## Problem

ACT has 7 projects (Empathy Ledger, JusticeHub, Goods on Country, Black Cockatoo Valley, The Harvest, ACT Farm, Art) each with radically different grant needs. Today there is **one embedding for the entire org** — a blended vector that mashes together "IoT laundry fleet" with "indigenous data sovereignty" with "regenerative agriculture". This means:

1. A WASH/logistics grant perfect for Goods on Country gets a mediocre score because the org embedding is diluted by 6 other projects
2. Feedback on one project's matches poisons recommendations for other projects (voting down a health-research grant penalises `indigenous` and `community` categories across ALL projects)
3. The matches page shows one undifferentiated list — no way to say "show me grants for The Harvest"
4. Agents (Telegram bot, Notion workers) can't answer "what grants should Goods on Country apply for?"

## Current State

**`org_profiles` table** already stores projects as JSON:
```json
[
  {"code": "ACT-HV", "name": "The Harvest Witta", "domains": ["regenerative agriculture", "community hub", ...], "geographic": "Witta, Sunshine Coast Hinterland, QLD", "description": "..."},
  {"code": "ACT-GD", "name": "Goods on Country", "domains": ["social enterprise", "community assets", ...], "description": "..."},
  ...
]
```

Each project already has `name`, `description`, `domains`, and `geographic` — exactly what's needed to generate a project-specific embedding.

**`grant_feedback` table** has `org_profile_id` column but no project-level attribution.

**`match_grants_for_org` function** accepts any embedding vector — it doesn't care where it comes from. No changes needed.

**`get_user_feedback_signals` function** (just built) groups by user — needs a project dimension.

## Design

### Approach: `project_profiles` table (not JSON column)

Store project embeddings as first-class rows rather than nested JSON. This gives us:
- Each project gets its own embedding vector (pgvector index works per-row)
- Feedback can reference a project_profile_id
- Standard Supabase queries/RPCs work directly
- Agents can query by project code

### Schema

```sql
CREATE TABLE project_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  project_code text NOT NULL,          -- e.g. 'ACT-HV', 'ACT-GD'
  name text NOT NULL,                   -- 'The Harvest Witta'
  description text,
  domains text[] DEFAULT '{}',
  geographic_focus text[] DEFAULT '{}',
  embedding vector(1536),               -- project-specific embedding
  embedding_text text,                  -- what was embedded
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_profile_id, project_code)
);

-- Index for vector similarity
CREATE INDEX project_profiles_embedding_idx ON project_profiles
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

### Add project_profile_id to grant_feedback

```sql
ALTER TABLE grant_feedback
  ADD COLUMN project_profile_id uuid REFERENCES project_profiles(id);
```

This is nullable — existing feedback stays org-level, new feedback can optionally be project-scoped.

## Changes

### Phase 1: Schema + Embedding Generation

**New table:** `project_profiles` (schema above)

**New script:** `scripts/generate-project-embeddings.mjs`
- Reads `org_profiles.projects` JSON for a given org
- For each project, builds embedding text from: `{name}\n{description}\nFocus areas: {domains.join(', ')}\nGeography: {geographic}`
- Calls OpenAI `text-embedding-3-small` (same model as org embeddings)
- Upserts into `project_profiles`
- Run once to seed, then auto-runs on profile save

**Modify:** `PUT /api/profile/route.ts`
- After saving org profile, also generate project embeddings for any projects in the `projects` JSON
- Upsert into `project_profiles` alongside the org embedding

| File | Action |
|------|--------|
| SQL migration | **NEW** `project_profiles` table + index + FK on `grant_feedback` |
| `scripts/generate-project-embeddings.mjs` | **NEW** seed script for existing data |
| `apps/web/src/app/api/profile/route.ts` | **MODIFY** generate project embeddings on save |

### Phase 2: Project-Scoped Matching API

**Modify:** `GET /api/profile/matches/route.ts`
- Accept optional `?project=ACT-GD` query param
- If set: use that project's embedding instead of org embedding
- If not set: use org embedding (backward compatible)
- Feedback signals also scoped: `get_user_feedback_signals` gets optional `p_project_profile_id` param

**New SQL function:** `get_user_feedback_signals` v2
- Add optional `p_project_profile_id uuid DEFAULT NULL` parameter
- When set, only count feedback for that project
- When null, count all feedback (current behavior)

| File | Action |
|------|--------|
| `apps/web/src/app/api/profile/matches/route.ts` | **MODIFY** accept `?project=` param |
| SQL function | **MODIFY** `get_user_feedback_signals` with project scope |

### Phase 3: UI — Project Filter on Matches Page

**Modify:** `matches-client.tsx`
- Add project selector dropdown above the results list
- Options: "All Projects" (default) + one per project from the org profile
- Selecting a project re-fetches with `?project=ACT-GD`
- Learning banner shows project-scoped stats ("12 grants rated for Goods on Country")

**Modify:** `thumbs-vote.tsx`
- Accept optional `projectCode` prop
- Pass it to feedback API so votes are attributed to the active project
- When voting from project-filtered view, feedback is project-scoped

**Modify:** `POST /api/grants/[id]/feedback/route.ts`
- Accept optional `project_code` in body
- Look up `project_profile_id` from `project_profiles` and store it

| File | Action |
|------|--------|
| `apps/web/src/app/profile/matches/matches-client.tsx` | **MODIFY** add project selector |
| `apps/web/src/app/components/thumbs-vote.tsx` | **MODIFY** accept + pass projectCode |
| `apps/web/src/app/api/grants/[id]/feedback/route.ts` | **MODIFY** store project_profile_id |

### Phase 4: Fix Category Penalty (Friendly Fire)

Now that feedback is project-scoped, fix the category penalty logic:

**Modify:** `get_user_feedback_signals` function
- Instead of penalizing ALL categories from wrong-sector grants, only penalize categories that do NOT appear in the project's own `domains`
- Example: grant `[education, indigenous]` voted "Wrong sector" for ACT-GD (Goods on Country)
  - ACT-GD domains include "Indigenous enterprise" → `indigenous` is NOT penalized
  - `education` IS penalized (not in ACT-GD's domains)
- This requires joining against `project_profiles.domains` in the CTE

| File | Action |
|------|--------|
| SQL function | **MODIFY** category penalty with domain-aware filtering |

### Phase 5: Agent Integration (ACT Ecosystem)

**Telegram bot** — new agent tool: `search_grants_for_project`
- Input: project_code (e.g. "ACT-GD"), optional min_score
- Uses project embedding + `match_grants_for_org` + `get_user_feedback_signals`
- Returns top 5 matches with scores and deadlines
- "What grants should Goods on Country apply for?" → direct answer

**Notion Workers** — enhance `grant-deadlines` worker:
- Currently shows all tracked grants
- Add: show top matches per project with scores
- "Upcoming for The Harvest: Snow Foundation (82% fit, closes Apr 30)"

**Command Center** — enhance pipeline page:
- Add "Matched Grants" column to project pipeline view
- Shows count of high-fit matches per project (>75%)
- Click-through to GrantScope matches filtered by project

| File | Action |
|------|--------|
| ACT infra: `src/lib/agent-tools.ts` | **MODIFY** add `search_grants_for_project` tool |
| ACT infra: `packages/notion-workers/src/grant-deadlines.ts` | **MODIFY** add project match scores |
| ACT infra: command center pipeline page | **MODIFY** add matched grants column |

## Verification

### Phase 1
- `SELECT COUNT(*) FROM project_profiles` → 7 rows (one per ACT project)
- Each has a non-null embedding
- Saving profile via UI regenerates project embeddings

### Phase 2
- `/api/profile/matches?project=ACT-GD` returns Goods on Country-relevant grants
- `/api/profile/matches?project=ACT-EL` returns Empathy Ledger-relevant grants
- `/api/profile/matches` (no param) returns current blended results

### Phase 3
- Project dropdown appears on matches page
- Selecting "Goods on Country" shows different grants than "Empathy Ledger"
- Thumbs votes are attributed to the selected project
- Learning banner shows per-project stats

### Phase 4
- After 3+ "Wrong sector" votes on ACT-GD, `indigenous` is NOT penalized (it's in GD's domains)
- `education` IS penalized (not in GD's domains)

### Phase 5
- Telegram: "What grants match Goods on Country?" → returns project-specific matches
- Notion: grant deadlines worker shows per-project match scores
- Command Center: pipeline shows matched grant count per project

## Sequencing

Phases 1-3 are the core value — project-scoped matching + UI.
Phase 4 fixes the friendly-fire bug (depends on phase 2 for project context).
Phase 5 is the ecosystem integration (depends on phases 1-2 for project embeddings + API).

Estimate: Phases 1-3 in one session, Phase 4 as a follow-up, Phase 5 across multiple sessions touching 3 repos.

## Open Questions

1. **Should project embeddings auto-regenerate on profile save, or only on explicit action?** Auto is simpler but means 7 OpenAI API calls per profile save. Recommend: auto, but debounce (only regenerate projects whose description/domains changed).

2. **Should the org-level blended embedding be kept?** Yes — it's the "I don't know which project" fallback and the default for new users. It also catches cross-cutting grants that don't fit any single project.

3. **What about orgs that aren't ACT?** The `project_profiles` table is generic — any org with a `projects` JSON array gets the same benefit. JusticeHub and Palm Island Community Company profiles could also define sub-projects.

4. **Feedback migration:** Existing 28 votes have no project attribution. Options: (a) leave as org-level, (b) retroactively assign based on grant categories vs project domains. Recommend (a) — 28 votes is small, fresh project-scoped votes will quickly outweigh them.
