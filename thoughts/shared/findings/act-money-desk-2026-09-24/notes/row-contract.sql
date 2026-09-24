WITH projects AS (
  SELECT * FROM (VALUES
    ('goods',          'ACT-GD', ARRAY['pty','butterfly'], false, ARRAY['NT','QLD','WA'], NULL::text),
    ('justicehub',     'ACT-JH', ARRAY['pty','akt'],       true,  ARRAY[]::text[],        NULL),
    ('empathy-ledger', 'ACT-EL', ARRAY['pty','butterfly'], true,  ARRAY[]::text[],        NULL),
    ('harvest',        'ACT-HV', ARRAY['pty','butterfly'], false, ARRAY[]::text[],        'Sunshine Coast'),
    ('farm',           'ACT-FM', ARRAY['pty','butterfly'], false, ARRAY[]::text[],        'Sunshine Coast'),
    ('contained',      'ACT-CN', ARRAY['pty','butterfly'], true,  ARRAY[]::text[],        NULL)
  ) AS p(slug, code, entities, national, states, lga)
),
pool AS (
  SELECT 'public'::text AS origin, g.id, g.name, g.provider, g.source, g.url, g.status,
         coalesce(g.closes_at, g.deadline) AS closes_at, g.amount_min, g.amount_max,
         nullif(trim(g.geography), '') AS geography, g.metadata->'place' AS place,
         coalesce(g.aligned_projects, '{}') AS aligned_projects,
         g.goods_relevance_score, g.goods_relevance_signals, coalesce(g.project_relevance, '{}'::jsonb) AS project_relevance,
         g.dgr_required, g.accepts_pty_ltd, g.ghl_opportunity_id
  FROM grant_opportunities g
  WHERE g.status IN ('open','ongoing','upcoming')
  UNION ALL
  SELECT 'act-private', r.id, r.name, r.provider, r.source, r.url, r.status,
         coalesce(r.closes_at, r.deadline), r.amount_min, r.amount_max,
         nullif(trim(r.geography), ''), r.metadata->'place',
         coalesce(r.aligned_projects, '{}'),
         r.goods_relevance_score, r.goods_relevance_signals, '{}'::jsonb,
         NULL::boolean, NULL::boolean, NULL::text
  FROM act_private_grant_rounds r
  WHERE r.status IN ('open','ongoing','upcoming')
),
live AS (
  SELECT p.*,
         ARRAY(SELECT regexp_replace(upper(trim(t)), '^AU-', '') FROM unnest(string_to_array(coalesce(p.geography,''), ',')) t) AS geo_tokens
  FROM pool p
  WHERE p.closes_at IS NULL OR p.closes_at >= CURRENT_DATE
),
placed AS (
  SELECT l.*,
         (l.place->>'national')::boolean IS TRUE OR 'NATIONAL' = ANY(l.geo_tokens) AS g_national,
         l.place->>'lga_name' AS g_lga,
         CASE WHEN l.place->>'state' IS NOT NULL THEN ARRAY[upper(l.place->>'state')]
              ELSE ARRAY(SELECT t FROM unnest(l.geo_tokens) t WHERE t IN ('NSW','VIC','QLD','WA','SA','TAS','NT','ACT')) END AS g_states
  FROM live l
),
rows_ AS (
  SELECT
    pl.origin, pl.id AS grant_id, pl.name, pl.provider AS funder, pl.source, pl.url,
    pr.slug AS project, pr.code AS project_code,
    CASE WHEN pr.slug = 'goods' THEN pl.goods_relevance_score
         ELSE (pl.project_relevance->pr.slug->>'score')::int END                                   AS fit_keyword,
    (pl.project_relevance->pr.slug->'rubric'->>'score')::numeric                                     AS fit_jev,
    (pl.project_relevance->pr.slug->'rubric'->>'confidence')::numeric                                AS fit_jev_confidence,
    CASE WHEN pr.slug = 'goods' THEN pl.goods_relevance_signals->>'tagged_by'
         ELSE pl.project_relevance->pr.slug->>'tagged_by' END                                        AS tagged_by,
    pr.code = ANY(pl.aligned_projects)                                                               AS tagged,
    pl.closes_at, pl.closes_at - CURRENT_DATE                                                        AS days_to_close,
    pl.amount_min, pl.amount_max,
    -- entity verdicts: act-grant-eligibility.ts entityVerdict() L81-86
    CASE WHEN pl.dgr_required IS TRUE THEN 'no'
         WHEN pl.accepts_pty_ltd IS NOT NULL THEN CASE WHEN pl.accepts_pty_ltd THEN 'yes' ELSE 'no' END
         ELSE 'unknown' END                                                                          AS pty_can_apply,
    CASE WHEN pl.dgr_required IS TRUE THEN 'yes' ELSE 'unknown' END                                  AS butterfly_can_apply,
    CASE WHEN pl.dgr_required IS TRUE THEN 'no'  ELSE 'unknown' END                                  AS akt_can_apply,
    -- place label
    coalesce(pl.g_lga, CASE WHEN pl.g_national THEN 'National' END, array_to_string(pl.g_states, ','), pl.geography) AS place_label,
    -- location verdict: act-grant-eligibility.ts locationVerdict() L65-78
    CASE WHEN pl.place IS NULL AND NOT pl.g_national AND cardinality(pl.g_states) = 0 THEN 'unknown'
         WHEN pl.g_national THEN 'yes'
         WHEN pl.g_lga IS NOT NULL THEN
              CASE WHEN pr.lga IS NOT NULL AND lower(pl.g_lga) LIKE '%' || lower(pr.lga) || '%' THEN 'yes'
                   WHEN pr.national THEN 'unknown' ELSE 'no' END
         WHEN pl.g_states && (pr.states || CASE WHEN pr.lga IS NOT NULL THEN ARRAY['QLD'] ELSE ARRAY[]::text[] END) THEN 'yes'
         WHEN pr.national THEN 'unknown' ELSE 'no' END                                               AS location,
    pl.ghl_opportunity_id IS NOT NULL                                                                AS in_ghl,
    pl.ghl_opportunity_id,
    pr.entities
  FROM placed pl CROSS JOIN projects pr
),
contract AS (
  SELECT r.*,
    -- overall: act-grant-eligibility.ts projectEligibility() L103-105
    CASE WHEN r.location = 'no'
           OR NOT EXISTS (SELECT 1 FROM unnest(r.entities) e
                          WHERE (e='pty' AND r.pty_can_apply <> 'no') OR (e='butterfly' AND r.butterfly_can_apply <> 'no') OR (e='akt' AND r.akt_can_apply <> 'no'))
         THEN 'no'
         WHEN r.location = 'yes'
           AND EXISTS (SELECT 1 FROM unnest(r.entities) e
                       WHERE (e='pty' AND r.pty_can_apply = 'yes') OR (e='butterfly' AND r.butterfly_can_apply = 'yes') OR (e='akt' AND r.akt_can_apply = 'yes'))
         THEN 'yes' ELSE 'unknown' END AS can_apply
  FROM rows_ r
)
