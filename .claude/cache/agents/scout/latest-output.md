# Project Configuration Audit: GrantScope
Generated: 2026-03-10

## Summary

GrantScope is Australia's open funding intelligence platform with a monorepo structure, 92K+ entity graph, 50+ data pipeline scripts, and extensive Claude Code automation configured. The project has NO `CLAUDE.md` file in the root, relying instead on local permissions and a single skill (superdesign). There are 8 unpushed commits and several untracked files including new migrations and data enrichment scripts.

---

## 1. Project Documentation

### Root Documentation Files
- **README.md:** ✓ PRESENT - Comprehensive 218-line overview of the platform
  - Location: `/Users/benknight/Code/grantscope/README.md`
  - Content: Architecture, entity graph (92K entities), 15 analytical reports, flagship finding (140 donor-contractors with $4.7B contracts)
  - Tech stack: Next.js 14, Supabase PostgreSQL, multi-provider LLM enrichment

- **CLAUDE.md:** ✗ NOT FOUND - No project-specific Claude instructions in root

---

## 2. Claude Code Configuration

### Settings File
**Location:** `/Users/benknight/Code/grantscope/.claude/settings.local.json`

**Configuration Type:** Permissions-only (no hooks detected)

### Permissions (44 allow rules)

#### Database Access
```json
"Bash(node scripts/sync-austender-contracts.mjs:*)"
"Bash(node --env-file=.env -e:*)"
"Bash(node:*)"
"Bash(source:*)"
"Bash(PGPASSWORD=\"$DATABASE_PASSWORD\" psql:*)"
"mcp__supabase__apply_migration"
"mcp__supabase__get_project_url"
```

#### Git Operations
```json
"Bash(git add:*)"
"Bash(git commit:*)"
"Bash(git commit -m \"$(cat <<'EOF'\nfeat: agent orchestrator...)"  // Pre-authorized commit message
```

#### File System
```json
"Bash(find:*)"
"Bash(ls:*)"
"Bash(grep:*)"
"Bash(xargs:*)"
"Bash(sort:*)"
"Bash(unzip:*)"
```

#### TypeScript
```json
"Bash(npx tsc:*)"
```

#### Web Access
```json
"WebSearch"
"WebFetch(domain:github.com)"
"WebFetch(domain:platform.minimax.io)"
"WebFetch(domain:www.verdent.ai)"
"WebFetch(domain:www.cometapi.com)"
"WebFetch(domain:www.abs.gov.au)"
"WebFetch(domain:data.gov.au)"
"WebFetch(domain:abr.business.gov.au)"
```

#### Process Management
```json
"Bash(open:*)"
"Bash(curl:*)"
"Bash(lsof:*)"
"Bash(kill %%)"
"Bash(echo:*)"
"Bash(env:*)"
"Bash(npm ls:*)"
"Bash(python3:*)"
```

#### MCP Tools
```json
"mcp__supabase__apply_migration"
"mcp__supabase__get_project_url"
"Bash(claude mcp list:*)"
"Bash(claude mcp remove:*)"
"Bash(claude mcp add:*)"
```

### Notable Patterns
- Migration-heavy SQL permissions (CREATE TABLE, CREATE FUNCTION)
- Pre-authorized complex commit with specific message format
- Multi-domain web fetch for LLM providers and government data sources
- Python3 permission (likely for data pipeline scripts)

---

## 3. Skills

**Location:** `/Users/benknight/Code/grantscope/.claude/skills/`

### Installed Skills (1)

#### superdesign
- **Path:** `/Users/benknight/Code/grantscope/.claude/skills/superdesign/SKILL.md`
- **Version:** 0.0.1
- **Purpose:** Frontend UI/UX design agent for generating/iterating design drafts
- **Activation:** "Help me design X", "Set design system", "Help me improve design of X"
- **CLI:** `@superdesign/cli` (global install)
- **Guidelines:** Fetched from `https://raw.githubusercontent.com/superdesigndev/superdesign-skill/main/skills/superdesign/SUPERDESIGN.md`

---

## 4. Agent Cache

**Location:** `/Users/benknight/Code/grantscope/.claude/cache/agents/`

### Scout Agent
- **Path:** `/Users/benknight/Code/grantscope/.claude/cache/agents/scout/`
- **Files:**
  - `database-access-audit.md` (17KB, last updated 2026-03-09)
  - `latest-output.md` (5KB, last updated 2026-03-09)
  - `pricing-page-data-report.md` (19KB, last updated 2026-03-06)

