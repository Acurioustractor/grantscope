# One shell, all data — phase spec

**Date:** 2026-08-17 · **Status:** agreed with Ben (grill session, this doc is the record)
**Goal:** extend the dashboard shell and the proven Browse pattern until every populated kind of data has a rich, honest surface, and nothing renders off-system.

## Scope

- **Surface existing data, not ingest.** The grantee-ingest queue (Telethon, Stan Perron, RCH, Peter Mac) stays a parallel day-shift lane, Ben-in-loop.
- **No chrome without a data source.** New capability only where a populated table/MV already backs it.
- **Pattern:** Browse = list → filters/sorts → drawer → links. One kind per slice. Typed `view-registry.ts`. Transaction kinds (grants/contracts/donations) browse as **entity-shaped rollups** (top recipients / suppliers / donors) with the transaction list inside the drawer — never paginated raw-row UIs.

## Safety rails (apply to every slice)

1. **All rollups computed in SQL.** Browse RPCs are DB-side aggregates with LIMIT+OFFSET and `NULLS LAST`. Required year-or-search predicate where the base table is >500K rows.
2. **Mandatory money filters baked into the RPC**, not the app: `justice_funding` → `measure_kind='grant' AND is_aggregate IS NOT TRUE AND` the `isRealRecipient()` name-blocklist (port to SQL); `political_donations` → `receipt_type='donation received'`. Reference: `apps/web/src/lib/justice-money.ts`.
3. **GRANTs in every migration** — SELECT to anon/authenticated/service_role. Missing GRANT = PostgREST silently empty (5 prior instances).
4. **Explicit error-vs-empty states.** Replace the try/catch-to-empty-list pattern in Browse pages: an RPC failure renders an error card, an empty result renders "0 with why". Verify per slice by breaking the RPC name once.
5. **Honesty in the UI, not silent capping:** nominee cap (board_count ≤ 10) stays with an in-UI "why some people are excluded" note; person money uses the de-collided `_v2` method; places show `lga_source` provenance.

## Slices

Slice 1 first; 2–7 independent after it, land in any order.

- **S0 — power-dynamics-live: DONE.** Already in main (byte-identical); ledger note was stale.
- **S1 — Shell sweep + ops fold-in.** Wrap `/ops/*` and `/admin/api-usage` in the dashboard shell (keep URLs, rail "Ops" group). Repair `/ops/health` queries (zeros / score 26). Add a **Views index** page in the rail listing all registry views (pinning stays curated ~4). Sweep every route for softened-shell language drift.
- **S2 — People browser.** List from `mv_person_influence`/`mv_board_interlocks`, sortable by boards / financial footprint. Drawer: boards held (linking to org drawers), de-collided money footprint, exclusion note.
- **S3 — Places browser.** LGA primary grain (dedupe `mv_funding_deserts` grain in the RPC), postcode as drawer breakdown. Drawer: funding totals, entity count, SEIFA/remoteness, desert score, "how placed" `lga_source` provenance line.
- **S4 — Grants browser.** Top recipients rollup of `justice_funding` (filters per rail 2), transactions in drawer.
- **S5 — Contracts browser.** Top suppliers rollup of `austender_contracts`, transactions in drawer.
- **S6 — Government buyers browser.** Buyer-side rollup of contracts (serves the buyer-wedge strategy).
- **S7 — Donations browser.** Top donors rollup of `political_donations` (`receipt_type='donation received'`), transactions in drawer.
- **S8 — Entities → search/jump-off.** `/dashboard/entities` becomes search + links into the kind browsers (not a browser itself). Error-state hardening anywhere still missing.

## Definition of done

**Per slice:** migration applied with GRANTs · `tsc --noEmit` + `vitest run` green · smoke on 3013 with real data visible · break-the-RPC error-state check · view registered in `view-registry.ts` · PR merged on green (ship-per-slice).
**Phase exit:** Vercel prod eyeball of the entire shell (localhost-verified is not done).
