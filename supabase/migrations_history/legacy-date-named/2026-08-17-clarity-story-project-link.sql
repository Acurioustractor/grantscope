-- Slice 10: story <-> project, project-mediated ONLY. A story says "this is about Goods"; Goods
-- says "this is my evidence"; the reader sees both; nobody is triangulated. Direct story->data
-- linkage is how re-identification gets built, and it is deliberately impossible here: the link
-- names a PROJECT CODE, never a data row, an organisation, or a place.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-clarity-story-project-link.sql
--
-- Ben's slice-10 rulings (2026-08-17): both corpora from day one (story_table discriminator);
-- the declaration lives in THIS table, written by the admin-gated API (story ids in a public git
-- repo would itself be a disclosure, so the wiki-file pattern is wrong here); surfacing is
-- published-only titles — a story that is not already public renders as a count, never a title.
--
-- No FK to clarity_project_code: the sync rebuilds that table with DELETE+INSERT and an FK would
-- break every resync. The API validates codes instead; a dangling code after a wiki change
-- renders as a count with an unknown-code note, not a crash.

BEGIN;

CREATE TABLE IF NOT EXISTS clarity_story_project_link (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_table text NOT NULL CHECK (story_table IN ('stories', 'transcripts')),
  story_id uuid NOT NULL,
  project_code text NOT NULL,
  declared_by text NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (story_table, story_id, project_code)
);

REVOKE ALL ON clarity_story_project_link FROM anon, authenticated;
GRANT ALL ON clarity_story_project_link TO service_role;
GRANT SELECT ON clarity_story_project_link TO agent_readonly;

COMMIT;