### Oracle Agent
- **Path:** `/Users/benknight/Code/grantscope/.claude/cache/agents/oracle/`
- **Files:**
  - `austender-ocds-api-research.md` (18KB, last updated 2026-03-07)
  - `latest-output.md` (14KB, last updated 2026-03-10) **[MODIFIED]**

### TSC Cache
- **Path:** `/Users/benknight/Code/grantscope/.claude/tsc-cache/` **[UNTRACKED]**
- TypeScript compilation cache for faster type checking

---

## 5. Environment Variables

**Location:** `/Users/benknight/Code/grantscope/.env`

**NOTE:** No `.env.local` file detected

### Database (Supabase)
```
DATABASE_URL
DATABASE_PASSWORD
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### LLM Providers (8)
```
ANTHROPIC_API_KEY
OPENAI_API_KEY
GROQ_API_KEY
PERPLEXITY_API_KEY
HUGGINGFACE_API_KEY
MINIMAX_API_KEY
GEMINI_API_KEY
DEEPSEEK_API_KEY
KIMI_API_KEY
```

### Other Services
```
FIRECRAWL_API_KEY
```

**Project ID:** `tednluwflfhxyucgwigh` (Supabase)

---

## 6. Git Status

### Branch Info
- **Current Branch:** `main`
- **Remote Status:** Ahead of `origin/main` by **8 commits** (unpushed)

### Modified Files (Not Staged)
```
M  .claude/cache/agents/oracle/latest-output.md
M  .tldr/status
M  thoughts/shared/handoffs/community-capital-ledger/current.md
```

### Untracked Files
```
.claude/tsc-cache/                           # TypeScript cache
.obsidian/                                   # Obsidian vault (should be gitignored?)
.tldr/cache/                                 # TLDR cache
.tldr/daemon.pid                             # TLDR process ID
data/abs/                                    # ABS dataset files
data/opensanctions/                          # OpenSanctions dataset
scripts/backfill-entity-remoteness.mjs       # New enrichment script
scripts/backfill-remoteness-from-abs.mjs     # ABS remoteness backfill
scripts/enrich-postcodes-from-abn.mjs        # ABN postcode enrichment
scripts/match-opensanctions.mjs              # OpenSanctions matching
supabase/migrations/20260309_batch_remoteness_backfill.sql
supabase/migrations/20260309_sa2_remoteness_selffill.sql
```

### Recent Commits (Unpushed)
```
3d7e823 fix: backfill 18K entities missing remoteness, SEIFA, and SA2 enrichment
d99cce6 chore: update agent cache and handoff docs
a92f3db feat: data browser for dataset detail pages with search, sort, filter, pagination
7122d3a feat: optimize health API with fast RPC-based counts and freshness
1871936 feat: benchmark harness + MiniMax primary provider across enrichment
976bf7a feat: mission control dashboard, health monitoring, power dynamics
d95c8c3 feat: entity dossiers, community funding gap packs, global search
c431758 feat: agent orchestrator + task queue + database tooling
```

---

## 7. Project Structure Summary

### Monorepo Layout
```
/Users/benknight/Code/grantscope/
├── apps/
│   └── web/                    # Next.js 14 App Router
│       └── src/app/
│           ├── grants/         # Grant search
│           ├── foundations/    # Foundation profiles
│           ├── entities/       # Entity dossier pages
│           ├── reports/        # 15 analytical reports
│           ├── places/         # Place-based funding
│           ├── mission-control/  # Dashboard
│           └── api/            # 40+ API routes
├── scripts/                    # 50+ data pipeline scripts
│   ├── enrich-*.mjs           # Multi-provider LLM enrichment
│   ├── import-*.mjs           # Data importers
│   ├── sync-*.mjs             # Ongoing sync pipelines
│   ├── scrape-*.mjs           # Web scraping
│   └── build-entity-graph.mjs # Entity graph builder
└── supabase/
    └── migrations/             # PostgreSQL schema migrations
