# GrantScope Signoff

## Branches
- Working branch: `codex/goods-civicgraph-signoff`
- Clean base branch: `main` now matches `origin/main`

## What "done enough to draft and use" means
- Grant semantics debt is zero:
  - `status_null_total = 0`
  - `application_status_null_total = 0`
  - `open_past_deadline_total = 0`
- Grant source identity debt is zero:
  - `blank_source_id_total = 0`
  - `canonical_mismatch_total = 0`
- The analytics pipeline health gate passes.
- Web typecheck passes.
- Grant engine contract tests pass.

## Repeatable closeout commands

Fast signoff:

```bash
cd /Users/benknight/Code/grantscope
pnpm signoff
```

Full signoff with data and agent reports:

```bash
cd /Users/benknight/Code/grantscope
pnpm signoff:full
```

Branch-only hygiene check:

```bash
cd /Users/benknight/Code/grantscope
pnpm branch:check
```

## What `pnpm signoff` checks
- current branch is not `main`
- local `main` matches `origin/main`
- worktree dirtiness is reported clearly
- `apps/web` TypeScript passes
- `@grantscope/engine` contract tests pass
- grant semantics health gate passes
- grant source identity health gate passes
- the analytics-only pipeline gate runs cleanly

## Manual smoke after signoff
Run the app, then open:

- [ops health](http://127.0.0.1:3003/ops/health)
  - Grant Semantics and Grant Source Identity both show zero active debt.
- [data health report](http://127.0.0.1:3003/reports/data-health)
  - The report matches the ops health counts.
- [mission control](http://127.0.0.1:3003/mission-control)
  - Agent registry loads and recent analytics runs are visible.
- [ops summary](http://127.0.0.1:3003/ops)
  - Ops summary loads without API errors.

## Reality check
- This repo still has a broad dirty worktree outside the grant-system closeout slice.
- `pnpm signoff` separates branch/base health from worktree noise so you can judge system readiness without pretending the whole repo is pristine.
- `pnpm signoff:full` includes broader data and agent-health reporting. Historical low-success agents and stale long-running non-grant agents still show there as operational context; they are not the closeout gate for the grant-system slice.
- If you want a truly clean packaging branch, stage only the closeout-related files and commit from the current working branch instead of trying to clean the whole repo at once.
