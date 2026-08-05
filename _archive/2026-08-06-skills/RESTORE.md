# Archived skills — 2026-08-06

Five repo skills retired in Ben's skills review (too many, confusing).
The seven survivors: preflight, close, make-the-ask, polish, wedge,
lighthouse, health.

| Skill | Why archived |
|---|---|
| commit | Generic commit hygiene; /ship + normal workflow cover it |
| refresh-views | Wrapper over `node scripts/refresh-views-v2.mjs` (documented in CLAUDE.md/memory) |
| superdesign | Third-party "explore design directions" agent — contradicts the decided two-family rule (never re-decide design) |
| graph-studio | /graph brainstorming; off-strategy vs the buyer wedge |
| leverage | Heavy loop unused since June; guardrail role covered by wedge |

## Restore
```bash
git mv _archive/2026-08-06-skills/<skill> .claude/skills/<skill>
mv .claude/skills/<skill>/SKILL.archived.md .claude/skills/<skill>/SKILL.md
```
