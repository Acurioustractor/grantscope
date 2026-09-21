-- Reviewed links for the last unlinked buyers, and the register fixes they exposed.
--
-- Decided by Ben on 2026-09-22 question by question; every identity below was
-- checked against abr_registry (the ABN register) the same day.
--
-- 1. buyer_entity_links: a reviewed buyer-name -> entity table, read FIRST by
--    link_se_buyer_prospects() (replaced below), by the austender edge recipe
--    (scripts/lib/graph-edge-datasets.mjs) and by the entity phase's govGsId
--    (scripts/build-entity-graph.mjs). se_buyer_prospects is truncated on every
--    scout run and the graph re-resolves every night, so a reviewed link stored
--    anywhere else would be undone.
--
-- 2. Register names corrected from the ABN register. An import had overwritten
--    them with another organisation's name:
--      76337613647  "Brisbane Youth Detention Centre" (charity) is Queensland's
--                   DEPARTMENT OF EDUCATION (state government entity, active).
--      11700374032  "Queensland Health" is QUEENSLAND WOMEN'S HEALTH NETWORK.
--      Seven nodes named "QUEENSLAND UNIVERSITY OF TECHNOLOGY (83 791 7xx xxx)"
--                   are QUT subsidiaries and trusts, or unrelated companies.
--      72189919072  "NSW Department of Primary Industries" is DEPARTMENT OF INDUSTRY.
--    Stale names brought up to date (same ABN, renamed body):
--      75563721098  Child Safety, Youth and Women -> Families, Seniors,
--                   Disability Services and Child Safety.
--      22579084055  Queensland Department of Youth Justice -> Youth Justice and
--                   Victim Support.
--
-- 3. Merges, loser -> winner. FKs repointed from the catalogue (pattern of
--    2026-08-21-gov-entity-merge.sql) plus un-keyed *entity_id uuid columns;
--    refused if any FK still points at a loser:
--      AU-ABN-78106094561 Griffith University: not on the ABN register, a one-digit
--                         typo of 78106094461.
--      AU-ABN-83791742622 QUT: likewise a typo of 83791724622 (0 edges).
--      AU-GOV stubs "DoE", "PSBA", "QUT": bare acronyms from the Queensland
--                         contracts directory (every row is data.qld.gov.au), so
--                         Queensland Education, the Public Safety Business Agency
--                         (cancelled, historical) and QUT. 1,797 edges; merging
--                         creates no self-loop (measured).
--
-- 4. Renames, Ben's call "separate, linked": identity follows the ABN. Queensland
--    departments kept their ABN through renames, so those names link to the ABN
--    holder, and one relationship marks the only real break in each lineage:
--      75563721098 held Child Safety, Youth and Women (Dec 2017) -> Children,
--        Youth Justice and Multicultural Affairs (Nov 2020) -> Child Safety,
--        Seniors and Disability Services (2023) -> today's name. In May 2023 youth
--        justice moved out, via Youth Justice, Employment, Small Business and
--        Training, to 22579084055 (Department of Youth Justice from Dec 2023, and
--        Victim Support from Nov 2024). Source: Find & Connect entries.
--      NSW: DEPARTMENT OF PRIMARY INDUSTRIES (51734124190, cancelled 2012-02-29)
--        -> DEPARTMENT OF INDUSTRY (72189919072, cancelled 2021-10-01).
--    relationship_type 'renamed_to' is added for these.
--
-- NOT linked: the buyer "NSW Department of Primary Industries". 60 of its 62
-- contracts postdate the 2012 cancellation of the ABN Ben picked; held for him.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922150000_reviewed_buyer_links.sql

BEGIN;

