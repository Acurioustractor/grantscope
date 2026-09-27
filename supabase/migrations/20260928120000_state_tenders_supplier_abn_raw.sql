-- state_tenders.supplier_abn held 20,314 values that are not ABNs ('#N/A', 'NoABN', '0',
-- joint-supplier comma lists), almost all from the QLD disclosure ingests in JusticeHub.
-- The ingests now keep only checksum-valid, registered ABNs in supplier_abn and the cell as it
-- arrived here, so moving a bad value out of the identifier column never loses it.
-- Written from JusticeHub (src/lib/identifiers/supplier-abn.ts), 2026-09-28.
BEGIN;
ALTER TABLE public.state_tenders ADD COLUMN IF NOT EXISTS supplier_abn_raw text;
COMMENT ON COLUMN public.state_tenders.supplier_abn_raw IS
  'Supplier ABN cell exactly as the source published it. supplier_abn holds only a validated ABN.';
COMMIT;
