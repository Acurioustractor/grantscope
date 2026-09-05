-- Re-delete the 822 AU-ORIC twin rows RESURRECTED by scripts/build-entity-graph.mjs
-- on 2026-08-09 09:22:28–09:25:05 UTC (scheduler batch run started 08:56:55; the run
-- was unlogged in agent_runs — logStart null under pooler stress — and FAILED 09:44
-- mid-entity-phase, so relationship phases never ran and nothing references the clones).
--
-- Root cause: step 1c upserts every oric_corporations row by gs_id with no knowledge
-- of the dedup manifest, so the 822 twins merged by 20260809200000 were re-minted as
-- fresh rows (new uuids, source_datasets={oric}, no placement). Script fixed same day:
-- manifest-driven suppression set in build-entity-graph.mjs. Originals remain backed
-- up in gs_entities_dedup_backup_20260809; survivors are the AU-ABN rows.
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260809210000_redelete_resurrected_oric_twins.sql
--
-- Single transaction; any assertion failure aborts the whole thing.

BEGIN;

-- Target set: alive rows whose gs_id is a merged twin AND that were created after
-- the merge (the merge applied evening 2026-08-09 AEST; originals dated 2026-03..06).
CREATE TEMP TABLE tmp_resurrected ON COMMIT DROP AS
SELECT e.id, e.gs_id
FROM gs_entities e
JOIN dedup_tranche1_20260809 m ON m.oric_gs_id = e.gs_id
WHERE e.created_at > '2026-08-09T05:00:00+00';

DO $$
DECLARE n bigint; refs bigint;
BEGIN
  SELECT COUNT(*) INTO n FROM tmp_resurrected;
  IF n <> 822 THEN
    RAISE EXCEPTION 'expected exactly 822 resurrected twins, found % — world changed, re-diagnose', n;
  END IF;

  -- every twin must still have its AU-ABN survivor alive
  SELECT COUNT(*) INTO n
  FROM dedup_tranche1_20260809 m
  WHERE NOT EXISTS (SELECT 1 FROM gs_entities s WHERE s.gs_id = m.abn_gs_id);
  IF n <> 0 THEN
    RAISE EXCEPTION '% manifest survivors missing from gs_entities — do NOT delete', n;
  END IF;

  -- zero references from every table the original merge had to repoint
  SELECT
      (SELECT COUNT(*) FROM gs_relationships r JOIN tmp_resurrected t
         ON t.id = r.source_entity_id OR t.id = r.target_entity_id)
    + (SELECT COUNT(*) FROM entity_xref x JOIN tmp_resurrected t ON t.id = x.entity_id)
    + (SELECT COUNT(*) FROM justice_funding x JOIN tmp_resurrected t ON t.id = x.gs_entity_id)
    + (SELECT COUNT(*) FROM goods_procurement_entities x JOIN tmp_resurrected t ON t.id = x.entity_id)
    + (SELECT COUNT(*) FROM alma_interventions x JOIN tmp_resurrected t ON t.id = x.gs_entity_id)
    + (SELECT COUNT(*) FROM foundation_grantees x JOIN tmp_resurrected t ON t.id = x.grantee_entity_id)
    + (SELECT COUNT(*) FROM goods_relationships x JOIN tmp_resurrected t ON t.id = x.entity_id)
  INTO refs;
  IF refs <> 0 THEN
    RAISE EXCEPTION '% references now point at resurrected rows — repoint first, not a bare delete', refs;
  END IF;
END $$;

DELETE FROM gs_entities e USING tmp_resurrected t WHERE e.id = t.id;

-- Post-conditions: AU-ORIC population back to post-dedup truth.
DO $$
DECLARE n bigint;
BEGIN
  SELECT COUNT(*) INTO n FROM gs_entities WHERE gs_id LIKE 'AU-ORIC-%';
  IF n <> 3259 THEN
    RAISE EXCEPTION 'post-delete AU-ORIC count % (expected 3259) — rolling back', n;
  END IF;
  SELECT COUNT(*) INTO n
  FROM gs_entities e JOIN dedup_tranche1_20260809 m ON m.oric_gs_id = e.gs_id;
  IF n <> 0 THEN
    RAISE EXCEPTION '% merged twins still alive — rolling back', n;
  END IF;
END $$;

COMMIT;

SELECT 'redelete complete: AU-ORIC now ' || COUNT(*) FROM gs_entities WHERE gs_id LIKE 'AU-ORIC-%';
