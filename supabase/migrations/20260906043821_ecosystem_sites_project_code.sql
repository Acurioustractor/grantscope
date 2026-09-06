-- ecosystem_sites.project_code: which ACT project a site belongs to.
--
-- The typed project record (act-global-infrastructure/config/project-codes.json,
-- via @act/projects) lists each project's sites. vercel-sync.mjs will upsert
-- deployment state per site and needs to carry the owning code so the studio
-- can show "live / broken, last deployed" per project. Plan:
-- act-global-infrastructure/thoughts/shared/plans/project-record-and-site-sync.md
--
-- Text, not a foreign key: the codes live in a JSON file, not a table.
-- Nullable: rows that are not ACT projects (external, experiments) stay NULL.
BEGIN;

ALTER TABLE public.ecosystem_sites
  ADD COLUMN IF NOT EXISTS project_code text;

COMMENT ON COLUMN public.ecosystem_sites.project_code IS
  'ACT project code (e.g. ACT-JH) from config/project-codes.json; NULL when the site is not an ACT project';

CREATE INDEX IF NOT EXISTS ecosystem_sites_project_code_idx
  ON public.ecosystem_sites (project_code);

COMMIT;

-- post-check:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name='ecosystem_sites' AND column_name='project_code';
