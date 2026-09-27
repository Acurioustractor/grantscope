#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function query(sql) {
  const { data, error } = await db.rpc('exec_sql', { query: sql });
  if (error) throw error;
  return data;
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  if (!APPLY) {
    const profile = await query(`
      SELECT
        COUNT(*)::bigint AS contracts,
        COUNT(DISTINCT supplier_name)::bigint AS published_supplier_labels,
        COUNT(*) FILTER (WHERE supplier_abn IS NOT NULL)::bigint AS contracts_with_supplier_abn,
        COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(suppliers, '[]'::jsonb)) > 1)::bigint AS multi_supplier_contracts
      FROM state_tenders
      WHERE state = 'WA' AND source IN ('tenders-wa', 'data-wa-tenders')
    `);
    console.log(JSON.stringify({ mode: 'dry-run', action: 'profile-only', profile: profile[0] }, null, 2));
    return;
  }

  if (!process.env.DATABASE_PASSWORD) throw new Error('DATABASE_PASSWORD is required for the full resolver run');
  const output = execFileSync('psql', [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com',
    '-p', '5432',
    '-U', 'postgres.tednluwflfhxyucgwigh',
    '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-At',
    '-c', 'SET statement_timeout = 0; SELECT public.refresh_wa_supplier_entity_matches();',
  ], {
    env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD },
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
  });
  const summaryLine = output.trim().split('\n').find((line) => line.trim().startsWith('{'));
  const summary = summaryLine ? JSON.parse(summaryLine) : { raw_output: output.trim() };

  const queue = await query(`
    SELECT
      COUNT(*)::bigint AS queue_records,
      COUNT(*) FILTER (WHERE c.matched_entity_id IS NOT NULL)::bigint AS entity_linked,
      COUNT(*) FILTER (WHERE c.supplier_is_community_controlled = true)::bigint AS community_controlled_signals,
      COUNT(*) FILTER (WHERE c.is_kimberley)::bigint AS kimberley_records,
      COUNT(*) FILTER (WHERE c.is_kimberley AND c.matched_entity_id IS NOT NULL)::bigint AS kimberley_entity_linked,
      COUNT(*) FILTER (WHERE c.is_kimberley AND c.supplier_is_community_controlled = true)::bigint AS kimberley_community_controlled_signals
    FROM wa_transition_candidates c
    WHERE c.candidate_status IN ('candidate', 'review')
  `);

  console.log(JSON.stringify({ mode: 'apply', summary, transition_queue: queue[0] }, null, 2));
}

main().catch((error) => {
  console.error(`[wa-supplier-entity-resolution] ${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}`);
  process.exit(1);
});
