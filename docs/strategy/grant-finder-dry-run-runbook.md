# Grant-Finder Overhaul — Dry-Run Runbook

Verification for the Phase 1–5 work in `grant-finder-overhaul.md`. Split into
what runs **offline** (done, in CI/sandbox) and what needs a **DB-connected /
networked** environment (`.env` with Supabase creds; egress to `*.data.*.gov.au`
and `grants.gov.au`).

## A. Offline — already verified (no creds, no network)

```bash
pnpm install --frozen-lockfile
cd apps/web && npx tsc --noEmit          # typecheck: clean
cd packages/grant-engine && npx tsx --test tests/*.test.ts   # 31 tests pass
```

Covers: vector-match boosts, trust classifier, CKAN pagination (incl. the
truncation-bug fix), dedup key, source-health classifier, CLASSIE mapping.
The five-part logic demo output is in the session notes.

## B. Connected — run these on infra with `.env` + network

Preconditions: `.env` present (Supabase URL + service role key; `ANTHROPIC_API_KEY`
only for the optional CLASSIE `--llm` pass), and egress allowlisted for the gov hosts.

### 1. Phase 1 — matching parity (scout dry-run)
```bash
# Pick a real org with an embedding, then:
npx tsx scripts/scout-grants-for-profiles.mjs --dry-run --user-id=<UUID>
```
**Expect:** `Semantic matching: N/N (0 keyword fallback)` for embedded orgs;
top-5 grants ranked by `fit_score` with signals; orders should match
`/api/profile/matches` for the same org. If you see `keyword fallback`, that org
has no embedding — save its profile to generate one (or run the embedding backfill).

### 2. Phase 2 — trust quarantine
```bash
# Seed or find an llm_knowledge grant, then dry-run the scout for an org that would match it:
npx tsx scripts/scout-grants-for-profiles.mjs --dry-run --user-id=<UUID>
```
**Expect:** a `⚠ N high-scoring grant(s) held back as unconfirmed` line; the
`llm_knowledge` grant must NOT appear in the auto-add/notify set. Load its detail
page (`/grants/<id>`) → the badge reads "Unconfirmed — AI-surfaced, URL not verified".

### 3. Phase 2 — stale closing (dry-run)
```bash
node --env-file=.env scripts/close-stale-grants.mjs --dry-run
```
**Expect:** rows closed for `COALESCE(closes_at, deadline) < today` (both date
fields now considered) plus the 14-day last-seen liveness rule.

### 4. Phase 3 — CKAN feed, full non-truncated ingest
```bash
# Standalone plugin sanity (prints yield):
npx tsx -e "import('./packages/grant-engine/src/sources/qld-grants.ts').then(async m=>{let n=0;for await(const g of m.createQLDGrantsPlugin().discover({status:'open'}))n++;console.log('QLD grants yielded:',n)})"
# Full state scrape (writes; use --dry-run first):
npx tsx scripts/scrape-state-grants.mjs --state=qld --dry-run
```
**Expect:** any agency with >500 records now fully ingested (pre-fix it capped at
500/agency). Watch for a `[ckan] … stopped at maxRecords` warning — it means a
real cap was hit and should be raised.

### 5. Phase 3 — GrantConnect GA auto-fetch
```bash
GRANTCONNECT_GA_EXPORT_URL="<weekly GA csv url>" \
  node --env-file=.env scripts/ingest-grantconnect.mjs --dry-run
```
**Expect:** `Fetching GA export…` → `Saved N bytes`, then parse counts. On fetch
failure it falls back to the local CSV (no lost run).

### 6. Phase 4 — CLASSIE (apply migration, then classify)
```bash
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
  -f supabase/migrations/20260704000000_grant_classie.sql
npx tsx scripts/classify-grants-classie.mjs --dry-run --limit=200
# then live (deterministic pass, no LLM cost):
npx tsx scripts/classify-grants-classie.mjs --limit=5000
```
**Expect:** `Classified: N via category map, 0 via LLM, M skipped`. Spot-check a
few rows' `classie_subjects` / `sdg_codes` against the grant's real theme.

### 7. Phase 5 — source health (after a scrape has run)
```bash
node --env-file=.env scripts/gsql.mjs \
  "SELECT agent_id, items_found, started_at FROM agent_runs WHERE agent_id LIKE 'source:%' ORDER BY started_at DESC LIMIT 30"
```
Feed those rows to `classifySourceHealth()` (or the eventual `/health` panel).
**Expect:** any source whose latest `items_found=0` after prior >0 shows `zeroed`.

## C. Still-open build items (need the above to be run first)

- Backfill grant embeddings (`embeddings.ts:backfillEmbeddings`) for any grants missing vectors.
- Wire `classifySourceHealth` into the `/health` UI (query in step 7 → panel).
- Phase 6 (award-history join) — needs the Phase 3 award feed + DB.
