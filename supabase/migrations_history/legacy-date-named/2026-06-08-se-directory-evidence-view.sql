-- P2-2: give the /social-enterprises directory the same evidence the /suppliers
-- search has. Today the directory queries social_enterprises directly and shows
-- category + source badges only — no delivery evidence, no evidence sort, default
-- Name A-Z — so the browse path strips the "ranked by what they delivered" thesis.
--
-- se_directory: a thin (non-materialized) view that LEFT JOINs each enterprise to
-- its se_search_index evidence (contract_count/value, verification_tier) and the
-- triple-proof / proven-outcomes flags. 1:1 with social_enterprises (se_id = id),
-- so the LEFT JOINs never drop or duplicate rows; the triple-proof join is deduped
-- on abn so a duplicate matview row can't inflate directory counts. Non-materialized
-- = always live, no refresh burden (the directory is ~12k rows; the join is cheap).

CREATE OR REPLACE VIEW se_directory AS
SELECT
  e.id, e.name, e.abn, e.org_type, e.legal_structure, e.description, e.website,
  e.state, e.city, e.postcode, e.sector, e.certifications, e.source_primary,
  e.target_beneficiaries, e.logo_url, e.business_model, e.profile_confidence,
  e.enriched_at, e.created_at,
  coalesce(si.contract_count, 0)  AS contract_count,
  coalesce(si.contract_value, 0)  AS contract_value,
  si.verification_tier,
  (tp.abn IS NOT NULL)            AS triple_proof,
  coalesce(tp.has_alma_evidence_outcomes, false) AS proven_outcomes
FROM social_enterprises e
LEFT JOIN se_search_index si ON si.se_id = e.id
LEFT JOIN (
  SELECT DISTINCT ON (abn) abn, has_alma_evidence_outcomes
  FROM mv_triple_proof_suppliers
  WHERE abn IS NOT NULL
) tp ON tp.abn = e.abn;
