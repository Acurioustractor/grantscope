-- Community Services Directory staging table
--
-- Raw listings scraped from public community-services directories
-- (MyCommunityDirectory, Ask Izzy / Infoxchange, peak-body rosters, etc.).
--
-- This is a STAGING table by design — same pattern as social_enterprises and
-- justice_funding. Scraped listings rarely carry an ABN, so they land here
-- first; a downstream bridge resolves ABNs and promotes matched orgs into
-- gs_entities. Keeping raw listings out of the canonical graph protects the
-- 159K-row gs_entities table from un-deduped, ABN-less noise.
--
-- Apply with psql (Rule #1):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f scripts/migrations/2026-06-06-community-directory-orgs.sql

CREATE TABLE IF NOT EXISTS community_directory_orgs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name         text NOT NULL,
  description  text,
  service_type text,           -- directory category, e.g. "Family Support", "Homelessness"

  -- Contact / details (the "more details" half of the mission)
  website      text,
  phone        text,
  email        text,

  -- Location
  address      text,
  suburb       text,
  state        text,           -- normalised to AU state codes (VIC/NSW/QLD/...)
  postcode     text,

  -- Resolution keys (usually null from directories; filled by the bridge later)
  abn          text,
  gs_entity_id uuid,           -- set once promoted/linked into gs_entities

  -- Provenance
  source       text NOT NULL,  -- e.g. 'mycommunitydirectory', 'askizzy'
  source_url   text,           -- canonical listing URL — natural dedup key
  raw          jsonb,          -- full extracted blob for re-parsing without re-scraping

  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now()
);

-- A listing's URL is its stable identity within a source. Upserts key on this.
CREATE UNIQUE INDEX IF NOT EXISTS community_directory_orgs_source_url_uniq
  ON community_directory_orgs (source, source_url)
  WHERE source_url IS NOT NULL;

-- Fallback dedup for listings with no URL: name within a source + postcode.
CREATE UNIQUE INDEX IF NOT EXISTS community_directory_orgs_source_name_pc_uniq
  ON community_directory_orgs (source, lower(name), coalesce(postcode, ''))
  WHERE source_url IS NULL;

CREATE INDEX IF NOT EXISTS community_directory_orgs_abn_idx
  ON community_directory_orgs (abn) WHERE abn IS NOT NULL;

CREATE INDEX IF NOT EXISTS community_directory_orgs_state_idx
  ON community_directory_orgs (state);

CREATE INDEX IF NOT EXISTS community_directory_orgs_unlinked_idx
  ON community_directory_orgs (gs_entity_id) WHERE gs_entity_id IS NULL;

COMMENT ON TABLE community_directory_orgs IS
  'Staging table for orgs scraped from public community-services directories. Promoted into gs_entities by a downstream ABN-resolve bridge.';
