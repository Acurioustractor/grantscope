-- JusticeHub: the publish rule for people records, in the database.
--
-- "Anyone can view public profiles" was USING (is_public = true). `is_public` is
-- a literal the JusticeHub Empathy Ledger sync writes, not consent anybody gave
-- (justicehub src/lib/people/reachable.ts). JusticeHub stopped publishing people
-- with no account on 2026-08-08, because they cannot see or correct what is
-- said about them. This policy kept serving them: measured 2026-09-24, any
-- signed-in user, and sign-up is open, could read 31 profiles, 29 of them
-- people with no account. Anonymous reads already fail (anon may not run
-- is_admin(), which another SELECT policy calls).
--
-- The policy now matches the site: published = is_public AND an account.
-- Rehearsed in a rolled-back transaction first: a new signed-in user then sees
-- 2 profiles and 0 withheld; the owner of a private profile still sees their own.
--
-- Unchanged: own-row, admin and service-role policies. JusticeHub org hubs are
-- unaffected: they reach people through organizations_profiles, which has RLS on
-- and no policies, so no session client can read the link today. Every count and
-- author credit in JusticeHub reads through the service role.

BEGIN;

DROP POLICY "Anyone can view public profiles" ON public.public_profiles;

CREATE POLICY "Anyone can view published profiles" ON public.public_profiles
  FOR SELECT TO public
  USING (is_public = true AND user_id IS NOT NULL);

COMMIT;
