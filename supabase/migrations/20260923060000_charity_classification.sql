-- Jev's charity classifications get a table, so the community money finder can run deployed.
--
-- scripts/jev-charity-classify.mjs asks Jev up to three questions about each of the 53,879 charities
-- with a 2022-2024 ACNC filing: its ONE main sector, whether it is Aboriginal community controlled
-- (asked only of charities ticking Aboriginal and Torres Strait Islander beneficiaries, or ORIC
-- corporations), and what kind of education organisation it is. Answers live in
-- data/jev-check/charity-classify.jsonl; /charities/[abn]/funders reads them from local disk, which
-- works in dev and cannot work on Vercel. This is that table.
--
-- Why a table and not a column on acnc_charities: these are judgements by a named model at a stated
-- confidence, not register facts. They carry their own confidence, they are re-run when the rubric
-- changes, and a consumer must be able to apply its own confidence floor (every surface so far uses
-- 0.9). Keeping them separate also means a re-run never touches the register mirror.
--
-- Confidence is kept as given. Nothing here filters: filtering is the reader's job.
--
-- Load the rows after applying: scripts/load-charity-classification.sh
--
-- Public read: derived from the public ACNC register, and the point is that community organisations
-- can use it. No RLS policy needed beyond read for anon/authenticated; nothing writes but the loader
-- (service role).

CREATE TABLE IF NOT EXISTS gs_charity_classification (
  abn              text PRIMARY KEY,
  sector           text,
  sector_conf      numeric,
  control          text,
  control_conf     numeric,
  school           text,
  school_conf      numeric,
  model            text NOT NULL DEFAULT 'jev-latest',
  classified_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gs_charity_classification_conf_range CHECK (
    coalesce(sector_conf, 0) BETWEEN 0 AND 1
    AND coalesce(control_conf, 0) BETWEEN 0 AND 1
    AND coalesce(school_conf, 0) BETWEEN 0 AND 1)
);

COMMENT ON TABLE gs_charity_classification IS
  'One row per ACNC charity: main sector, Aboriginal community control, education type, as judged by Jev from the charity''s own ACNC description. Judgements with confidence, not register facts. Written by scripts/jev-charity-classify.mjs via scripts/load-charity-classification.sh. Readers apply their own confidence floor; every surface so far uses 0.9.';
COMMENT ON COLUMN gs_charity_classification.control IS
  'community_controlled | mainstream | government | cannot_tell, against the Closing the Gap clause 44 definition. Jev cannot see board composition, so cannot_tell and low confidence are common on real community-controlled organisations.';

-- Sector and control are both queried as "everything in this class above a confidence floor".
CREATE INDEX IF NOT EXISTS idx_gs_charity_classification_sector ON gs_charity_classification (sector, sector_conf DESC);
CREATE INDEX IF NOT EXISTS idx_gs_charity_classification_control ON gs_charity_classification (control, control_conf DESC);
CREATE INDEX IF NOT EXISTS idx_gs_charity_classification_school ON gs_charity_classification (school, school_conf DESC);

ALTER TABLE gs_charity_classification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gs_charity_classification_read ON gs_charity_classification;
CREATE POLICY gs_charity_classification_read ON gs_charity_classification
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON gs_charity_classification TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gs_charity_classification TO service_role;
