# Goods Relationship Engine — Phase 3 Report (Asks)

**Date:** 2026-06-11 · **Method:** ask-sizing brief (`2026-06-10-goods-ask-sizing.md` — fundable units + ACNC-verified capacity) extended to the whole live set.
**Writes:** ask_amount_aud (9 rows) · ask_purpose (27 positioned rows) · `framing.ask_framing` key MERGED into the synced framing jsonb (never overwritten — that object syncs from the funder-ledger pipeline).

## Amounts logged (provenance in each ask_purpose)

| Row | Ask | Basis |
|---|---|---|
| REAL Innovation Fund | $2M/3yr | Stage 2 submitted, shortlisted — Oonchiumpa lead 60-80%, NOT ACT's share (Verified) |
| QBE Foundation | $400K | top of $150-400K Stage 2 band; match-gated (Verified arc) |
| Ian Potter | $375K | midpoint of EOI invitation $100-150K/yr × 3 (Reported — Notion transcript; confirm w Alberto) |
| Snow Foundation | $200K | mooted Sep return — ESTIMATE, not committed; $120K FY26 already won |
| Bryan Foundation | $150K/2yr | brief, pending Ben sign-off |
| Centrecorp 130-bed | $106,150 | GHL verified; **moved from the repeat row to the proposal row** (was double-countable) |
| TFFF | $100K | brief, pending Ben sign-off |
| Rotary Eclub | $82.5K | pre-existing — INV-0222 receivable, NOT pipeline |
| Brian M Davis | $50K | top of brief's $25-50K, pending Ben sign-off |

**No amount, deliberately:** PRF (no-ask decision, FY27 track) · SEFA ($300K target has no thread yet — phase-1 verdict; logging it would re-launder the baseless claim) · Oonchiumpa (verbal, founder puts the number) · Homeland invoice / Julalikari quotes / Anyinginyi quote / Rotary Global Grant / FRRR / CBF (values not in email — pull from Xero/Nic/Pene) · buyers + NACCHO (endorsement, not money).

## Match-campaign arithmetic (31 Aug, ≥$400K)

Centrecorp $106K + Bryan $150K + TFFF $100K + Snow conversion ($132K+ committed tranches, $200K mooted) ≈ **$490-560K — clears the bar with margin**, before Potter ($375K upside, EOI 18 Jun) and BMD ($50K). PRF out by design; SEFA debt doesn't count; REAL/QBE are not match.

## Caveats

- Brief amounts (TFFF/Bryan/BMD) are recommendations **pending Ben's sign-off** — marked in each ask_purpose.
- Potter midpoint and Snow mooted figures are flagged Reported/Estimate in-row.
- One LOI wording (from Jay, 18 Jun) before papering anything.
