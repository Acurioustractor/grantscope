-- Slice 4: the noun column — rules propose, a human confirms, unfiled is the progress bar.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-clarity-noun.sql
--
-- Three columns, three different strengths of claim:
--   noun           the FILED noun. Only two writers: this backfill (mirroring the hand-written
--                  DOMAIN_TO_NOUN table in apps/web/src/app/clarity/nouns.ts, which shipped with
--                  slice 3 as deliberate curation) and a human via /api/clarity/nouns.
--   noun_source    which of those two wrote it ('domain_rule' | 'human').
--   noun_proposed  a rule's guess for the unfiled, shown ONLY on the adjudication surface.
--                  A proposal never files an object — the index renders noun IS NULL as
--                  Unfiled regardless of what is proposed.
--
-- The index reads the COLUMN after this, not the domain mapping at render time: filing becomes
-- data with provenance instead of a function call, and a human confirmation survives a domain
-- re-catalogue.

BEGIN;

ALTER TABLE clarity_object
  ADD COLUMN IF NOT EXISTS noun text
    CHECK (noun IN ('money', 'organisations', 'people', 'places', 'evidence', 'machine')),
  ADD COLUMN IF NOT EXISTS noun_source text
    CHECK (noun_source IN ('domain_rule', 'human')),
  ADD COLUMN IF NOT EXISTS noun_proposed text
    CHECK (noun_proposed IN ('money', 'organisations', 'people', 'places', 'evidence', 'machine'));

-- Backfill: the unambiguous half of the domain taxonomy, exactly nouns.ts DOMAIN_TO_NOUN.
-- Sector domains (justice_youth_detention, social_services, child_protection, unknown) are
-- deliberately absent — a sector spans several nouns, and filing it would be a guess.
UPDATE clarity_object SET
  noun = CASE domain
    WHEN 'grants_funding' THEN 'money'
    WHEN 'philanthropy_giving' THEN 'money'
    WHEN 'government_spend_procurement' THEN 'money'
    WHEN 'political_influence' THEN 'money'
    WHEN 'charities_ngo' THEN 'organisations'
    WHEN 'corporate_registry' THEN 'organisations'
    WHEN 'people_directors_governance' THEN 'people'
    WHEN 'geography_place' THEN 'places'
    WHEN 'evidence_outcomes_alma' THEN 'evidence'
    WHEN 'storytelling_consent' THEN 'evidence'
    WHEN 'media_narrative' THEN 'evidence'
    WHEN 'platform_ops_auth' THEN 'machine'
    WHEN 'ai_agents_pipeline' THEN 'machine'
  END,
  noun_source = 'domain_rule'
WHERE noun IS NULL
  AND domain IN ('grants_funding', 'philanthropy_giving', 'government_spend_procurement',
    'political_influence', 'charities_ngo', 'corporate_registry', 'people_directors_governance',
    'geography_place', 'evidence_outcomes_alma', 'storytelling_consent', 'media_narrative',
    'platform_ops_auth', 'ai_agents_pipeline');

-- Proposals for the unfiled: first-match name heuristics. Machine patterns run FIRST — a table
-- named agent_funding_queue is plumbing about money, not money — then money before the rest.
-- These are guesses by construction and are labelled as such on the adjudication surface.
UPDATE clarity_object SET noun_proposed = CASE
  WHEN object_name ~ '(^|_)(agent|auth|user|session|log|logs|queue|job|jobs|cron|cache|staging|pipeline|config|settings|migration|webhook|api_key|token|sync|import|export|scrape|ingest)s?(_|$)'
    THEN 'machine'
  WHEN object_name ~ '(fund|grant|payment|donat|contract|tender|invoice|budget|money|spend|revenue|giving|procure)'
    THEN 'money'
  WHEN object_name ~ '(person|people|director|board|role|identit|member)'
    THEN 'people'
  WHEN object_name ~ '(postcode|lga|seifa|geo|place|region|suburb|locality|remoteness|electorate)'
    THEN 'places'
  WHEN object_name ~ '(entit|organi[sz]|charit|compan|abr|asic|acnc|foundation|supplier|abn)'
    THEN 'organisations'
  WHEN object_name ~ '(story|stories|transcript|outcome|evidence|intervention|alma|media|consent|narrative|quote)'
    THEN 'evidence'
  END
WHERE noun IS NULL;

COMMIT;
