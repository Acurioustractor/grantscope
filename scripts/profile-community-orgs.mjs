#!/usr/bin/env tsx
/**
 * Profile Community Organizations
 *
 * Imports small community orgs from ACNC data, estimates admin burden,
 * and builds the community_orgs table.
 *
 * Usage:
 *   tsx scripts/profile-community-orgs.mjs                    # Import all
 *   tsx scripts/profile-community-orgs.mjs --domain youth     # Filter by domain
 *   tsx scripts/profile-community-orgs.mjs --limit 100        # Limit batch size
 */

import { createClient } from '@supabase/supabase-js';
import { importCommunityOrgs } from '@grantscope/engine/src/foundations/community-profiler.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const domain = process.argv.includes('--domain')
  ? process.argv[process.argv.indexOf('--domain') + 1]
  : undefined;

const limit = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : 500;

async function main() {
  console.log('=== Community Org Profiling ===\n');
  if (domain) console.log(`Domain filter: ${domain}`);
  console.log(`Batch size: ${limit}\n`);

  const result = await importCommunityOrgs(supabase, { limit, domain });

  console.log(`\n✓ Imported: ${result.imported}`);
  console.log(`○ Skipped: ${result.skipped}`);
  if (result.errors.length) {
    console.log(`✗ Errors: ${result.errors.length}`);
    for (const e of result.errors.slice(0, 5)) {
      console.log(`  ${e}`);
    }
  }

  // Summary stats
  const { count } = await supabase
    .from('community_orgs')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal community orgs in DB: ${count}`);
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