```

### Data Pipeline Scripts (50+)
- **Entity graph:** `build-entity-graph.mjs` (unifies 10 sources → 92K entities)
- **Enrichment:** Multi-provider LLM rotation (Groq, Gemini, Minimax, DeepSeek)
- **Importers:** ACNC, ORIC, AusTender, AEC, Modern Slavery, Lobbying Register
- **Orchestration:** `agent-orchestrator.mjs` (replaces pipeline-runner.mjs)
- **Tooling:** `gsql.mjs` (query tool), `gsql-health.mjs` (freshness checks)

---

## 8. Memory System Notes

From global memory at `/Users/benknight/.claude/projects/-Users-benknight-Code-grantscope/memory/MEMORY.md`:

### Critical Database Access Pattern
- **Supabase MCP is connected to ACT project, NOT GrantScope**
- **NEVER use `mcp__supabase__*` tools for GrantScope**
- SELECT queries: `node --env-file=.env scripts/gsql.mjs "SELECT ..."`
- DDL/migrations: `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h ... -f <file.sql>`
- `gsql.mjs -c` flag mangles `$$` dollar-quoting — use `psql -f` for PL/pgSQL functions

### Design System
- Bauhaus-inspired: `border-4 border-bauhaus-black`, `font-black uppercase tracking-widest`
- Colors: `bauhaus-black`, `bauhaus-red`, `bauhaus-blue`, `bauhaus-muted`

### Agent Registry
- 45+ agents across 8 categories
- Registry: `scripts/lib/agent-registry.mjs`
- Orchestrator: `scripts/agent-orchestrator.mjs`

---

## 9. Key Findings

### Configuration Strengths
1. **Comprehensive permissions** for autonomous database work (psql, migrations, node scripts)
2. **Multi-provider LLM access** (8 API keys) with auto-rotation fallback
3. **Agent cache system** with oracle/scout outputs persisted
4. **Type-checking automation** (`npx tsc` permission)
5. **Pre-authorized git workflows** (add, commit with standard message format)

### Configuration Gaps
1. **No CLAUDE.md** — No project-specific instructions in root (relying on memory only)
2. **No hooks configured** — No PreToolUse/PostToolUse automation visible in settings
3. **Single skill** — Only superdesign installed (no database, testing, or data pipeline skills)
4. **Untracked data directories** — `data/abs/`, `data/opensanctions/` not in gitignore
5. **8 unpushed commits** — Recent work not backed up to remote

### Recommendations
1. **Add CLAUDE.md** to root with:
   - Database access patterns (gsql.mjs vs psql)
   - Agent orchestrator workflow
   - Design system guidelines
   - Common data pipeline patterns
2. **Configure hooks** for:
   - Auto-routing database queries to gsql.mjs (not Supabase MCP)
   - Pre-commit type checking (`npx tsc --noEmit`)
   - Agent delegation patterns
3. **Add .gitignore entries** for:
   - `data/abs/`
   - `data/opensanctions/`
   - `.obsidian/`
   - `.tldr/cache/`
   - `.tldr/daemon.pid`
4. **Push commits** to backup recent work (8 commits)
5. **Consider additional skills**:
   - Database query skill (gsql.mjs wrapper)
   - Data pipeline skill (agent orchestrator patterns)
   - Testing skill (if test suite exists)

---

## 10. Quick Access Paths

### Configuration Files
- Settings: `/Users/benknight/Code/grantscope/.claude/settings.local.json`
- Skills: `/Users/benknight/Code/grantscope/.claude/skills/superdesign/SKILL.md`
- Environment: `/Users/benknight/Code/grantscope/.env`
- Memory: `/Users/benknight/.claude/projects/-Users-benknight-Code-grantscope/memory/MEMORY.md`

### Documentation
- README: `/Users/benknight/Code/grantscope/README.md`
- Agent Cache: `/Users/benknight/Code/grantscope/.claude/cache/agents/`

### Key Scripts
- Query Tool: `/Users/benknight/Code/grantscope/scripts/gsql.mjs`
- Entity Graph: `/Users/benknight/Code/grantscope/scripts/build-entity-graph.mjs`
- Orchestrator: `/Users/benknight/Code/grantscope/scripts/agent-orchestrator.mjs`
- Agent Registry: `/Users/benknight/Code/grantscope/scripts/lib/agent-registry.mjs`

### Web App
- Entry: `/Users/benknight/Code/grantscope/apps/web/src/app/`
- API Routes: `/Users/benknight/Code/grantscope/apps/web/src/app/api/`
- Mission Control: `/Users/benknight/Code/grantscope/apps/web/src/app/mission-control/`

---

## Audit Complete

**Last Updated:** 2026-03-10
**Agent:** Scout
**Project:** GrantScope (/Users/benknight/Code/grantscope)
