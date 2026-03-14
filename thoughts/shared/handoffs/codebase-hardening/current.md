---
date: 2026-03-14T21:23:00Z
session_name: codebase-hardening
branch: codex/fix-trust-consistency
status: active
---

# Work Stream: codebase-hardening

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-14T21:34:00Z
**Goal:** Full codebase hardening — security, tests, observability, refactoring, delight features. Done when all 5 phases complete.
**Branch:** codex/fix-trust-consistency
**Test:** `cd apps/web && pnpm test`

### Now
[->] Phase 3: Refactor god files (tender-intelligence 8K, procurement-workspace 3K, goods-workspace-data 3K)

### This Session
- [x] CEO-mode codebase review (SCOPE EXPANSION) — 10 sections, all issues catalogued
- [x] Phase 1a: Lock /api/data/export (requireModule('research')) + rate-limit headers on /api/data
- [x] Phase 1b: Fix 7 destructive scripts with --apply flags (agil, ndis, bocsar, rogs, ctg, buyability, niaa)
- [x] Phase 1c: Set up vitest + Playwright (46 passing tests, 12 todo for api-auth)
- [x] Phase 1d: GitHub Actions CI (.github/workflows/ci.yml — typecheck + unit + e2e)
- [x] Phase 1e: Sentry integration (client/server/edge configs, global-error.tsx, next.config.ts wrapped)
- [x] Phase 2a: Extract EntityService (9 methods: findByGsId, findByAbn, findByAbns, findByPostcode, search, list, getInternalId, findLobbyConnections, count)
- [x] Phase 2b: Extract ContractService (4 methods: findBySupplierAbn, findBySupplierAbns, aggregateByAbns, count)
- [x] Phase 2c: Extract FoundationService (5 methods) + GrantService (4 methods) + barrel export
- [x] Phase 2d: Refactored 4 key routes to use services (entities/[gsId], v1/exposure, global-search, places/[postcode])
- [x] Phase 2e: Filled in all 12 api-auth todo tests + wrote 18 service tests (76 total, 0 todo)

### Next
- [ ] Phase 3: Refactor god files (tender-intelligence 8K, procurement-workspace 3K, goods-workspace-data 3K, funding-workspace 2K)
- [ ] Phase 4a: API rate limiting enforcement (sliding window counter)
- [ ] Phase 4b: Agent orchestrator circuit breaker
- [ ] Phase 4c: Integration + E2E tests for critical paths
- [ ] Phase 4d: API documentation (OpenAPI for v1/exposure)
- [ ] Phase 5: Delight features (entity hover cards, data freshness badges, Cmd+K search, sparklines, export button)

### Decisions
- Review mode: SCOPE EXPANSION — user wants 10x version
- God file refactoring: approved for this cycle (not deferred)
- Full test suite: vitest + Playwright in parallel (not sequential)
- Service layer: extract 4 core services (Entity, Contract, Foundation, Grant)
- Service pattern: pure functions (not classes), accept SupabaseClient, typed return values
- Security: lock export + rate limit data API (keep /api/data public with headers, /api/data/export requires auth)
- Sentry: @sentry/nextjs with withSentryConfig wrapper, DSN via env var
- CI: GitHub Actions with typecheck → unit tests → E2E (E2E needs Supabase secrets)
- Scripts: all destructive ops require --apply flag, dry-run by default

### Open Questions
- UNCONFIRMED: Playwright port — agent said 3003 but needs verification for CI
- UNCONFIRMED: Whether vitest config handles the @/ path alias correctly in all cases
- UNCONFIRMED: Sentry withSentryConfig may need `disableServerWebpackPlugin: true` for Turbopack compatibility

### Workflow State
pattern: phased-implementation
phase: 3
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Full codebase hardening — security, tests, observability, refactoring, delight"
- resource_allocation: aggressive

#### Unknowns
- turbopack_sentry_compat: UNKNOWN — may need testing
- playwright_ci_secrets: UNKNOWN — needs Supabase env vars in GitHub Secrets

