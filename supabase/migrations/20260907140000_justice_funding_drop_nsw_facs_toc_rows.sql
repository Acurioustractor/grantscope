-- 20260907140000_justice_funding_drop_nsw_facs_toc_rows.sql
-- Ten rows in justice_funding are the table of contents of the NSW FaCS 2018-19 NGO grants report, parsed as grants:
-- recipient_name is a section heading ("2. Community Support and Development", "and Community Services Cluster",
-- which is the second line of "1. State Outcomes delivered by the Family and Community Services Cluster") and
-- amount_dollars is the page number (4, 5, 39, 41, 53, 57, 61, 66, 71, 73). Loaded 2026-03-27 by
-- scripts/sql/ingest-nsw-facs-grants-2018-19.sql, a one-off, so they do not return on any scheduled run.
-- Found 2026-09-07 when two-way sort made the bottom of the grant-recipient ranking visible (#442).
-- $470 in total; program_name '1. State Outcomes delivered by the Family and Community Services Cluster' on all ten
-- (the first dry run matched on a display-truncated version of that name and deleted nothing). Restore: re-insert from this list.
BEGIN;

DELETE FROM justice_funding
WHERE source = 'nsw-facs-ngo-grants'
  AND amount_dollars < 100
  AND id IN (
    '90886b67-3b53-46ba-bd07-0eeb5b1ee9d1', -- and Community Services Cluster, 4
    'c52e3178-92c5-478b-bc26-a2fcea2313e2', -- 2. Community Support and Development, 5
    '6ef04821-7e19-4768-92ee-ee73ab81325d', -- 3. Private Market Assistance, 39
    '260ab098-28c3-4169-9fd7-cf9f9e137949', -- 4. Targeted Earlier Intervention, 41
    '3d0752e0-0879-4395-8fc2-2bb341d869ae', -- 5. Child Protection, 53
    'd906b92f-6ce8-493c-815b-d861f0efbaa3', -- 6. Domestic and Family Violence, 57
    '17e24f8e-d84e-40dd-b13c-975e95dabd29', -- 7. Homelessness, 61
    'd0e003c0-78c1-4dcc-b69b-7eb41a6041e4', -- 8. Out of Home Care and Permanency Support, 66
    '2467f891-0fbd-4f6d-9c16-f88d7afb4eaf', -- 9. Social Housing, 71
    'ac428cf8-28f8-40bc-a85b-e59d2fd51068'  -- 10. Supporting Legacy Services, 73
  );

COMMIT;
