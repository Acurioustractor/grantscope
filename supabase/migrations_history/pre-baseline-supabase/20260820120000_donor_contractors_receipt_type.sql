-- mv_gs_donor_contractors counts party fundraising income as political donations
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260820120000_donor_contractors_receipt_type.sql
--
-- WHY
--
-- /reports/donor-contractors went live on 2026-08-20 (after #339 un-blanked the report pages)
-- claiming "they donated $31.3B to 1073 political parties". Both figures are wrong, and both come
-- from the same place.
--
-- The graph's donation edges are built in scripts/lib/graph-edge-datasets.mjs from every row of
-- `political_donations`, with NO `receipt_type` filter. Measured on the edges themselves:
--
--     other receipt        797,404 edges   108.62 bn      <- party fundraising, transfers, levies
--     donation received    184,078 edges    17.32 bn      <- the actual donations
--     (null)               103,887 edges     6.85 bn
--     subscription          17,813 edges     1.20 bn
--     unspecified           27,237 edges     0.94 bn
--     public funding         1,435 edges     0.35 bn
--
-- Real donations are 12.8% of the dollars. The `donation` relationship type is 87% not-donations.
--
-- The builder already writes `receipt_type` into each edge's `properties` JSONB, so the truth was
-- recorded per-edge all along and simply never read. This filters on it.
--
-- SCOPE, deliberately narrow
--
-- Six other matviews read `relationship_type = 'donation'` and inherit the same inflation:
-- mv_entity_power_index, mv_entity_total_funding, mv_funding_by_lga, mv_funding_by_postcode,
-- mv_intervention_funding_chain, mv_revolving_door. They are NOT touched here — each needs its
-- own measurement, and one migration redefining seven views is not a change anyone can review.
--
-- The better fix is upstream: filter in the edge builder so nothing downstream has to remember.
-- That drops ~950K edges and forces a rebuild, so it is a separate, deliberate decision. Filtering
-- per-consumer is exactly how the justice_funding filters came to be missing from 98 of 100 files,
-- and this migration is an instance of that pattern, chosen for blast radius, not because it is
-- right in principle.
--
-- NOT FIXED HERE: `gs_entities` holds 2,365 rows typed `political_party`, built from
-- SELECT DISTINCT donation_to with no resolution. They include state branches, electorate
-- committees, fundraising lunches ("LNP-QLD (Sportsman's Lunch 2014)") and clubs. Australia has
-- roughly 50 registered parties. So donations to one party are fragmented across dozens of
-- entities, every per-party total understates, and any count of "political parties" is fiction.
-- Party resolution is its own piece of work.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_gs_donor_contractors;

CREATE MATERIALIZED VIEW mv_gs_donor_contractors AS
 SELECT e.id,
    e.gs_id,
    e.canonical_name,
    e.entity_type,
    e.abn,
    e.sector,
    e.state,
    d.total_donated,
    d.donation_count,
    d.parties_donated_to,
    d.donation_years,
    c.total_contract_value,
    c.contract_count,
    c.government_buyers,
    c.contract_years
   FROM ((gs_entities e
     JOIN ( SELECT r.source_entity_id,
            sum(r.amount) AS total_donated,
            count(*) AS donation_count,
            array_agg(DISTINCT t.canonical_name) AS parties_donated_to,
            array_agg(DISTINCT r.year ORDER BY r.year) FILTER (WHERE (r.year IS NOT NULL)) AS donation_years
           FROM (gs_relationships r
             JOIN gs_entities t ON ((r.target_entity_id = t.id)))
          WHERE ((r.relationship_type = 'donation'::text) AND (r.amount > (0)::numeric)
             -- THE FIX. Without it this sums party fundraising income as donations.
             AND (r.properties ->> 'receipt_type') = 'donation received')
          GROUP BY r.source_entity_id) d ON ((e.id = d.source_entity_id)))
     JOIN ( SELECT r.target_entity_id,
            sum(r.amount) AS total_contract_value,
            count(*) AS contract_count,
            array_agg(DISTINCT s.canonical_name) AS government_buyers,
            array_agg(DISTINCT r.year ORDER BY r.year) FILTER (WHERE (r.year IS NOT NULL)) AS contract_years
           FROM (gs_relationships r
             JOIN gs_entities s ON ((r.source_entity_id = s.id)))
          WHERE ((r.relationship_type = 'contract'::text) AND (r.amount > (0)::numeric))
          GROUP BY r.target_entity_id) c ON ((e.id = c.target_entity_id)))
  ORDER BY d.total_donated DESC;

-- Unique index is required for REFRESH MATERIALIZED VIEW CONCURRENTLY, not just for lookups.
CREATE UNIQUE INDEX idx_mv_gs_dc_id ON public.mv_gs_donor_contractors USING btree (id);

-- Grants do NOT survive a DROP. Restoring exactly what pg_class.relacl held before:
--   {postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres, agent_readonly=r/postgres}
-- Missing these is the 2026-08-06 gotcha: the view reads as silently empty rather than erroring.
GRANT ALL ON mv_gs_donor_contractors TO service_role;
GRANT SELECT ON mv_gs_donor_contractors TO agent_readonly;

COMMIT;

-- MEASURED before applying, by running the new definition as a read-only SELECT:
--
--                                        before        after
--   entities in the view                  2,065          556
--   total_donated                     31.50 bn      0.86 bn
--   total_contract_value             464.90 bn    216.20 bn
--
-- 1,509 of the 2,065 "donor-contractors" never donated at all — their only receipts were
-- 'other receipt'. The report built on this view opens "1000 entities in Australia donate to
-- political parties AND hold government contracts". The real number is 556, and the money they
-- donated is 0.86 bn, not the 31.3 bn the page published.
--
-- Contracts fall too, from 464.9 to 216.2 bn, because the SET shrinks — per-entity contract
-- values are untouched.
--
-- Verify after applying:
--   SELECT count(*) AS rows, round(sum(total_donated)/1e9,2) AS donated_bn
--     FROM mv_gs_donor_contractors;
-- Expect 556 and 0.86.
