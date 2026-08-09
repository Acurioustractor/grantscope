# Own-name rung — 5690 dry-run (2026-08-10, read-only)

Scope: gs_entities WHERE lga_name IS NULL AND postcode='5690' (73 rows).
Method: word-boundary match of 5690's locality names in canonical_name →
abs_sal_lga_ratio authority. Guards: one-SAL-per-name nationally (0 collisions
across all 19 candidates), postcode coherence (all targets ∈ 5690's POA set),
conflict → HOLD, no-SAL locality → HOLD. pg_lga is NOT authority (landmine
history); localities without SAL rows hold for the gazetteer rung.

## Verdict classes
- **A — PLACE → Ceduna 41010 (31)**: 23 CEDUNA-named (incl. DISTRICT COUNCIL
  OF CEDUNA → stamp `council_serves_shire`; rest `own_name_town+abs_asgs`),
  Charra Hall, Denial Bay Progress, 4× Koonibba (all CC — School Council,
  Building AC, Community AC General Store, Enterprises AC), 2× Thevenard.
- **B — PLACE → Unincorporated SA 49399 (5)**: Coorabie Progress, Border
  Village Nullarbor RPA, 3× Penong (Progress, Primary School Council, Racing).
  **PENONG flag**: ABS SAL ratio 1.000 AND postcode_geo both say Unincorporated
  SA; Ben's local read requested (he drives through this week).
- **C — HOLD no-authority (2)**: Oak Valley Aboriginal School Governing
  Council, Fowlers Bay Progress Assoc — no SAL row (pg claims Maralinga
  Tjarutja; pg is not authority). Gazetteer rung.
- **No name evidence (35)**: stay honest-null → geocode/correction rung.

## Arithmetic if A+B approved
placed 22→53 (Ceduna) · 5690 null pool 73→35 · Ceduna council maybe-pile
123→85 · unplaced share 85%→62% · Unincorporated SA +5 placed ·
global unplaced_pc 27,796→27,758 (−38).
Stamps: 35× own_name_town+abs_asgs · 1× council_serves_shire.

Full 38-row sheet: session transcript 2026-08-10 (query inline above it);
rebuild by re-running the WITH cands(...) query in this file's git blame era.
