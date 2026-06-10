-- Goods on Country — Life-event signals ("reasons to reach out").
-- Slice 5 (life-event cards half) of the governance + relationship-intelligence
-- layer. For every entity-linked Goods relationship, surface the most recent
-- salient event from the public-record feeds we already hold: a fresh ACNC
-- annual filing, a new government contract, or recent justice funding. Each row
-- is a candidate "reason to reach out now"; ranking + card copy happen in the
-- pure presenter (goods-life-events-shared.ts).
--
-- This is the moat: we own these feeds. No new ingestion, no email, no privacy
-- weight. Honest by construction — every figure traces to a dated source row.
--
-- Shape is shared across the three feed CTEs so they UNION cleanly:
--   rel_id, display_name, relationship_type, warmth_display,
--   kind, event_date, event_fy, amount, amount2, period_to, label
-- amount2/period_to/label carry feed-specific extras (gov share, contract end,
-- buyer / program), left NULL where a feed has none.

CREATE OR REPLACE VIEW v_goods_life_events AS
WITH supporters AS (
  SELECT gr.id AS rel_id,
         gr.display_name,
         gr.relationship_type,
         gr.warmth_display,
         e.abn
  FROM goods_relationships gr
  JOIN gs_entities e ON e.id = gr.entity_id
  WHERE gr.entity_id IS NOT NULL
    AND e.abn IS NOT NULL
),
acnc AS (
  SELECT s.rel_id, s.display_name, s.relationship_type, s.warmth_display,
         'acnc_filing'::text         AS kind,
         a.date_ais_received          AS event_date,
         a.ais_year::text             AS event_fy,
         a.total_revenue              AS amount,
         a.revenue_from_government    AS amount2,
         a.fin_report_to              AS period_to,
         NULL::text                   AS label
  FROM supporters s
  JOIN LATERAL (
    SELECT m.date_ais_received, m.ais_year, m.total_revenue,
           m.revenue_from_government, m.fin_report_to
    FROM mv_acnc_latest m
    WHERE m.abn = s.abn
    ORDER BY m.date_ais_received DESC NULLS LAST
    LIMIT 1
  ) a ON true
  WHERE a.date_ais_received IS NOT NULL
),
contracts AS (
  SELECT s.rel_id, s.display_name, s.relationship_type, s.warmth_display,
         'gov_contract'::text  AS kind,
         c.contract_start       AS event_date,
         NULL::text             AS event_fy,
         c.contract_value       AS amount,
         NULL::numeric          AS amount2,
         c.contract_end         AS period_to,
         c.buyer_name           AS label
  FROM supporters s
  JOIN LATERAL (
    SELECT ac.contract_start, ac.contract_value, ac.contract_end, ac.buyer_name
    FROM austender_contracts ac
    WHERE ac.supplier_abn = s.abn
    ORDER BY ac.contract_start DESC NULLS LAST
    LIMIT 1
  ) c ON true
  WHERE c.contract_start IS NOT NULL
),
justice AS (
  SELECT s.rel_id, s.display_name, s.relationship_type, s.warmth_display,
         'justice_funding'::text AS kind,
         NULL::date               AS event_date,
         j.financial_year         AS event_fy,
         j.amount                 AS amount,
         NULL::numeric            AS amount2,
         NULL::date               AS period_to,
         j.program_name           AS label
  FROM supporters s
  JOIN LATERAL (
    SELECT jf.financial_year,
           SUM(jf.amount_dollars) AS amount,
           MAX(jf.program_name)   AS program_name
    FROM justice_funding jf
    WHERE jf.recipient_abn = s.abn
      AND jf.financial_year IS NOT NULL
    GROUP BY jf.financial_year
    ORDER BY jf.financial_year DESC
    LIMIT 1
  ) j ON true
)
SELECT rel_id, display_name, relationship_type, warmth_display,
       kind, event_date, event_fy, amount, amount2, period_to, label
FROM acnc
UNION ALL
SELECT rel_id, display_name, relationship_type, warmth_display,
       kind, event_date, event_fy, amount, amount2, period_to, label
FROM contracts
UNION ALL
SELECT rel_id, display_name, relationship_type, warmth_display,
       kind, event_date, event_fy, amount, amount2, period_to, label
FROM justice;

COMMENT ON VIEW v_goods_life_events IS
  'Goods: most-recent public-record event per entity-linked supporter (ACNC filing, gov contract, justice funding) as "reasons to reach out". Ranking + copy in goods-life-events-shared.ts.';
