-- CLASSIE taxonomy tags on grant_opportunities.
--
-- CLASSIE (Our Community's Classification of Social Sector Initiatives and
-- Entities) is the de-facto AU social-sector taxonomy used by ACNC,
-- SmartyGrants and the Funding Centre. Tagging grants against its three facets
-- (Subject, Population, UN SDG) makes our data interoperable with that ecosystem
-- and gives better filtering than the home-grown `categories` array.
--
-- The tags are populated by scripts/classify-grants-classie.mjs — deterministically
-- from existing categories (zero cost), with an optional LLM pass for the gaps.

ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS classie_subjects    text[],
  ADD COLUMN IF NOT EXISTS classie_populations text[],
  ADD COLUMN IF NOT EXISTS sdg_codes           text[],
  ADD COLUMN IF NOT EXISTS classie_method      text,        -- 'category_map' | 'llm' | 'manual'
  ADD COLUMN IF NOT EXISTS classie_classified_at timestamptz;

-- GIN indexes so CLASSIE facets are cheap to filter on.
CREATE INDEX IF NOT EXISTS grant_opportunities_classie_subjects_idx
  ON grant_opportunities USING gin (classie_subjects);
CREATE INDEX IF NOT EXISTS grant_opportunities_classie_populations_idx
  ON grant_opportunities USING gin (classie_populations);
CREATE INDEX IF NOT EXISTS grant_opportunities_sdg_codes_idx
  ON grant_opportunities USING gin (sdg_codes);
