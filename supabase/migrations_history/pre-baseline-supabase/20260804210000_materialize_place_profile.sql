-- Materialize the place profile.
--
-- v_lga_place_profile aggregates contracts, grants, philanthropy and SEIFA
-- across every LGA in the country before any filter is applied, so a page
-- asking for five councils still paid for all 492. It timed out in the request
-- path and took the page down with it.
--
-- The numbers are stable between ingests, so they are computed once and read
-- many times. This replaces place_funding_snapshot, which held the same idea
-- but predated the council reattribution and GrantConnect, and was still
-- serving $749.4M for Alice Springs after the real figure became $688.4M.
-- Refresh after any funding ingest.

DROP MATERIALIZED VIEW IF EXISTS public.mv_lga_place_profile;

CREATE MATERIALIZED VIEW public.mv_lga_place_profile AS
SELECT * FROM public.v_lga_place_profile;

-- Unique index so the refresh can run CONCURRENTLY and not block readers.
CREATE UNIQUE INDEX mv_lga_place_profile_key_idx
  ON public.mv_lga_place_profile (lga_name, coalesce(state, ''));
CREATE INDEX mv_lga_place_profile_state_idx ON public.mv_lga_place_profile (state);

GRANT SELECT ON public.mv_lga_place_profile TO anon, authenticated, service_role;

COMMENT ON MATERIALIZED VIEW public.mv_lga_place_profile IS
  'Materialized v_lga_place_profile. The view aggregates every LGA before filtering, so reading it per request timed out. Refresh after any funding ingest.';
