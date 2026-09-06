-- ecosystem_sites: let the public key read it.
--
-- RLS is on and the only policy is "Allow all for service role", so anon and
-- authenticated reads return 0 rows even though the SELECT grant exists. The
-- studio's ecosystem page reads this table with the publishable key to show
-- live / broken and last deploy per ACT site. Columns are site names, URLs,
-- Vercel ids and timestamps; nothing private. Writes stay service-role only
-- (no anon write policy is added here). Plan:
-- act-global-infrastructure/thoughts/shared/plans/project-record-and-site-sync.md
BEGIN;

DROP POLICY IF EXISTS "Public read of ecosystem sites" ON public.ecosystem_sites;
CREATE POLICY "Public read of ecosystem sites"
  ON public.ecosystem_sites
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMIT;

-- post-check:
-- SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid)
--   FROM pg_policy WHERE polrelid='public.ecosystem_sites'::regclass;
-- and an anon PostgREST read of ecosystem_sites returns rows (was 0).
