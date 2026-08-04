-- Carry ORIC registration status onto entities, and fill location from ORIC.
--
-- Aboriginal and Torres Strait Islander corporations register with ORIC, not
-- the ACNC, so the ACNC-shaped enrichment misses them: of 8,501 indigenous
-- corporations in the graph only 1,388 appear in the ACNC register, and 2,712
-- carry no location at all.
--
-- oric_corporations already sits in this database with 7,369 rows including
-- state and postcode. It was never joined to gs_entities. Two things follow.
--
-- First, status matters more than location. 4,003 of those 7,369 corporations
-- are DEREGISTERED, and 936 entities in the graph match one. The Central
-- Australia place page published 28 deregistered corporations as though they
-- were current community organisations. Presenting a defunct corporation as an
-- active community body misrepresents the community it belonged to, and no
-- amount of correct funding arithmetic makes up for it.
--
-- Second, ORIC only publishes an address for corporations still registered, so
-- location backfill reaches the live ones and leaves the rest unlocated. That
-- is the correct outcome: the Utopia arts, land and cultural corporations have
-- no address in ORIC because they are deregistered, not because the data is
-- missing.
--
-- Name matching is limited to exact normalised equality on indigenous
-- corporations, and only where no ABN exists to match on. ORIC names are
-- distinctive enough for that to be safe; anything looser would repeat the
-- name-similarity failure that produced phantom funders.

ALTER TABLE public.gs_entities
  ADD COLUMN IF NOT EXISTS oric_icn text,
  ADD COLUMN IF NOT EXISTS oric_status text,
  ADD COLUMN IF NOT EXISTS oric_matched_by text;

CREATE INDEX IF NOT EXISTS gs_entities_oric_status_idx ON public.gs_entities (oric_status)
  WHERE oric_status IS NOT NULL;

COMMENT ON COLUMN public.gs_entities.oric_status IS
  'ORIC registration status. Deregistered corporations must not be presented as current organisations on any public surface.';
COMMENT ON COLUMN public.gs_entities.oric_matched_by IS
  'How the ORIC record was matched: abn or exact_name. Exact_name is only used where the entity has no ABN.';

-- ABN is identity, so it goes first and wins.
UPDATE public.gs_entities e
   SET oric_icn = o.icn,
       oric_status = o.status,
       oric_matched_by = 'abn'
  FROM public.oric_corporations o
 WHERE o.abn = e.abn
   AND e.abn IS NOT NULL
   AND o.abn IS NOT NULL;

-- Exact normalised name, only for ABN-less indigenous corporations, and only
-- where the ORIC name is unambiguous.
UPDATE public.gs_entities e
   SET oric_icn = m.icn,
       oric_status = m.status,
       oric_matched_by = 'exact_name'
  FROM (
    SELECT upper(trim(o.name)) AS key, min(o.icn) AS icn, min(o.status) AS status
      FROM public.oric_corporations o
     GROUP BY upper(trim(o.name))
    HAVING count(*) = 1
  ) m
 WHERE e.abn IS NULL
   AND e.entity_type = 'indigenous_corp'
   AND e.oric_status IS NULL
   AND upper(trim(e.canonical_name)) = m.key;

-- Fill location only where we have none. An existing value came from somewhere
-- and is not overwritten by this.
UPDATE public.gs_entities e
   SET postcode = coalesce(e.postcode, o.postcode),
       state = coalesce(e.state, o.state)
  FROM public.oric_corporations o
 WHERE o.icn = e.oric_icn
   AND (e.postcode IS NULL OR e.state IS NULL)
   AND (o.postcode IS NOT NULL OR o.state IS NOT NULL);

-- Register the residue: corporations we know of but cannot place, because ORIC
-- publishes no address once a corporation is deregistered.
INSERT INTO public.geo_resolution_gaps (postcode, issue, affected_entities, affected_community_controlled, required_source)
SELECT
  'unlocated',
  'Deregistered ORIC corporations carry no published address, so they cannot be placed',
  count(*)::int,
  count(*) FILTER (WHERE is_community_controlled OR entity_type = 'indigenous_corp')::int,
  'Historical ORIC extract with addresses as at deregistration, or ABR historical address data'
FROM public.gs_entities
WHERE oric_status = 'Deregistered' AND postcode IS NULL
ON CONFLICT (postcode, issue) DO UPDATE SET
  affected_entities = EXCLUDED.affected_entities,
  affected_community_controlled = EXCLUDED.affected_community_controlled,
  detected_at = now();
