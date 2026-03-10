# Plan: Agentic Home Dashboard

## Context
The `/home` page is currently a static server component showing pipeline counts, deadlines, and quick actions. We're transforming it into a world-class agentic dashboard inspired by Notion, Linear, and Perplexity — with progressive disclosure (click-to-expand everything), AI grant matches with confidence badges, a morning briefing showing agent activity, and contextual tips. The goal: make GrantScope feel alive and easy.

## Architecture

Split into server shell + client component (same pattern as tracker and mission-control):

```
home/page.tsx          → thin server component (auth + initial data)
home/home-client.tsx   → interactive client (expand/collapse, lazy fetch)
home/types.ts          → shared interfaces
api/briefing/route.ts  → lightweight agent activity endpoint (NEW)
```

## Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/app/home/types.ts` | NEW | Shared interfaces |
| `apps/web/src/app/api/briefing/route.ts` | NEW | Agent briefing API (24h activity grouped by agent) |
| `apps/web/src/app/home/page.tsx` | REWRITE | Thin server shell → passes data as props |
| `apps/web/src/app/home/home-client.tsx` | NEW | Full interactive dashboard |

## Sections in Order

### 1. Header
`"Home"` + `"Welcome back, {name}"` — unchanged.

### 2. Onboarding Banner (conditional)
Same 3-step banner as current. **Enhancement:** Add contextual tips under each incomplete step:
- Profile: "Tip: Adding focus areas helps our AI match you with relevant grants"
- Grants: "Tip: Start by browsing grants or check your AI matches below"
- Alerts: "Tip: Alerts notify you when new grants match your criteria"

### 3. Morning Briefing (NEW — lazy-loaded)
Section header: yellow accent bar + "While You Were Away" + "(24h)" badge. Collapsible.

Fetched from `GET /api/briefing?hours=24` on mount. Groups `agent_runs` by agent_name.

Each agent row: `[status dot] Agent Name     +12 new  +3 updated  2h ago  [chevron]`
- Status dot: green=success, yellow=partial, red=failed, blue+pulse=running
- Click to expand: individual runs table (id, status, items, duration, time)

Empty state: "All quiet — no agent activity in the last 24 hours"

### 4. AI Grant Matches (NEW — lazy-loaded)
Section header: red accent bar + "AI Grant Matches" + "Top 5" badge.

Fetched from `GET /api/grants/match` on mount (only if profile exists).

Each match card (collapsed):
```
[87% GOOD] Grant Name                    $50K-$200K  Closes 15d  [chevron]
           Provider Name
```

Confidence badge colors:
- 90-100: green "STRONG"
- 70-89: blue "GOOD"
- 50-69: yellow "FAIR"
- <50: gray "WEAK"

Each match card (expanded): shows match_signals as pills + [Track Grant] + [View Details →]

Track button → POST `/api/tracker/{grantId}` with `{stage: 'discovered'}`, swaps to "✓ Tracked".

### 5. Grant Pipeline (ENHANCED)
Same 6-cell stage grid. **Enhancement:** Click any cell to expand inline — shows up to 5 grants in that stage below the grid. Data already in memory (no fetch). "View all in Tracker →" link. Selected cell gets `ring-2 ring-bauhaus-red`.

### 6. Upcoming Deadlines (ENHANCED)
Same list. **Enhancement:** deadlines ≤3 days get `animate-pulse` on the day badge.

### 7. Foundation Tracker (ENHANCED)
Same 4-cell grid. **Enhancement:** Same click-to-expand pattern as pipeline. Shows top 3 foundations per stage.

### 8. Quick Actions
Unchanged 4-button grid.

## API: `GET /api/briefing`

```
Query params: ?hours=24 (default)
Auth: required (createSupabaseServer)
Response: { groups: AgentBriefingGroup[], period_hours: number }
```

Groups `agent_runs` where `completed_at >= now - hours`, ordered by latest. Each group has: agent_name, runs[], total_new, total_updated, latest_status, latest_at.

This is ~100x lighter than `/api/mission-control` which queries 20+ tables.

## Data Flow

| Data | Where | When |
|------|-------|------|
| Profile, grants, foundations, alerts | Server (SSR) | Page load |
| Grant matches (top 5) | Client `/api/grants/match` | On mount, if profile |
| Agent briefing | Client `/api/briefing` | On mount |
| Pipeline/foundation expand | No fetch | Click (filter in-memory data) |
| Track grant | Client POST `/api/tracker/{id}` | Button click |

## Patterns to Reuse

- **Expand/collapse:** `expandedX: string | null` pattern from alerts page
- **Chevron rotation:** `transition-transform rotate-180` from foundation tracker
- **Card hover:** `hover:-translate-y-0.5 bauhaus-shadow-sm`
- **Status badges:** `text-[10px] font-black uppercase tracking-wider` from mission-control
- **Lazy fetch:** useEffect + fetch pattern from tracker-client
- **Section headers:** `w-2 h-6 bg-{color}` accent bar (already in current home page)

## Verification
```bash
cd apps/web && npx tsc --noEmit
```
Then test on localhost:3000:
- `/home` loads with all sections
- Morning Briefing shows agent groups (or empty state)
- AI Matches shows scored grants with confidence badges
- Click any match → expands to show signals + Track button
- Click pipeline stage → expands to show grants
- Click foundation stage → expands to show foundations
- Onboarding tips appear for incomplete steps
- ≤3 day deadlines pulse