#### Last Failure
(none)

### Checkpoints
**Agent:** main session
**Task:** 5-phase codebase hardening
**Started:** 2026-03-14T20:30:00Z
**Last Updated:** 2026-03-14T21:34:00Z

#### Phase Status
- Phase 1 (Foundation — security, tests, CI, Sentry): ✓ VALIDATED (46 tests passing, tsc clean)
- Phase 2 (Architecture — services + tests): ✓ VALIDATED (76 tests passing, 0 todo, tsc clean)
- Phase 3 (Refactoring — god files): → NEXT
- Phase 4 (Hardening — rate limits, circuit breaker, API docs): ○ PENDING
- Phase 5 (Delight — hover cards, freshness, Cmd+K, sparklines, export): ○ PENDING

#### Validation State
```json
{
  "test_count": 76,
  "tests_passing": 76,
  "tests_todo": 0,
  "files_modified": [
    "apps/web/src/lib/services/entity-service.ts",
    "apps/web/src/lib/services/contract-service.ts",
    "apps/web/src/lib/services/foundation-service.ts",
    "apps/web/src/lib/services/grant-service.ts",
    "apps/web/src/lib/services/index.ts",
    "apps/web/src/app/api/entities/[gsId]/route.ts",
    "apps/web/src/app/api/v1/exposure/route.ts",
    "apps/web/src/app/api/global-search/route.ts",
    "apps/web/src/app/api/places/[postcode]/route.ts",
    "apps/web/tests/unit/lib/api-auth.test.ts",
    "apps/web/tests/unit/lib/services/entity-service.test.ts",
    "apps/web/tests/unit/lib/services/contract-service.test.ts"
  ],
  "last_test_command": "cd apps/web && pnpm test",
  "last_test_exit_code": 0
}
```

#### Resume Context
- Current focus: Phase 2 complete. Ready for Phase 3 (god file refactoring).
- Next action: Decompose tender-intelligence/page.tsx (8,113 lines) into smaller components
- Blockers: (none)
- Services created at: apps/web/src/lib/services/ (4 services + barrel export)
- Remaining routes to refactor: ~30+ routes still use direct Supabase queries (low priority, services are available)

---

## Context

### Codebase Profile (from CEO review)
- 87 page routes, 107 API endpoints, 73 registered agents
- 296 TypeScript files, ~80K lines
- 90 DB migrations, 18+ tables, 8+ materialized views
- Stack: Next.js 15, Tailwind 4, Supabase, Vercel

### Critical Issues Found (CEO Review)
1. **ZERO tests** → FIXED (Phase 1c: vitest + 46 tests)
2. **Unauthenticated /api/data/export** → FIXED (Phase 1a: requireModule('research'))
3. **8K-line god files** → Phase 3
4. **7 unguarded DELETE scripts** → FIXED (Phase 1b: --apply flags)
5. **No error tracking** → FIXED (Phase 1e: Sentry)
6. **No CI** → FIXED (Phase 1d: GitHub Actions)
7. **No service layer** → Phase 2
8. **No rate limiting** → Phase 4a
9. **No circuit breaker** → Phase 4b

### Key Files Modified
- `apps/web/src/app/api/data/export/route.ts` — Added requireModule('research')
- `apps/web/src/app/api/data/route.ts` — Added withPublicHeaders() for rate-limit/cache headers
- `apps/web/next.config.ts` — Wrapped with withSentryConfig
- `.github/workflows/ci.yml` — New CI pipeline (typecheck + unit + e2e)
- 7 scripts — Added --apply dry-run guards

### Architecture Notes
- Auth pattern: discriminated union (AuthSuccess | AuthFailure) in api-auth.ts — extend this pattern
- Subscription: declarative tier/module matrix in subscription.ts — 80 lines, perfect
- Anti-pattern: tender-intelligence/page.tsx (8,113 lines) — needs decomposition in Phase 3
- Anti-pattern: goods-workspace-data.ts (2,891 lines) — business logic in "data" file
