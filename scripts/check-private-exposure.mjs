#!/usr/bin/env node
/**
 * Is anything ACT-private open to the public key?
 *
 *   node --env-file=.env scripts/check-private-exposure.mjs
 *
 * "Open" is measured by RLS state, the same way /ops/schema measures it, never by grant alone:
 *   table  : anon has SELECT and (RLS is off, or a PERMISSIVE read policy names anon or public)
 *   matview: anon has SELECT (matviews have no RLS)
 *   view   : anon has SELECT and the view is SECURITY DEFINER (runs as postgres, bypasses base RLS)
 * Scope: objects whose schema_ownership.owner is 'act'. Exit 1 and name anything open that is not in ALLOWLIST.
 *
 * Phase 2 option C of the platform review (thoughts/shared/plans/phase2-private-data-boundary.md): the boundary is a gate
 * until the schema move (option B) makes it structural. A new ACT object is not done until it has a register row; an
 * object with no row is invisible here, which is why supabase/migrations/README.md requires the row in the same migration.
 */
import { createClient } from '@supabase/supabase-js';

// Open on purpose. Each entry carries the policy that opens it and why that is acceptable. Adding here is a decision.
const ALLOWLIST = {
  coe_key_people: 'consent-filtered public key-people ("Public can view key people", qual filters rows)',
  partner_storytellers: 'consent-filtered ("Public can view public storytellers")',
  pmpp_knowledge: 'published knowledge only ("Active PMPP is viewable by everyone")',
  newsletter_subscriptions: 'admin-filtered ("Admins can read newsletter subscriptions"); anon sees no rows',
};

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env)'); process.exit(2); }

const sb = createClient(url, key);
const { data, error } = await sb.rpc('exec_sql', { query: `
  SELECT s.object, c.relkind::text AS kind,
    CASE WHEN c.relkind = 'v' THEN 'definer view' WHEN c.relkind = 'm' THEN 'matview grant' WHEN NOT c.relrowsecurity THEN 'no RLS'
         ELSE (SELECT string_agg(p.polname, '; ') FROM pg_policy p WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r','*')
               AND (p.polroles = '{0}' OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname = 'anon'))) END AS why
  FROM schema_ownership s JOIN pg_class c ON c.relname = s.object JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE s.owner = 'act' AND has_table_privilege('anon', c.oid, 'SELECT')
    AND ( (c.relkind IN ('r','p') AND (NOT c.relrowsecurity OR EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r','*')
            AND (p.polroles = '{0}' OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname = 'anon')))))
       OR c.relkind = 'm'
       OR (c.relkind = 'v' AND coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), 'false') <> 'true') )
  ORDER BY s.object` });
if (error) { console.error('exposure query failed:', error.message); process.exit(2); }

const open = data || [];
const unexpected = open.filter((r) => !(r.object in ALLOWLIST));
const stale = Object.keys(ALLOWLIST).filter((o) => !open.some((r) => r.object === o));
console.log(`ACT-owned objects open to the public key: ${open.length} (allowlisted ${open.length - unexpected.length})`);
if (stale.length) console.log(`· allowlist entries no longer open (prune them): ${stale.join(', ')}`);
if (unexpected.length) {
  console.log(`\n✗ ${unexpected.length} ACT-private object(s) open to the public key and NOT allowlisted:`);
  for (const r of unexpected) console.log(`   ${r.object} (${r.kind}) via ${r.why}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=ACT-private data open to the public key::${unexpected.map((r) => r.object).join(', ')}`);
  console.log('\n   close it with a migration through /db-apply (REVOKE from anon, security_invoker, or drop the policy), or add it to ALLOWLIST with a reason.');
  process.exit(1);
}
console.log('✓ nothing ACT-private is open to the public key beyond the allowlist');
