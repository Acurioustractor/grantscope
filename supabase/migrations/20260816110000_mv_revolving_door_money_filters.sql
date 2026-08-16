-- mv_revolving_door: apply the two mandatory money filters (fix #1 from the money-views audit)
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816110000_mv_revolving_door_money_filters.sql
--
-- WHY. Audit thoughts/shared/data-map/unfiltered-money-views-audit.md, measured live:
-- TOTAL RPA ($4.74bn — a spreadsheet total row with an ABN) and QUEENSLAND RAIL ($4.10bn of
-- transport contracts labelled grants) sit in total_funded; whole-of-state departments at $10bn+.
-- 19 app files read this matview and revolving_door_score is a RANKING: the unfiltered donates
-- flag carries weight 3 and the donation thresholds add up to 3 more, so 'other receipt' rows
-- (72% of AEC rows, not donations) reorder who the system calls captured.
--
-- Baselines before (verify the direction after): 6,988 rows · donates 2,420 · receives_funding
-- 5,009 · total_donated $21.08bn · total_funded $50.54bn. Every entity that drops out is an
-- artifact of budget rows, aggregate rows, or non-donation receipts.
--
-- Definition captured live via pg_get_viewdef; only the two CTE WHERE clauses are edited.
-- One dependent (v_goods_relationship_power) is dropped by the CASCADE and recreated verbatim
-- from its live definition, with its four grants — the Goods chips render empty without them.

BEGIN;

DROP MATERIALIZED VIEW public.mv_revolving_door CASCADE;

CREATE MATERIALIZED VIEW public.mv_revolving_door AS
 WITH lobbyists AS (
         SELECT DISTINCT COALESCE(r.source_entity_id, r.target_entity_id) AS entity_id
           FROM gs_relationships r
          WHERE r.relationship_type = 'lobbies_for'::text
        ), donors AS (
         SELECT ge_1.id AS entity_id,
            count(*) AS donation_count,
            sum(pd.amount) AS total_donated,
            array_agg(DISTINCT pd.donation_to ORDER BY pd.donation_to) AS parties
           FROM political_donations pd
             JOIN gs_entities ge_1 ON ge_1.abn = pd.donor_abn
          WHERE pd.donor_abn IS NOT NULL AND pd.receipt_type = 'donation received'
          GROUP BY ge_1.id
        ), contractors AS (
         SELECT ge_1.id AS entity_id,
            count(*) AS contract_count,
            sum(ac.contract_value) AS total_contracts,
            count(DISTINCT ac.buyer_name) AS distinct_buyers
           FROM austender_contracts ac
             JOIN gs_entities ge_1 ON ge_1.abn = ac.supplier_abn
          WHERE ac.supplier_abn IS NOT NULL
          GROUP BY ge_1.id
        ), funded AS (
         SELECT justice_funding.gs_entity_id AS entity_id,
            count(*) AS funding_count,
            sum(justice_funding.amount_dollars) AS total_funded
           FROM justice_funding
          WHERE justice_funding.gs_entity_id IS NOT NULL
            AND justice_funding.measure_kind = 'grant'
            AND justice_funding.is_aggregate IS NOT TRUE
            AND lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])
          GROUP BY justice_funding.gs_entity_id
        )
 SELECT ge.id,
    ge.gs_id,
    ge.canonical_name,
    ge.entity_type,
    ge.abn,
    ge.state,
    ge.lga_name,
    ge.is_community_controlled,
    l.entity_id IS NOT NULL AS lobbies,
    d.entity_id IS NOT NULL AS donates,
    c.entity_id IS NOT NULL AS contracts,
    f.entity_id IS NOT NULL AS receives_funding,
    (l.entity_id IS NOT NULL)::integer + (d.entity_id IS NOT NULL)::integer + (c.entity_id IS NOT NULL)::integer + (f.entity_id IS NOT NULL)::integer AS influence_vectors,
    COALESCE(d.total_donated, 0::numeric) AS total_donated,
    COALESCE(d.donation_count, 0::bigint) AS donation_count,
    d.parties AS parties_funded,
    COALESCE(c.total_contracts, 0::numeric) AS total_contracts,
    COALESCE(c.contract_count, 0::bigint) AS contract_count,
    COALESCE(c.distinct_buyers, 0::bigint) AS distinct_buyers,
    COALESCE(f.total_funded, 0::numeric) AS total_funded,
    COALESCE(f.funding_count, 0::bigint) AS funding_count,
    (l.entity_id IS NOT NULL)::integer * 5 + (d.entity_id IS NOT NULL)::integer * 3 + (c.entity_id IS NOT NULL)::integer * 2 + (f.entity_id IS NOT NULL)::integer * 1 +
        CASE
            WHEN COALESCE(d.total_donated, 0::numeric) > 100000::numeric THEN 3
            WHEN COALESCE(d.total_donated, 0::numeric) > 10000::numeric THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(c.total_contracts, 0::numeric) > 10000000::numeric THEN 3
            WHEN COALESCE(c.total_contracts, 0::numeric) > 1000000::numeric THEN 1
            ELSE 0
        END + LEAST(array_length(d.parties, 1), 5) AS revolving_door_score
   FROM gs_entities ge
     LEFT JOIN lobbyists l ON l.entity_id = ge.id
     LEFT JOIN donors d ON d.entity_id = ge.id
     LEFT JOIN contractors c ON c.entity_id = ge.id
     LEFT JOIN funded f ON f.entity_id = ge.id
  WHERE ((l.entity_id IS NOT NULL)::integer + (d.entity_id IS NOT NULL)::integer + (c.entity_id IS NOT NULL)::integer + (f.entity_id IS NOT NULL)::integer) >= 2;

