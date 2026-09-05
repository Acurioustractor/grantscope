-- QLD + WA ILOC packs (same pipeline as NT, 2026-08-24/25): the abs_nt_* names go
-- national. 424 new ILOCs (QLD 206, WA 218) into both reference tables, then the
-- goods_communities QLD/WA matching passes (exact + suffix-normalised, unambiguous
-- only, NULL over guessed).
-- Apply: run sections in order; \copy lines fed the qldwa CSVs via pstdin.

ALTER TABLE IF EXISTS abs_nt_iloc_overcrowding RENAME TO abs_iloc_overcrowding;
ALTER TABLE IF EXISTS abs_nt_iloc_health RENAME TO abs_iloc_health;
COMMENT ON TABLE abs_iloc_overcrowding IS 'ABS Census 2021 IP DataPack I16 housing suitability, ILOC grain. NT loaded 2026-08-24; QLD+WA 2026-08-25. CNOS need-1+-extra-bedroom.';
COMMENT ON TABLE abs_iloc_health IS 'ABS Census 2021 IP DataPack I12 long-term conditions (A&TSI persons) + I04 medians, ILOC grain. NT 2026-08-24; QLD+WA 2026-08-25. Self-reported, small-cell randomised.';
