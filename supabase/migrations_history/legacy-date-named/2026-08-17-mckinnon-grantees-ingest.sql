-- McKinnon FY2025 grantee ingest — from the foundation's own Consolidated Program Expenditure
-- Report 2025 (published 17 Feb 2026, linked from mckinnon.co/about-us/funding-and-financials).
-- 23 of 26 external grantees ABN-resolved; 3 held out unresolved (It's Philanthropy, Orchestra
-- Victoria, SAWA-Australia); internal SMF->SMCF transfers ($31.14M) excluded as intra-group.
-- One medium-confidence name match flagged inline (WELA). Amounts aggregated per payer->grantee;
-- year 2025 = FY ending 30 Jun 2025. REVERSIBLE by dataset='mckinnon_program_expenditure_2025'.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-mckinnon-grantees-ingest.sql
BEGIN;
WITH rows_(payer_abn, grantee_abn, amount) AS (VALUES
 ('28739100711','94641582121',100000),         -- SMF -> Australian Associated Press
 ('12653756597','84002705224',12500),          -- SMCF -> University of Melbourne
 ('12653756597','17134323756',525000),         -- SMCF -> Grattan Institute (100k+125k+300k)
 ('12653756597','64634200445',160000),         -- SMCF -> Centre for Public Integrity (10k+150k)
 ('12653756597','31117719267',65000),          -- SMCF -> Human Rights Law Centre
 ('28739100711','12377614012',1000000),        -- SMF -> Monash University (McKinnon Institute core)
 ('12653756597','12377614012',1200000),        -- SMCF -> Monash University (McKinnon Institute core)
 ('28739100711','68653070234',600000),         -- SMF -> Ochre Education
 ('12653756597','64648844991',7500000),        -- SMCF -> e61 Institute (report row: UNSW/e61)
 ('12653756597','72652617537',1000000),        -- SMCF -> WELA (report: 'Environmental Leadership Australia'; medium-confidence name match)
 ('12653756597','15001495012',400000),         -- SMCF -> Centre for Independent Studies
 ('28739100711','98122077767',20000),          -- SMF -> Per Capita Australia
 ('28739100711','23609620028',20000),          -- SMF -> National Justice Project
 ('28739100711','20132084050',17000),          -- SMF -> Alola Australia
 ('28739100711','18067405190',5000),           -- SMF -> Australian National Academy of Music
 ('28739100711','47078925658',5000),           -- SMF -> Melbourne Symphony Orchestra
 ('28739100711','25741608900',20000),          -- SMF -> RMH Neuroscience Foundation
 ('28739100711','26000755153',5000),           -- SMF -> Opera Australia
 ('28739100711','85653052549',10000),          -- SMF -> Being The Dream
 ('28739100711','82090616443',10000),          -- SMF -> Great Barrier Reef Foundation
 ('40656129127','39367145336',10000),          -- SMRC/Oh-Rule -> Circle of Friends Australia
 ('40656129127','74068758654',20000),          -- SMRC/Oh-Rule -> MSF Australia
 ('40656129127','28000030179',20000),          -- SMRC/Oh-Rule -> The Smith Family
 ('40656129127','19242959685',20000)           -- SMRC/Oh-Rule -> IWDA
)
INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_url, confidence)
SELECT s.id, t.id, 'grant', r.amount, 2025, 'mckinnon_program_expenditure_2025',
       'https://a-ap.storyblok.com/f/3001038/x/057e17fb7c/program-expenditure-report-2025-final.pdf',
       'registry'
FROM rows_ r
JOIN gs_entities s ON s.abn = r.payer_abn
JOIN gs_entities t ON t.abn = r.grantee_abn;
COMMIT;