CREATE UNIQUE INDEX mv_revolving_door_pk ON public.mv_revolving_door USING btree (id);
CREATE INDEX idx_revolving_door_score ON public.mv_revolving_door USING btree (revolving_door_score DESC);
CREATE INDEX idx_revolving_door_vectors ON public.mv_revolving_door USING btree (influence_vectors DESC);
CREATE INDEX idx_revolving_door_entity_type ON public.mv_revolving_door USING btree (entity_type);
GRANT ALL ON public.mv_revolving_door TO service_role;
GRANT SELECT ON public.mv_revolving_door TO agent_readonly;

COMMENT ON MATERIALIZED VIEW public.mv_revolving_door IS
  'Entities with 2+ influence vectors (lobbies/donates/contracts/receives funding). Money filters '
  'applied 2026-08-16: receipt_type=''donation received'' on donations; measure_kind/is_aggregate/'
  'recipient-name on justice_funding grants. See thoughts/shared/data-map/unfiltered-money-views-audit.md';

-- dependent, recreated verbatim -------------------------------------------------------------------
CREATE VIEW public.v_goods_relationship_power AS
 SELECT gr.id AS rel_id,
    gr.entity_id,
    gr.display_name,
    gr.relationship_type,
    COALESCE(gr.warmth_display, 0) AS warmth_display,
    pi.power_score,
    pi.system_count,
    pi.in_procurement,
    pi.in_recorded_grants AS in_justice_funding,
    pi.in_political_donations,
    pi.in_charity_registry,
    pi.in_foundation,
    pi.in_alma_evidence,
    pi.in_ato_transparency,
    pi.total_dollar_flow,
    pi.foundation_giving,
    rd.influence_vectors,
    rd.revolving_door_score,
    rd.lobbies,
    rd.donates,
    rd.contracts,
    rd.receives_funding
   FROM goods_relationships gr
     LEFT JOIN mv_entity_power_index pi ON pi.id = gr.entity_id
     LEFT JOIN mv_revolving_door rd ON rd.id = gr.entity_id
  WHERE gr.entity_id IS NOT NULL AND (pi.id IS NOT NULL OR rd.id IS NOT NULL);
GRANT SELECT ON public.v_goods_relationship_power TO anon;
GRANT SELECT ON public.v_goods_relationship_power TO authenticated;
GRANT SELECT ON public.v_goods_relationship_power TO service_role;
GRANT SELECT ON public.v_goods_relationship_power TO agent_readonly;

COMMIT;
