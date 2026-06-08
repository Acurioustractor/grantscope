-- P2-1: keep evidence-led ranking, make the match LEGIBLE.
--
-- Pass-2 buyer-flow audit found that searching e.g. "beds" tops the list with
-- proven contractors whose AusTender contract TITLES contain "bed" (bed-dwellings
-- = remote housing) — correct per the "ranked by what they delivered" thesis —
-- while actual bed-furniture suppliers, matched only in their description, look
-- like weak noise at the bottom. Measured cause: a contract-title (weight A) hit
-- scores ~1.0 vs ~0.2 for a description (weight C) hit, BEFORE any boost; and all
-- description hits score identically, so FTS can't tell "Bed + Bath" from
-- "garden beds". Pure ranking can't separate on-need from off-need.
--
-- Decision (Ben): keep proven deliverers on top, but return WHY each row matched
-- (capability = delivered contracts / offering = name+sectors / description) plus
-- a highlighted snippet, so the buyer judges relevance themselves. Also switch the
-- tier/evidence boosts from additive to multiplicative so evidence AMPLIFIES a
-- relevant match instead of additively injecting a low-relevance high-evidence one
-- (browse mode — empty query — still ranks purely by evidence).

DROP FUNCTION IF EXISTS search_suppliers(text, text, int);

CREATE FUNCTION search_suppliers(p_q text DEFAULT '', p_state text DEFAULT '', p_limit int DEFAULT 30)
RETURNS TABLE (
  se_id uuid, name text, abn text, state text, city text,
  sectors text[], description text, source_primary text,
  verification_tier text, contract_count int, contract_value numeric,
  last_contract_end date, buyer_count int, rank real,
  match_source text, match_snippet text
)
LANGUAGE sql STABLE
AS $$
  WITH q AS (
    SELECT CASE WHEN trim(coalesce(p_q, '')) = '' THEN NULL
                ELSE websearch_to_tsquery('english', p_q) END AS tsq
  ),
  ranked AS (
    SELECT
      s.se_id, s.name, s.abn, s.state, s.city,
      s.sectors, s.description, s.source_primary,
      s.verification_tier, s.contract_count, s.contract_value,
      s.last_contract_end, s.buyer_count,
      s.capability_text, s.sectors_text,
      (
        -- search mode: relevance is the spine; tier + delivery evidence AMPLIFY it
        coalesce(ts_rank_cd(s.search_tsv, (SELECT tsq FROM q)), 0)
        * (1
           + CASE s.verification_tier WHEN 'certified' THEN 0.20 WHEN 'verified' THEN 0.10 ELSE 0 END
           + least(s.contract_count, 50)::real / 50.0 * 0.30)
        -- browse mode (empty query): rank purely by evidence (relevance term is 0)
        + CASE WHEN (SELECT tsq FROM q) IS NULL THEN
              (CASE s.verification_tier WHEN 'certified' THEN 0.10 WHEN 'verified' THEN 0.05 ELSE 0 END
               + least(s.contract_count, 50)::real / 50.0 * 0.15)
          ELSE 0 END
      )::real AS rank
    FROM se_search_index s
    WHERE ((SELECT tsq FROM q) IS NULL OR s.search_tsv @@ (SELECT tsq FROM q))
      AND (trim(coalesce(p_state, '')) = '' OR s.state = upper(p_state))
    ORDER BY rank DESC, s.contract_value DESC, s.name
    LIMIT greatest(1, least(p_limit, 100))
  )
  -- snippet/source computed only on the limited set (ts_headline is not cheap)
  SELECT
    r.se_id, r.name, r.abn, r.state, r.city,
    r.sectors, r.description, r.source_primary,
    r.verification_tier, r.contract_count, r.contract_value,
    r.last_contract_end, r.buyer_count, r.rank,
    CASE
      WHEN (SELECT tsq FROM q) IS NULL THEN NULL
      WHEN to_tsvector('english', coalesce(r.capability_text, '')) @@ (SELECT tsq FROM q) THEN 'capability'
      WHEN to_tsvector('english', coalesce(r.name, '') || ' ' || coalesce(r.sectors_text, '')) @@ (SELECT tsq FROM q) THEN 'offering'
      WHEN to_tsvector('english', coalesce(r.description, '')) @@ (SELECT tsq FROM q) THEN 'description'
      ELSE NULL
    END AS match_source,
    CASE
      WHEN (SELECT tsq FROM q) IS NULL THEN NULL
      WHEN to_tsvector('english', coalesce(r.capability_text, '')) @@ (SELECT tsq FROM q)
        THEN ts_headline('english', r.capability_text, (SELECT tsq FROM q),
             'StartSel=«, StopSel=», MaxFragments=1, MaxWords=14, MinWords=3, FragmentDelimiter= … ')
      WHEN to_tsvector('english', coalesce(r.name, '') || ' ' || coalesce(r.sectors_text, '')) @@ (SELECT tsq FROM q)
        THEN NULL  -- name + sectors already shown on the card
      WHEN to_tsvector('english', coalesce(r.description, '')) @@ (SELECT tsq FROM q)
        THEN ts_headline('english', r.description, (SELECT tsq FROM q),
             'StartSel=«, StopSel=», MaxFragments=1, MaxWords=16, MinWords=4, FragmentDelimiter= … ')
      ELSE NULL
    END AS match_snippet
  FROM ranked r
  ORDER BY r.rank DESC, r.contract_value DESC, r.name;
$$;
