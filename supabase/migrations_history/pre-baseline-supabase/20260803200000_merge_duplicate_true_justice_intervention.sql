-- Merge two alma_interventions rows recording the same program.
--
-- "True Justice: Deep Listening on Country" was entered twice by enrichment
-- passes five days apart (2026-03-21 and 2026-03-26). Both describe the same
-- thing: the ANU on-Country intensive at Atnarpa Homestead running since 2022.
-- The duplicate broke the unique index on mv_evidence_backed_funding, so that
-- view could not be rebuilt from scratch.
--
-- The later row survives: it carries the published citation
-- (DOI 10.1177/11771801231198566), a fuller description and a higher
-- portfolio_score.
--
-- Two things from the earlier row are carried across rather than discarded:
--
--   1. Its evidence link. The rows point at DIFFERENT evidence records — a
--      community-led evaluation across 28 on-Country programs, versus a
--      participatory action research case study. Deleting without repointing
--      would have destroyed the first, because the junction cascades.
--
--   2. Its cultural authority attribution. The earlier row names "Arrernte
--      Traditional Owners - Bloomfield and Liddle families"; the survivor said
--      only "Aboriginal community-controlled with ANU partnership". Naming the
--      Traditional Owners is more precise and belongs to them, so it is kept
--      and the ANU relationship is recorded as the delivery partnership it is.

BEGIN;

-- Carry the evidence link across before the delete cascades it away.
UPDATE public.alma_intervention_evidence
   SET intervention_id = '29d04d56-d2ae-4367-b2ee-cccdd93a92b0'
 WHERE intervention_id = '8202b069-1ae1-480e-b63e-2b1862581573'
   AND NOT EXISTS (
     SELECT 1 FROM public.alma_intervention_evidence existing
      WHERE existing.intervention_id = '29d04d56-d2ae-4367-b2ee-cccdd93a92b0'
        AND existing.evidence_id = alma_intervention_evidence.evidence_id
   );

UPDATE public.alma_interventions
   SET cultural_authority = 'Arrernte Traditional Owners - Bloomfield and Liddle families; delivered in partnership with ANU'
 WHERE id = '29d04d56-d2ae-4367-b2ee-cccdd93a92b0';

DELETE FROM public.alma_interventions
 WHERE id = '8202b069-1ae1-480e-b63e-2b1862581573';

COMMIT;
