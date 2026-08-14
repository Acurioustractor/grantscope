# GROUND TRUTH — CivicGraph + JusticeHub shared database

Verified 2026-08-14 by direct psql against Supabase project `tednluwflfhxyucgwigh`.
Do NOT trust CLAUDE.md's "Key Tables Reference" — it is materially stale (see below).

## The single most important fact

**GrantScope/CivicGraph and JusticeHub share ONE Supabase project: `tednluwflfhxyucgwigh`.**
Two Next.js apps, one database. JusticeHub additionally reads a second project
(`yvnuayzslukamizrlhwb` = Empathy Ledger) via `EMPATHY_LEDGER_SUPABASE_URL`.

## Census (exact `count(*)`, not estimates)

| Metric | Value |
|---|---|
| public-schema objects (tables + matviews) | 812 |
| ... plain tables | 714 |
| ... materialized views | 98 |
| regular views (relkind 'v', not counted above) | 212 |
| **populated objects** | **724** |
| **empty objects** | **88** |
| **total rows** | **52,349,579** |
| columns catalogued | 14,310 |
| declared foreign keys | 636 |

Size distribution of populated objects:
- 1–9 rows: 199 objects  ← suspiciously many; likely scaffolding/seed/test
- 10–99: 216
- 100–999: 120
- 1k–9,999: 90
- 10k–99,999: 65
- 100k–999,999: 26
- 1M+: 8

## CLAUDE.md is stale — verified corrections

| Table | CLAUDE.md says | ACTUAL |
|---|---|---|
| `gs_entities` | 159K | **609,448** |
| `gs_relationships` | 1.08M | **3,429,184** |
| `political_donations` | 312K | **2,549,483** |
| `austender_contracts` | 770K | **823,620** |
| `justice_funding` | 71K | **157,116** |
| `abr_registry` | *not documented* | **20,006,350** |
| `asic_companies` | *not documented* | **2,167,533** |
| `entity_xref` | *not documented* | **1,211,744** |
| `grantconnect_awards` | *not documented* (memory says "EMPTY") | **291,264** |

## Top 30 objects by row count

```
20,006,350  table    abr_registry
 9,038,737  matview  mv_abr_name_lookup
 3,429,184  table    gs_relationships
 2,549,483  table    political_donations
 2,167,533  table    asic_companies
 2,149,868  table    asic_name_lookup
 1,278,440  table    privacy_audit_log
 1,211,744  table    entity_xref
   823,620  table    austender_contracts
   609,448  table    gs_entities
   609,416  table    gs_entities_lga_backup_20260808   ← BACKUP CRUFT
   400,276  matview  mv_gs_entity_stats
   360,488  table    acnc_ais
   358,347  table    gs_entities_lga_backup_20260809b  ← BACKUP CRUFT
   355,797  table    gs_entities_lga_backup_20260809c  ← BACKUP CRUFT
   351,455  matview  mv_charity_network
   339,698  table    person_roles
   336,444  matview  mv_person_entity_network
   331,239  matview  mv_person_entity_crosswalk
   328,939  matview  mv_person_identity_network
   291,264  table    grantconnect_awards
   241,269  matview  mv_person_identity_influence
   241,260  matview  mv_person_identity_influence_v2
   237,990  matview  mv_person_network
   237,340  matview  mv_person_influence
   232,474  matview  mv_donation_contract_timing
   230,434  table    person_identities
   199,719  table    state_tenders
   188,139  matview  mv_entity_power_index
   157,116  table    justice_funding
```

Note the visible duplication smell: `mv_person_entity_network` / `mv_person_identity_network` /
`mv_person_network` / `mv_person_influence` / `mv_person_identity_influence` /
`mv_person_identity_influence_v2` all ~230–340K rows. Several are probably superseded.

## Data files available to you (READ THESE, do not re-query)

All in the scratchpad dir
`/private/tmp/claude-501/-Users-benknight-Code-grantscope/39280876-c679-4e2c-abde-4bb56d1246d4/scratchpad/`:

- `census.csv` — relname, kind, exact_rows, bytes for all 812 objects
- `columns.csv` — table_name, ordinal_position, column_name, data_type, is_nullable (14,310 rows)
- `foreign_keys.csv` — conname, src_table, src_cols, tgt_table, tgt_cols (636 rows)
- `populated_objects.md` — the 724 populated objects, largest first
- `empty_objects.md` — the 88 empty objects

## Codebases

- **GrantScope / CivicGraph**: `/Users/benknight/Code/grantscope`
  Monorepo. App at `apps/web` (Next.js 15, Tailwind 4). 267 `page.tsx` routes.
  Data pipeline agents in `scripts/`. Design system: Bauhaus Industrial (see `DESIGN.md`).
- **JusticeHub**: `/Users/benknight/Code/JusticeHub`
  Next.js app at `src/`. 480 `page.tsx` routes, 502 `route.ts` API routes.
  Design system: "Living Atlas" (`atlas-*` tokens) — see its `DESIGN.md`.
  The CONTAINED brand section in its CLAUDE.md governs `/contained` ONLY, not the platform.

## How to query (if you must)

```bash
# SELECT via RPC — 8 SECOND STATEMENT TIMEOUT, will fail on anything heavy
cd /Users/benknight/Code/grantscope && node --env-file=.env scripts/gsql.mjs "SELECT ..."

# Heavy/long queries — direct psql (no 8s cap)
cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
  psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
  -U postgres.tednluwflfhxyucgwigh -d postgres -c "SELECT ..."
```

Rules: never run unfiltered ILIKE/JOIN scans on `gs_entities`, `gs_relationships`,
`austender_contracts`, `abr_registry`. Always use a WHERE clause or LIMIT.
The pooler is shared with other tenants — keep queries cheap and serial.

## The user's actual goal (verbatim intent, de-typo'd)

Ben wants:
1. A workflow that maps every piece of data in Supabase across both codebases.
2. A review of what data maps already exist.
3. A way to see absolutely every piece of data — an overview page that is a list, in
   dashboard format (with real research into the best kinds of dashboards).
4. Then see the full map of the data, and drill down through several levels to see how it
   is connected and what can be done with it.
5. The best possible maps, visualisations and analytics views of this.
6. Vision: cast the net wider — the biggest dataset of Australian organisational
   philanthropy, giving, charities, spend, youth detention numbers, child protection,
   organisations doing the work, and media.
7. Cross-sections of all of it in a way no one else does.
8. Focused, so you can see it all, see the gaps, and find opportunities.
9. Learn more about director links, philanthropy, and the way everything moves in Australia.

## Architecture constraints (from CLAUDE.md — binding)

- **In-app, not CLI.** New features are Next.js pages/components. No standalone CLI tools
  for user-facing features.
- **Server Components by default.** `"use client"` only for real interactivity.
  Never `next/dynamic` inside a Server Component.
- **Bulk SQL, not API loops** for anything touching 50+ rows.
- Read `DESIGN.md` before any visual decision. GrantScope = Bauhaus Industrial:
  Satoshi (display), DM Sans (body), JetBrains Mono (code), `border-4 border-bauhaus-black`,
  `font-black uppercase tracking-widest`, zero border-radius.
  Colors: black `#121212`, red `#D02020`, blue `#1040C0`, yellow `#F0C020`, canvas `#F0F0F0`.
