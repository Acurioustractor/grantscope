---
date: 2026-08-18T21:00:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-18T21:00:00Z
**Goal:** CivicGraph as one legible system — one shell over all data, and every number on a screen
meaning what the screen says it means.
**Branch:** `main` through `6e6a01f6` (#257 squash-merged, branch deleted, tree clean). Main CI
green (run 32068531139, 3m45s).
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (734 pass) · dev 3013

### Now
[->] Both lanes clean. Either UX pass 3, the two open decisions below, or resume grantee-ingest
wave 1 remainder (see memory: grantee-ingest-pipeline).

### This Session (2026-08-18)
UI/UX pass 2. Pass 1 was how the shell looked; pass 2 was whether the numbers are honest.
- [x] **Name normalisation** — `entity_name_key()` folds PTY LTD/PTY LIMITED/P/L/PROPRIETARY
      LIMITED, case, punctuation, whitespace. Pratt Holdings 8 rows -> 1. ABN borrowing now needs
      the name to map to EXACTLY ONE ABN (old `min(abn)` picked one of several; 86 names had
      multiple). Fixed a drawer/row mismatch the earlier SH-5 fix had introduced.
- [x] **Charities browser was broken** — `charity_browse` unfiltered was 10.4s, over the statement
      timeout, so every FIRST-TIME visitor got the error state; any state filter hid it. Now 92ms
      via `mv_charity_browse`.
- [x] **Grants coverage disclosed** — 91% QLD ($27.3bn of $33.7bn) vs Victoria $125m; 55% of the
      money ($18.7bn / 99,891 grants) carries NO topic tag and the top recipient is a state rail
      operator. Numbers come from the RPC, not copy, so they cannot rot.
- [x] **Remoteness chart follows the topic filter** on the tiles' basis. The dashboard now
      reconciles: youth justice $825.3m placed + $90.4m unplaced = $915.7m = the tile, exactly.
- [x] **SE: one ABN, one row** — five Red Cross listings each showed the whole $7.64bn. Collapsed,
      registered name from `gs_entities.canonical_name`, "5 listings" badge, branch search still
      matches.
- [x] P2/P3: foundation type per row, sector array literals, `$0k`, year ranges, headers, one-shot
      RPC retry (`lib/rpc-retry.ts`, 8 tests).
- [x] Audit doc with every finding's disposition: `docs/ux-audit/shell-ux-findings-pass2.md`.

### Next
- [ ] **F12 name casing (Ben's call)** — `QUEENSLAND RAIL LTD` beside `Legal Aid Queensland`.
      `displayName()` in PersonBrowser does the safe half already (title-case ONLY fully-lowercase
      names, SH-11). All-caps is riskier: some are correct as registered.
- [ ] **F11 retry is partial** — only charities, social enterprises, grants, people. The other
      browse pages have none; each call site needs wrapping by hand, no shared data layer.
- [ ] Foundations: `GIVING/YR` == `GRANTED` exactly on some rows, 90x apart on others. Footer says
      "Giving can mix grantmaking with program spend" — is that the whole explanation?
- [ ] Grantee wave 1 remainder (~4-5h): Ian Potter scraper, Myer PDFs, Buckland PDFs, VFFF prose.
- [ ] Catalogue retire-or-keep (Ben) · docs-in-rail IA (Ben) · 475 unfiled round 2.

### Migrations applied this session (ALL already run against prod DB)
`2026-08-18-entity-name-key.sql` · `-entity-name-key-views.sql` · `-charity-browse-mv.sql` ·
`-grant-coverage-stats.sql` · `-remoteness-by-topic.sql` · `-se-sector-display.sql` ·
`-se-collapse-by-abn.sql`
New MVs, all registered in `mv_refresh_registry` (nightly): `donor_name_keys`, `donor_key_abn`,
`supplier_name_keys`, `supplier_key_abn`, `mv_charity_browse`.

### Key traps (this arc, will bite again)
- **A parameterised SQL function gets a GENERIC plan.** Identical SQL ran 2.8s ad-hoc with literals
  and >60s inside the function. Do not benchmark a query body and assume the RPC matches it.
- **Precompute regex/lateral work into indexed MVs.** Inline `entity_name_key()` = 3 regexes x
  2.55M rows x 4 call sites. `charity_browse` = 132,000 index lookups per page view.
- **Adding a field to an `unstable_cache`'d value does NOTHING until the key changes.** The old
  cached object had no `states`, so the disclosure silently did not render — in prod it would have
  stayed invisible for an hour with no error anywhere. Version the key.
- **`CREATE OR REPLACE FUNCTION` cannot change the return type.** Read
  `pg_get_function_result(oid)` FIRST — se_browse had five has_*/on_graph booleans I would have
  silently dropped. Adding a column needs DROP+CREATE in ONE transaction.
- **Audit the page, not the viewport.** Two P2 findings were wrong because the disclosure sat below
  a 200-row table. Scroll before claiming something is undisclosed.
- **Fixing a truncation by widening a column moves it along the row** — widening Influence made the
  Boards label truncate instead.
- My own MV builds saturated the shared pooler and made an unrelated page time out mid-audit. When
  a page fails right after heavy DDL, suspect yourself before the page.
- Auto-mode blocks psql DDL until Ben gives an explicit verb; `gsql.mjs` has ~8s timeout, and its
  `-c` mangles `$$`.

### Decisions
- **Disclose, do not hide.** $18.7bn of untagged grant money stays listed and labelled rather than
  filtered away by default; the QLD skew is stated rather than corrected. Hiding it is its own
  dishonesty. Reversible if Ben prefers a tagged-only default.
- **Do not merge what the data says is distinct.** Three `Pratt Holdings Pty Ltd` rows are three
  real ABNs — the table prints the ABN beside a repeated name instead of merging. Conversely five
  Red Cross listings ARE one ABN, so they collapse.
- ABN borrowing requires a single-ABN name; a suffixed name may borrow its unsuffixed root's ABN,
  never the reverse, so a person never merges into a namesake company.
- Retry once, not three times. Slowness belongs in the query.

### Open Questions
- F12 casing, and whether foundations should keep listing universities/service-delivery orgs at all
  (they are labelled now, but the page still promises "every giving organisation").
- UNCONFIRMED: /clarity dark-inside-light framing acceptable to Ben?
- Repo does NOT allow gh auto-merge queueing — merge via a background wait-for-green loop.

### Workflow State
pattern: ship-per-slice (branch -> build -> tsc+vitest -> smoke 3013 -> PR -> merge-on-green)
phase: 6
total_phases: open-ended
retries: 0
max_retries: 3

#### Resolved
- goal: "UX pass 2 — make the browse surfaces honest"
- resource_allocation: balanced

#### Unknowns
- (see Open Questions)

#### Last Failure
(none)

---

## Context

Session flow: Ben reviewed the deployed console (post-clarity-catalog work), verdict "works but hard
to make sense of", pointed at https://demos.shadcndashboard.dev/ and chose "soften Bauhaus toward
the demo" via AskUserQuestion. Pencil mock approved, then four ship-per-slice PRs same day.

Key files: `src/components/shell/{shell,shell-header,shell-menus}.tsx` · `src/app/dashboard/{layout,page}.tsx` · `src/app/dashboard/help/page.tsx` · `src/lib/view-registry.ts` · `src/app/reports/theme/page.tsx` (new index) · globals.css `.shell` block.
Grounding docs: `thoughts/shared/data-map/DASHBOARD-VIEW-MAP.md` · `thoughts/shared/plans/dashboard-shell-buildout.md`.
Prior stream handoff: `thoughts/shared/handoffs/clarity-catalog/current.md` (clarity console rebuild, still holds Slice 5 detail).
