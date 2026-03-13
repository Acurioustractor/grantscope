# Codex Handoff: Trust & Consistency Fixes

**Date:** 2026-03-11
**Context:** Product review identified hardcoded stats, inconsistent limits, and stale metadata that undermine buyer confidence. These are all frontend/code fixes — no database changes needed.

## Repository

- **Repo:** `grantscope` (brand: CivicGraph)
- **Stack:** Next.js 15, Tailwind 4, Supabase client
- **App dir:** `apps/web/src/app/`
- **Type check:** `cd apps/web && npx tsc --noEmit`

## Branch

Create branch `fix/trust-consistency` from `main`.

---

## Task 1: Fix hardcoded donor-contractor limits

**Problem:** Three different pages show different caps on the same data (200, 100, hardcoded "140"). Live data has 342+ entities.

**Files to fix:**

### `apps/web/src/app/page.tsx` (line 35)
```typescript
// CURRENT: .limit(200)
// FIX: Remove arbitrary limit or increase to 1000
.limit(1000)
```

### `apps/web/src/app/entities/page.tsx` (line 63)
```typescript
// CURRENT: .limit(100)
// FIX: Match the homepage limit
.limit(1000)
```

### `apps/web/src/app/reports/donor-contractors/page.tsx` (lines 8-18)
```typescript
// CURRENT: Hardcoded "140 entities", "$80M", "$4.7B" in metadata description
// FIX: Remove specific numbers from static metadata. Use a generic description.
// The actual counts should come from the data fetched at runtime, not baked into SEO metadata.
description: 'Entities in Australia that donate to political parties AND hold government contracts. See who gives and who gets.'
```

The report page body should display live counts from the query, not hardcoded numbers.

---

## Task 2: Fix Mission Control SQL template

**File:** `apps/web/src/app/mission-control/mission-control-client.tsx` (line 165)

```typescript
// CURRENT: 'SELECT remoteness_2021, COUNT(*) ...'
// FIX: The column in gs_entities is called 'remoteness', not 'remoteness_2021'
// (remoteness_2021 is the column name in postcode_geo, not gs_entities)
{ label: 'Postcodes by remoteness', sql: 'SELECT remoteness, COUNT(*) as count FROM gs_entities WHERE remoteness IS NOT NULL GROUP BY remoteness ORDER BY count DESC' }
```

Check ALL SQL templates in that file for similar column name issues. The gs_entities table uses:
- `remoteness` (not `remoteness_2021`)
- `seifa_irsd_decile` (not `irsd_decile`)
- `lga_name`, `lga_code`
- `postcode`, `state`

---

## Task 3: Clean up cross-system references

These aren't bugs but should be gracefully handled when the referenced tables don't exist.

### `apps/web/src/app/places/[postcode]/page.tsx` (lines 165-190, 495-513)
- Queries `storytellers` and `locations` tables (Empathy Ledger)
- Shows "Community Voice" section with Empathy Ledger attribution
- **Fix:** Wrap in try/catch or check if data is null before rendering. Add a comment explaining the cross-system bridge.

### `apps/web/src/app/entities/[gsId]/page.tsx` (lines 197, 304-310, 925-948, 1324-1341)
- Queries `organizations` table for JusticeHub org link
- Queries `alma_interventions` and `alma_intervention_evidence` for evidence chain
- **Fix:** These queries already return null gracefully via Supabase. Verify the UI sections are hidden when data is null (not showing empty sections).

---

## Task 4: Make pricing page honest

**File:** `apps/web/src/app/pricing/page.tsx`

The pricing page promises features that don't exist yet. Two options:

**Option A (recommended):** Add "Coming soon" badges to unshipped features:
- Line 75: `'Foundation scorecard & benchmarking'` → `'Foundation scorecard & benchmarking (coming soon)'`
- Line 76: `'Data API access'` → keep (API exists at `/api/data`)
- Line 77: `'White-label option'` → `'White-label option (coming soon)'`
- Line 96: `'Governed proof layer (outcome evidence)'` → `'Governed proof layer (coming soon)'`
- Line 98: `'SSO / SAML integration'` → `'SSO / SAML integration (coming soon)'`

**Option B:** Remove unshipped features entirely from pricing display.

---

## Task 5: Grant deduplication display

**Problem:** 131 duplicate grant name/provider groups (461 rows) visible in UI.

**File:** `apps/web/src/app/grants/page.tsx` (or wherever grants are listed)

- Check if the grants listing query deduplicates by name+provider
- If duplicates exist, either:
  - GROUP BY name, provider and show the latest/best version
  - Add a `DISTINCT ON` clause
  - Or merge duplicates at the data layer (separate task)

---

## Verification

After all changes:

```bash
cd apps/web && npx tsc --noEmit
```

All changes should be cosmetic/query fixes. No database migrations needed.

---

## Do NOT touch

- Database schema or migrations
- `scripts/` directory
- `.env` or credentials
- `gs_entities` table data (postcode backfill is running separately)
- Agent orchestrator or pipeline code
