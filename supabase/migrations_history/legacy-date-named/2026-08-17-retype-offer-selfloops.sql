-- 6,667 'grant' edges are SELF-LOOPS (source = target), all dataset='grant_opportunities':
-- they encode "this foundation OFFERS grant programs" — the opportunities dataset has no
-- recipients, so both ends resolved to the funder. A foundation does not grant to itself.
-- Re-typed (not deleted: the offering fact is real information) so 'grant' means money moved
-- between two parties, everywhere, without every consumer needing the self-loop guard.
-- Found 2026-08-17 while scoping the grantee-link enrichment lane; these loops made the
-- foundation-grantee frontier look like 971 foundations when the honest number is 27.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-retype-offer-selfloops.sql
BEGIN;
ALTER TABLE gs_relationships DROP CONSTRAINT gs_relationships_relationship_type_check;
ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_relationship_type_check
  CHECK (relationship_type = ANY (ARRAY['donation','contract','grant','directorship','ownership',
    'charity_link','program_funding','tax_record','registered_as','listed_as','subsidiary_of',
    'member_of','lobbies_for','partners_with','shared_director','affiliated_with','trustee_of',
    'offers_grant_program']));
UPDATE gs_relationships
   SET relationship_type = 'offers_grant_program'
 WHERE relationship_type = 'grant'
   AND source_entity_id = target_entity_id;
COMMIT;
