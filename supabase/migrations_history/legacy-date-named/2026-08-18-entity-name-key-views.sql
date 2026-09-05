-- Precomputed name-key lookups for the donor and supplier rollups, 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-entity-name-key-views.sql
--
-- Companion to 2026-08-18-entity-name-key.sql. Computing entity_name_key() inside the browse
-- RPCs is what costs: three regexes per row, and inside a parameterised function the planner
-- takes a generic plan and the whole rollup goes from 1.8s to over a minute. The same SQL run
-- ad-hoc with literals takes 2.8s, so this is a plan problem, not an algorithm problem.
--
-- Fix: compute the key once per DISTINCT name into a materialized view with real statistics and
-- a unique index. The RPCs then join an indexed table instead of a CTE the planner has to guess
-- at, and the regex never runs at query time at all.
--
-- Refresh: nightly alongside the other MVs (scripts/refresh-views-v2.mjs). A name that appears
-- between refreshes simply keys on itself until the next one — it never errors, it just does not
-- benefit from suffix folding yet.

CREATE MATERIALIZED VIEW IF NOT EXISTS donor_name_keys AS
  SELECT s.donor_name, entity_name_key(s.donor_name) AS nk
  FROM (
    SELECT DISTINCT donor_name FROM political_donations
    WHERE receipt_type = 'donation received'
      AND donor_name IS NOT NULL AND btrim(donor_name) <> ''
  ) s;

CREATE UNIQUE INDEX IF NOT EXISTS donor_name_keys_name_uidx ON donor_name_keys (donor_name);
CREATE INDEX IF NOT EXISTS donor_name_keys_nk_idx ON donor_name_keys (nk);

CREATE MATERIALIZED VIEW IF NOT EXISTS supplier_name_keys AS
  SELECT s.supplier_name, entity_name_key(s.supplier_name) AS nk
  FROM (
    SELECT DISTINCT supplier_name FROM austender_contracts
    WHERE supplier_name IS NOT NULL AND btrim(supplier_name) <> ''
  ) s;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_name_keys_name_uidx ON supplier_name_keys (supplier_name);
CREATE INDEX IF NOT EXISTS supplier_name_keys_nk_idx ON supplier_name_keys (nk);

-- The ABN each name key is allowed to borrow: only where the name maps to exactly one ABN.
CREATE MATERIALIZED VIEW IF NOT EXISTS donor_key_abn AS
  SELECT k.nk AS n, min(NULLIF(d.donor_abn, '')) AS abn
  FROM political_donations d
  JOIN donor_name_keys k ON k.donor_name = d.donor_name
  WHERE d.receipt_type = 'donation received' AND NULLIF(d.donor_abn, '') IS NOT NULL
  GROUP BY 1
  HAVING count(DISTINCT NULLIF(d.donor_abn, '')) = 1;

CREATE UNIQUE INDEX IF NOT EXISTS donor_key_abn_n_uidx ON donor_key_abn (n);

CREATE MATERIALIZED VIEW IF NOT EXISTS supplier_key_abn AS
  SELECT k.nk AS n, min(NULLIF(c.supplier_abn, '')) AS abn
  FROM austender_contracts c
  JOIN supplier_name_keys k ON k.supplier_name = c.supplier_name
  WHERE NULLIF(c.supplier_abn, '') IS NOT NULL
    AND c.contract_start >= make_date(2000, 1, 1) AND c.contract_start < make_date(2031, 1, 1)
  GROUP BY 1
  HAVING count(DISTINCT NULLIF(c.supplier_abn, '')) = 1;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_key_abn_n_uidx ON supplier_key_abn (n);

GRANT SELECT ON donor_name_keys, donor_key_abn, supplier_name_keys, supplier_key_abn
  TO anon, authenticated, service_role;

-- Register for the nightly refresh. Without this the drift check flags them as unscheduled
-- matviews, and a new donor or supplier name would never gain a folded key.
INSERT INTO mv_refresh_registry (mv_name, tier, enabled, force_non_concurrent, notes)
VALUES
  ('donor_name_keys',    'nightly', true, false, 'name-key lookup for donation_donor_browse/detail'),
  ('donor_key_abn',      'nightly', true, false, 'single-ABN borrow map; depends on donor_name_keys'),
  ('supplier_name_keys', 'nightly', true, false, 'name-key lookup for contract_supplier_browse/detail'),
  ('supplier_key_abn',   'nightly', true, false, 'single-ABN borrow map; depends on supplier_name_keys')
ON CONFLICT (mv_name) DO UPDATE SET tier = EXCLUDED.tier, enabled = EXCLUDED.enabled, notes = EXCLUDED.notes;
