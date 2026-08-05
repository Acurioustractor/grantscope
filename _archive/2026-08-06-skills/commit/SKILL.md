---
description: GrantScope-aware git commits — auto-groups migrations, scripts, and app code
---

# Commit Changes (GrantScope)

You are tasked with creating git commits for GrantScope. This project has three distinct change categories that should be committed separately when mixed.

## Step 1: Analyze Changes

Run `git status` and `git diff --stat` to see all changes. Categorize each file:

| Category | Path Pattern | Commit Prefix |
|----------|-------------|---------------|
| **migrations** | `supabase/migrations/*.sql` | `migrate:` |
| **scripts** | `scripts/*.mjs`, `scripts/**/*.mjs` | `data:` or `feat:` |
| **app** | `apps/web/**` | `feat:`, `fix:`, or `ui:` |
| **config** | `.claude/`, `CLAUDE.md`, `.gitignore`, `package.json` | `chore:` |
| **docs** | `thoughts/`, `*.md` (not CLAUDE.md) | `docs:` |

## Step 2: Group Into Logical Commits

Rules:
- **Migrations go in their own commit** — they're deployed separately and need clear git history
- **Scripts that populate data from a migration** can be bundled with that migration
- **App changes that depend on a migration** should come AFTER the migration commit
- **Config/docs** can be bundled together or with related changes
- If everything is one coherent feature, one commit is fine — don't over-split

## Step 3: Present Plan

Show the user:
```
Commit 1: migrate: add remoteness column to gs_entities
  - supabase/migrations/20260309_remoteness.sql

Commit 2: data: backfill remoteness from ABS correspondence
  - scripts/backfill-remoteness-from-abs.mjs
  - data/abs/CG_POSTCODE_2022_RA_2021.csv

Commit 3: feat: show remoteness on entity dossier page
  - apps/web/src/app/entities/[gsId]/page.tsx
  - apps/web/src/app/api/entities/[gsId]/place/route.ts
```

Ask: "I plan to create N commit(s). Shall I proceed?"

## Step 4: Execute

- Use `git add` with specific files (never `-A` or `.`)
- Create commits with planned messages
- Show result with `git log --oneline -n N`

## Step 5: Generate Reasoning

After each commit, run:
```bash
bash .claude/scripts/generate-reasoning.sh <commit-hash> "<commit-message>"
```

## Important
- **NEVER add co-author information or Claude attribution**
- Commits should be authored solely by the user
- Do not include any "Generated with Claude" or "Co-Authored-By" lines
- Write commit messages as if the user wrote them
