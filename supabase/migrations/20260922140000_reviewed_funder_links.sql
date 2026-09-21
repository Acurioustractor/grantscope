-- Link 28 funder names to their entities, reviewed by Ben on 2026-09-22.
--
-- Suggested by scripts/jev-entity-match.mjs (#484), confident matches in
-- thoughts/shared/findings/jev-entity-match-2026-09-21.md. Each was put to Ben
-- by name; all 28 approved, including three flagged as doubtful: "City of
-- Melbourne Open Data" -> the council, "NSW Reconstruction Authority" (the
-- successor to Resilience NSW), and Local Land Services (typed company).
-- Entities are named by gs_id; each resolved to exactly one row on 2026-09-22.
--
-- The propagation trigger on funder_entity_links fills funder_entity_id on
-- the 327 matching opportunities. The updated_at and status triggers on
-- alma_funding_opportunities are off for this statement, as in 20260922090000:
-- a key backfill is not an update to the opportunity, and closing past-deadline
-- rows is a separate, undecided call.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922140000_reviewed_funder_links.sql

BEGIN;

ALTER TABLE alma_funding_opportunities
  DISABLE TRIGGER trigger_funding_opportunities_updated,
  DISABLE TRIGGER trigger_funding_status_update;

INSERT INTO funder_entity_links (funder_key, gs_entity_id, link_method)
SELECT v.funder_key, e.id, 'reviewed'
FROM (VALUES
  ('australian renewable energy agency', 'AU-ABN-35931927899'),
  ('brisbane powerhouse foundation', 'AU-ABN-95508371609'),
  ('city of melbourne open data', 'AU-ABN-55370219287'),
  ('department of biodiversity, conservation and attractions', 'AU-ABN-38052249024'),
  ('dusseldorp forum', 'AU-ABN-25269392713'),
  ('foundation for rural & regional renewal', 'AU-ABN-27091810589'),
  ('foundation for rural & regional renewal (frrr)', 'AU-ABN-27091810589'),
  ('gold coast community fund', 'AU-ABN-47014082140'),
  ('homeland school company', 'AU-ABN-90668321088'),
  ('ininti store trust', 'AU-ABN-60089186629'),
  ('just reinvest nsw', 'AU-ABN-37751526982'),
  ('lord mayor''s charitable foundation', 'AU-ABN-48042414556'),
  ('mala’la health service aboriginal corporation', 'AU-ABN-89357836457'),
  ('nsw government — department of communities and justice', 'AU-GOV-adf83f6717d370fcb08ea2d8d6192d76'),
  ('nsw government — environment protection authority', 'AU-GOV-34b444cae34a626f3ef2373690b953d5'),
  ('nsw government — local land services', 'AU-ABN-57876455969'),
  ('nsw government — nsw reconstruction authority', 'AU-GOV-f780df3380b192dc89e03e0fa0bd689a'),
  ('nsw government — office of sport', 'AU-GOV-7c1f7c510f2e77f4d0d4434050b3c7cb'),
  ('nsw government — transport for nsw', 'AU-ABN-18804239602'),
  ('palm island community company limited (picc)', 'AU-ABN-14640793728'),
  ('paul ramsay foundation', 'AU-ABN-32623132472'),
  ('reconciliation australia', 'AU-ABN-76092919769'),
  ('the arches foundation', 'AU-ABN-85662414977'),
  ('the mercy foundation', 'AU-ABN-49051253902'),
  ('tim fairfax family foundation', 'AU-ABN-62124526760'),
  ('veski', 'AU-ABN-93104711275'),
  ('visit victoria', 'AU-ABN-37611725270'),
  ('wales family foundation', 'AU-ABN-91540596804')
) AS v(funder_key, gs_id)
JOIN gs_entities e ON e.gs_id = v.gs_id
ON CONFLICT (funder_key) DO NOTHING;

ALTER TABLE alma_funding_opportunities
  ENABLE TRIGGER trigger_funding_opportunities_updated,
  ENABLE TRIGGER trigger_funding_status_update;

COMMIT;
