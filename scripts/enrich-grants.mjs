#!/usr/bin/env node

/**
 * Enrich Grants
 *
 * Uses Claude Haiku to extract eligibility criteria and target recipients
 * from grant descriptions. Processes grants that haven't been enriched yet.
 *
 * Requires: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node scripts/enrich-grants.mjs [--limit 500]
 */

import { createClient } from '@supabase/supabase-js';
import { batchEnrich } from '../packages/grant-engine/src/index.ts';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

const limit = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--limit') || '500', 10);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('=== Enrich Grants ===');
console.log(`Limit: ${limit}`);
console.log();

const result = await batchEnrich(supabase, {
  apiKey: ANTHROPIC_API_KEY,
  limit,
  onProgress: console.log,
});

console.log();
console.log(`Done: ${result.enriched} enriched, ${result.errors} errors`);
process.exit(result.errors > 0 ? 1 : 0);
