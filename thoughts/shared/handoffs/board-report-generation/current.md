# Board Report Generation Implementation

## Task
Build the Board Report Generation feature for CivicGraph. This generates a printable board-ready report for an organisation summarizing their grant landscape, key relationships, and funding data.

## Checkpoints

**Task:** Build Board Report Generation feature (API + UI)
**Started:** 2026-03-18T09:36:00Z
**Last Updated:** 2026-03-18T09:36:00Z

### Phase Status
- Phase 1 (Tests Written): ✓ VALIDATED (7 tests written, all failing as expected - route doesn't exist)
- Phase 2 (API Implementation): ✓ VALIDATED (all 7 tests passing)
- Phase 3 (Page Implementation): ✓ VALIDATED (server component created)
- Phase 4 (Client Component): ✓ VALIDATED (client component with search, report display, print functionality)
- Phase 5 (Type Check): ✓ VALIDATED (no production code errors)

### Validation State
```json
{
  "test_count": 7,
  "tests_passing": 7,
  "tests_failing": 0,
  "files_created": [
    "tests/unit/api/board-report/route.test.ts",
    "apps/web/src/app/api/board-report/route.ts",
    "apps/web/src/app/home/board-report/page.tsx",
    "apps/web/src/app/home/board-report/board-report-client.tsx"
  ],
  "last_test_command": "cd apps/web && npx vitest run tests/unit/api/board-report/ --reporter=verbose",
  "last_test_exit_code": 0,
  "type_check": "Passed - no production code errors"
}
```

### Resume Context
- Current focus: Implementation complete
- Next action: None - ready for manual testing
- Blockers: None

## Implementation Plan

### Phase 2: API Route
1. Create `apps/web/src/app/api/board-report/route.ts`
2. Implement POST handler with:
   - Auth via `requireModule('research')`
   - Accept `entity_gs_id` or `abn` for entity identification
   - Query entity details from `gs_entities`
   - Query relationships (outbound and inbound separately to avoid timeout)
   - Query justice_funding by ABN
   - Query alma_interventions by entity UUID
   - Return JSON with all sections

### Phase 3: Server Page
1. Create `apps/web/src/app/home/board-report/page.tsx`
2. Auth check and redirect
3. Render client component

### Phase 4: Client Component
1. Create `apps/web/src/app/home/board-report/board-report-client.tsx`
2. Entity search UI (calls /api/data?type=entities&q=...)
3. Report generation and display
4. Print functionality with @media print CSS
5. Bauhaus design system styling

### Phase 5: Type Check
1. Run `cd apps/web && npx tsc --noEmit`
2. Fix any type errors
