# Goods Signoff

## Branches
- GrantScope: `codex/goods-civicgraph-signoff`
- Goods v2: `codex/goods-qbe-signoff`

## Scoped file set

### GrantScope
- `/Users/benknight/Code/grantscope/apps/web/src/app/org/[slug]/[projectSlug]/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/org/_components/project-decision-surfaces.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/org/_components/project-foundations-client.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/lib/services/org-dashboard-service.ts`
- `/Users/benknight/Code/grantscope/apps/web/src/app/api/org/[orgProfileId]/projects/[projectId]/foundations/route.ts`
- `/Users/benknight/Code/grantscope/scripts/seed-goods-decision-profile.mjs`
- `/Users/benknight/Code/grantscope/scripts/seed-goods-foundation-contacts.mjs`

### Goods v2
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/admin/qbe-program/page.tsx`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/admin/ops/page.tsx`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/dashboard/feedback/page.tsx`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/api/admin/targets/push-outreach/route.ts`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/api/admin/targets/intake-status/route.ts`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/api/admin/targets/backfill-identities/route.ts`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/api/admin/targets/resolve-identity/route.ts`
- `/Users/benknight/Code/Goods Asset Register/v2/src/app/api/admin/targets/review-identity/route.ts`
- `/Users/benknight/Code/Goods Asset Register/v2/src/proxy.ts`

## What “done enough to draft and use” means
- The Goods project page is a compact working surface, not a long report.
- Foundations, capital, procurement, and queue lanes are visible near the top.
- The foundation board is seeded and no longer reads as empty.
- Decision context from the Goods wiki is compiled into the page instead of living only in docs.
- Goods v2 has a working discovery-intake to identity-review path for outreach targets.
- Build noise is gone from the old GHL token and middleware issues.

## Repeatable signoff check
Run:

```bash
/Users/benknight/Code/grantscope/scripts/goods-signoff-check.sh
```

This covers:
- GrantScope typecheck
- Goods v2 build
- manual smoke-test checklist for the two live surfaces

## Reality check
- The working trees are **not globally clean**. Both repos already had substantial unrelated changes before this closure pass.
- The branches above isolate this closure work from `main`, but they do **not** magically separate unrelated dirty files already present in each worktree.
- The practical closure move is:
  - stop adding new features
  - run the signoff check
  - smoke-test the routes in the browser
  - then stage only the scoped file set above

## Staging advice
When you are ready to package this work, stage only the scoped file set listed above rather than the full repo status.