-- ── 1. the reviewed alias table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyer_entity_links (
  buyer_key    text PRIMARY KEY,           -- lower(trim(buyer_name))
  gs_entity_id uuid NOT NULL REFERENCES gs_entities(id),
  link_method  text NOT NULL DEFAULT 'reviewed' CHECK (link_method IN ('reviewed')),
  note         text,
  linked_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE buyer_entity_links ENABLE ROW LEVEL SECURITY;

-- ── 2. names from the ABN register ──────────────────────────────────────────
UPDATE gs_entities e
   SET canonical_name = v.name,
       entity_type = coalesce(v.etype, e.entity_type),
       state = coalesce(v.st, e.state)
FROM (VALUES
  ('AU-ABN-76337613647', 'Department of Education (QLD)', 'government_body', 'QLD'),
  ('AU-ABN-11700374032', 'Queensland Women''s Health Network Incorporated', NULL, NULL),
  ('AU-ABN-28928640473', 'The Trustee for QUT Enterprise Holdings Trust', 'trust', 'QLD'),
  ('AU-ABN-97041405905', 'The Trustee for QUT Bluebox Trust', 'trust', 'QLD'),
  ('AU-ABN-92718723234', 'The Trustee for QUT Student Managed Investment Fund', 'trust', 'QLD'),
  ('AU-ABN-38085931611', 'The Brisbane Business School Pty Ltd', NULL, 'QLD'),
  ('AU-ABN-97097319778', 'QUT Enterprise Holdings Pty Ltd', NULL, 'QLD'),
  ('AU-ABN-95671332237', 'Australian Battery Testing Centre Pty Ltd', NULL, 'QLD'),
  ('AU-ABN-82099110924', 'QUT Advisory Pty Ltd', NULL, 'QLD'),
  ('AU-ABN-72189919072', 'NSW Department of Industry', 'government_body', 'NSW'),
  ('AU-ABN-51734124190', 'NSW Department of Primary Industries', 'government_body', 'NSW'),
  ('AU-ABN-75563721098', 'Department of Families, Seniors, Disability Services and Child Safety (QLD)', 'government_body', 'QLD'),
  ('GS-GOV-QLD-1773547433930', 'Department of Youth Justice and Victim Support (QLD)', 'government_body', 'QLD'),
  ('AU-ABN-66329169412', 'Department of Health (QLD)', 'government_body', 'QLD')
) AS v(gs_id, name, etype, st)
WHERE e.gs_id = v.gs_id;

-- ── 3. merges ───────────────────────────────────────────────────────────────
CREATE TABLE gs_entity_merge_map_20260922 (
  loser_id uuid PRIMARY KEY, winner_id uuid NOT NULL,
  loser_gs_id text NOT NULL, winner_gs_id text NOT NULL, reason text NOT NULL
);
INSERT INTO gs_entity_merge_map_20260922
SELECT l.id, w.id, l.gs_id, w.gs_id, v.reason
FROM (VALUES
  ('AU-ABN-78106094561', 'AU-ABN-78106094461', 'ABN not on register; typo of Griffith University'),
  ('AU-ABN-83791742622', 'AU-ABN-83791724622', 'ABN not on register; typo of QUT'),
  ('AU-GOV-b9d6b91735fefbb307a45a045fc700f5', 'AU-ABN-76337613647', 'acronym stub DoE, QLD contracts directory'),
  ('AU-GOV-6e5502b2514f9f6536efcf2ada5702db', 'AU-ABN-77154515128', 'acronym stub PSBA, QLD contracts directory'),
  ('AU-GOV-d11ef94057c33c1db7b110e73be5e44e', 'AU-ABN-83791724622', 'acronym stub QUT, QLD contracts directory')
) AS v(loser, winner, reason)
JOIN gs_entities l ON l.gs_id = v.loser
JOIN gs_entities w ON w.gs_id = v.winner;

DO $$
DECLARE r record; n bigint;
BEGIN
  IF (SELECT count(*) FROM gs_entity_merge_map_20260922) <> 5 THEN
    RAISE EXCEPTION 'expected 5 merge pairs, found %', (SELECT count(*) FROM gs_entity_merge_map_20260922);
  END IF;
  -- Every FK to gs_entities, from the catalogue.
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'gs_entities'::regclass
  LOOP
    EXECUTE format('UPDATE %s t SET %I = m.winner_id FROM gs_entity_merge_map_20260922 m WHERE m.loser_id = t.%I',
                   r.tbl, r.col, r.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE 're-pointed % rows in %.% (FK)', n, r.tbl, r.col; END IF;
  END LOOP;
  -- Un-keyed uuid columns that name an entity (justice_funding.gs_entity_id,
  -- organizations.gs_entity_id, ...). Not FKs, so the catalogue misses them.
  FOR r IN
    SELECT c.table_name AS tbl, c.column_name AS col
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.data_type = 'uuid'
       AND c.column_name IN ('gs_entity_id', 'entity_id', 'funder_entity_id', 'source_entity_id', 'target_entity_id')
       AND c.table_name NOT LIKE 'gs_entity_merge_map_%'
       AND c.table_name NOT LIKE '\_backup%'
  LOOP
    EXECUTE format('UPDATE public.%I t SET %I = m.winner_id FROM gs_entity_merge_map_20260922 m WHERE m.loser_id = t.%I',
                   r.tbl, r.col, r.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE 're-pointed % rows in %.% (column)', n, r.tbl, r.col; END IF;
  END LOOP;
  -- Nothing keyed may still reference a loser.
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'gs_entities'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s t JOIN gs_entity_merge_map_20260922 m ON m.loser_id = t.%I', r.tbl, r.col) INTO n;
    IF n > 0 THEN RAISE EXCEPTION '%.% still references % merged-away entities', r.tbl, r.col, n; END IF;
  END LOOP;
END $$;

DELETE FROM gs_entities WHERE id IN (SELECT loser_id FROM gs_entity_merge_map_20260922);

-- ── 4. lineage ──────────────────────────────────────────────────────────────
ALTER TABLE gs_relationships DROP CONSTRAINT gs_relationships_relationship_type_check;
ALTER TABLE gs_relationships ADD CONSTRAINT gs_relationships_relationship_type_check
  CHECK (relationship_type = ANY (ARRAY['donation','party_receipt','contract','grant','directorship',
    'ownership','charity_link','program_funding','tax_record','registered_as','listed_as','subsidiary_of',
    'member_of','lobbies_for','partners_with','shared_director','affiliated_with','trustee_of',
    'offers_grant_program','renamed_to']::text[]));

INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, start_date, dataset,
                              source_record_id, confidence, properties)
SELECT s.id, t.id, 'renamed_to', v.d::date, 'machinery_of_government', v.rec, v.conf, v.props::jsonb
FROM (VALUES
  ('AU-ABN-75563721098', 'GS-GOV-QLD-1773547433930', '2023-05-18', 'mog-qld-youth-justice-2023', 'verified',
   '{"event":"youth justice function transferred","via":"Department of Youth Justice, Employment, Small Business and Training","source":"https://www.findandconnect.gov.au/entity/department-of-youth-justice/"}'),
  ('AU-ABN-51734124190', 'AU-ABN-72189919072', '2012-02-29', 'mog-nsw-primary-industries-2012', 'registry',
   '{"event":"absorbed; predecessor ABN cancelled","source":"abr_registry status_from_date"}')
) AS v(src, tgt, d, rec, conf, props)
JOIN gs_entities s ON s.gs_id = v.src
JOIN gs_entities t ON t.gs_id = v.tgt;

-- ── 5. the reviewed buyer links ─────────────────────────────────────────────
INSERT INTO buyer_entity_links (buyer_key, gs_entity_id, note)
SELECT lower(trim(v.buyer)), e.id, v.note
FROM (VALUES
  ('DoE', 'AU-ABN-76337613647', 'QLD contracts directory acronym'),
  ('QLD Department of Education', 'AU-ABN-76337613647', NULL),
  ('PSBA', 'AU-ABN-77154515128', 'QLD contracts directory acronym; agency cancelled'),
  ('QUT', 'AU-ABN-83791724622', 'QLD contracts directory acronym'),
  ('Griffith University', 'AU-ABN-78106094461', NULL),
  ('QLD QLD Health Services', 'AU-ABN-66329169412', 'registered DEPARTMENT OF HEALTH QLD, trades as QUEENSLAND HEALTH'),
  ('QLD Department of Youth Justice', 'GS-GOV-QLD-1773547433930', 'same ABN 22579084055'),
  ('QLD Department of Youth Justice and Victim Services', 'GS-GOV-QLD-1773547433930', 'registered name says Victim Support'),
  ('QLD Department of Children, Youth Justice and Multicultural Affairs', 'AU-ABN-75563721098', 'same ABN, renamed'),
  ('QLD Department of Child Safety, Seniors and Disability Services', 'AU-ABN-75563721098', 'same ABN, renamed'),
  ('QLD Department of Child Safety, Youth and Women', 'AU-ABN-75563721098', 'same ABN, renamed')
) AS v(buyer, gs_id, note)
JOIN gs_entities e ON e.gs_id = v.gs_id
ON CONFLICT (buyer_key) DO NOTHING;

-- ── 6. the linker reads reviewed links first ────────────────────────────────
-- Not written when this file was applied (2026-09-22); the old linker ran, so
-- the 11 reviewed links took effect only with 20260922160000.

SELECT link_se_buyer_prospects();

COMMIT;
