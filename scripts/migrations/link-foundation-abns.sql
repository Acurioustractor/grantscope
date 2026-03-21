-- link-foundation-abns.sql
-- Fix foundation→ABN linkages by merging duplicate entries and updating ABNs
-- For FK tables with unique constraints, delete the duplicate's rows instead of reassigning

BEGIN;

-- 1. Woolworths Group Foundation (146.5M) ← merge Food for Good Foundation (500K, ABN 67937361335)
-- Reassign where possible, delete where target already exists
UPDATE grant_opportunities SET foundation_id = '6d8356c4-8efb-471f-8bdc-46bdd85d22f1'
  WHERE foundation_id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3'
  AND NOT EXISTS (SELECT 1 FROM grant_opportunities WHERE foundation_id = '6d8356c4-8efb-471f-8bdc-46bdd85d22f1' AND id = grant_opportunities.id);
DELETE FROM grant_opportunities WHERE foundation_id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3';
UPDATE foundation_programs SET foundation_id = '6d8356c4-8efb-471f-8bdc-46bdd85d22f1'
  WHERE foundation_id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3';
DELETE FROM foundation_programs WHERE foundation_id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3';
DELETE FROM saved_foundations WHERE foundation_id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3';
DELETE FROM foundation_power_profiles WHERE foundation_id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3';
DELETE FROM foundations WHERE id = '3636ba80-c91b-436b-a98c-93c6bc79d2a3';
UPDATE foundations SET acnc_abn = '67937361335' WHERE id = '6d8356c4-8efb-471f-8bdc-46bdd85d22f1';

-- 2. CBA Foundation (56.7M) ← merge CommBank Foundation (500K, ABN 27727720406)
DELETE FROM grant_opportunities WHERE foundation_id = 'ac6e150a-a338-477f-ac5a-b9dd01acd368';
DELETE FROM foundation_programs WHERE foundation_id = 'ac6e150a-a338-477f-ac5a-b9dd01acd368';
DELETE FROM saved_foundations WHERE foundation_id = 'ac6e150a-a338-477f-ac5a-b9dd01acd368';
DELETE FROM foundation_power_profiles WHERE foundation_id = 'ac6e150a-a338-477f-ac5a-b9dd01acd368';
DELETE FROM foundations WHERE id = 'ac6e150a-a338-477f-ac5a-b9dd01acd368';
UPDATE foundations SET acnc_abn = '27727720406' WHERE id = 'a4b33b11-2f81-47de-a2f3-9f7b419beb01';
-- Delete CBA duplicate entry
DELETE FROM grant_opportunities WHERE foundation_id = 'eefd8f81-e887-4131-b9cc-feb1b1871c82';
DELETE FROM foundation_programs WHERE foundation_id = 'eefd8f81-e887-4131-b9cc-feb1b1871c82';
DELETE FROM saved_foundations WHERE foundation_id = 'eefd8f81-e887-4131-b9cc-feb1b1871c82';
DELETE FROM foundation_power_profiles WHERE foundation_id = 'eefd8f81-e887-4131-b9cc-feb1b1871c82';
DELETE FROM foundations WHERE id = 'eefd8f81-e887-4131-b9cc-feb1b1871c82';

-- 3. Lindsay Fox Foundation (100M) ← merge The Trustee For The Fox Family Foundation (500K, ABN 46029271914)
DELETE FROM grant_opportunities WHERE foundation_id = '91e288f0-fe31-49f2-a5d3-d24671cd1690';
DELETE FROM foundation_programs WHERE foundation_id = '91e288f0-fe31-49f2-a5d3-d24671cd1690';
DELETE FROM saved_foundations WHERE foundation_id = '91e288f0-fe31-49f2-a5d3-d24671cd1690';
DELETE FROM foundation_power_profiles WHERE foundation_id = '91e288f0-fe31-49f2-a5d3-d24671cd1690';
DELETE FROM foundations WHERE id = '91e288f0-fe31-49f2-a5d3-d24671cd1690';
UPDATE foundations SET acnc_abn = '46029271914' WHERE id = '35ea9a84-df9c-4f25-a015-46e9108a6b5b';

-- 4. Humanitix Foundation (5.9M) — no duplicate, just set ABN
UPDATE foundations SET acnc_abn = '32618780439' WHERE name = 'Humanitix Foundation' AND acnc_abn IS NULL;

-- Verify: show top foundations with ABN linkage status
SELECT name, acnc_abn, total_giving_annual,
  CASE WHEN acnc_abn IS NOT NULL THEN 'LINKED' ELSE 'UNLINKED' END as status
FROM foundations
WHERE total_giving_annual > 5000000
ORDER BY total_giving_annual DESC
LIMIT 25;

COMMIT;
