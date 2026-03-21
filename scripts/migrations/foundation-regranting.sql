-- foundation-regranting.sql
-- Trace the regranting chain: Foundation A → Regranter B → Charity C
-- A regranter is a grantee that is itself a foundation (appears in both foundations table and as a grantee)

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_regranting;
CREATE MATERIALIZED VIEW mv_foundation_regranting AS
WITH regranters AS (
  -- Grantees that are themselves foundations (they receive AND give grants)
  SELECT DISTINCT
    fg.grantee_abn as regranter_abn,
    fg.grantee_name as regranter_name,
    f2.id as regranter_foundation_id,
    f2.total_giving_annual as regranter_giving,
    f2.type as regranter_type
  FROM mv_foundation_grantees fg
  JOIN foundations f2 ON f2.acnc_abn = fg.grantee_abn
  WHERE fg.grantee_abn IS NOT NULL
),
-- Chain: source foundation → regranter → ultimate grantee
chains AS (
  SELECT
    fg1.foundation_name as source_foundation,
    fg1.foundation_abn as source_abn,
    fg1.total_giving_annual as source_giving,
    r.regranter_name,
    r.regranter_abn,
    r.regranter_giving,
    r.regranter_type,
    fg2.grantee_name as ultimate_grantee,
    fg2.grantee_abn as ultimate_grantee_abn,
    fg2.grant_amount as downstream_amount,
    fg2.grant_year as downstream_year
  FROM mv_foundation_grantees fg1
  JOIN regranters r ON r.regranter_abn = fg1.grantee_abn
  JOIN mv_foundation_grantees fg2 ON fg2.foundation_abn = r.regranter_abn
  WHERE fg1.foundation_abn != fg2.grantee_abn  -- no self-loops
)
SELECT
  source_foundation,
  source_abn,
  source_giving::bigint,
  regranter_name,
  regranter_abn,
  regranter_giving::bigint,
  regranter_type,
  ultimate_grantee,
  ultimate_grantee_abn,
  downstream_amount::bigint,
  downstream_year,
  -- Chain label for display
  source_foundation || ' → ' || regranter_name || ' → ' || ultimate_grantee as chain_label
FROM chains
ORDER BY source_giving DESC NULLS LAST, regranter_giving DESC NULLS LAST;

CREATE INDEX ON mv_foundation_regranting (source_abn);
CREATE INDEX ON mv_foundation_regranting (regranter_abn);
CREATE INDEX ON mv_foundation_regranting (ultimate_grantee_abn);
