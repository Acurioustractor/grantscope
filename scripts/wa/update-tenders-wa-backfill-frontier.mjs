#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const ROOT = resolve('data/wa-tenders/history');
const db = APPLY
  ? createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  : null;

async function main() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const days = [];
  for (const entry of entries) {
    const match = entry.isDirectory() && entry.name.match(/^(\d{4}-\d{2}-\d{2})_\1$/);
    if (!match) continue;
    const manifest = JSON.parse(await readFile(resolve(ROOT, entry.name, 'manifest.json'), 'utf8'));
    days.push({
      day: match[1],
      complete: manifest.complete === true,
      contracts: Array.isArray(manifest.contracts) ? manifest.contracts.length : 0,
      message: manifest.result_message ?? null,
    });
  }
  days.sort((a, b) => a.day.localeCompare(b.day));
  const completeDays = days.filter((day) => day.complete);
  const blockedDays = days.filter((day) => !day.complete);
  const summary = {
    complete_days: completeDays.length,
    blocked_days: blockedDays.length,
    coverage_from: completeDays[0]?.day ?? null,
    coverage_to: completeDays.at(-1)?.day ?? null,
    contracts_discovered: completeDays.reduce((sum, day) => sum + day.contracts, 0),
    blocked: blockedDays,
  };

  if (APPLY) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required with --apply');
    const { data: frontier, error: frontierReadError } = await db
      .from('source_frontier')
      .select('metadata')
      .eq('source_key', 'wa-transition:tenders-wa')
      .single();
    if (frontierReadError) throw frontierReadError;
    const { count: totalContracts, error: countError } = await db
      .from('state_tenders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'tenders-wa');
    if (countError) throw countError;
    const currentWindow = Number(frontier.metadata?.window_contracts ?? 0);
    const now = new Date().toISOString();
    const { error: updateError } = await db
      .from('source_frontier')
      .update({
        metadata: {
          ...frontier.metadata,
          historical_evidence_status: blockedDays.length ? 'partial-with-blocked-days' : 'complete-for-recorded-range',
          historical_complete_days: summary.complete_days,
          historical_blocked_days: summary.blocked_days,
          historical_coverage_from: summary.coverage_from,
          historical_coverage_to: summary.coverage_to,
          historical_contracts: Math.max(0, Number(totalContracts ?? 0) - currentWindow),
          historical_manifest_contracts: summary.contracts_discovered,
          historical_collector: 'scripts/wa/backfill-tenders-wa-history.mjs',
        },
        updated_at: now,
      })
      .eq('source_key', 'wa-transition:tenders-wa');
    if (updateError) throw updateError;
    summary.stored_contracts = totalContracts;
    summary.historical_contracts = Math.max(0, Number(totalContracts ?? 0) - currentWindow);
  }

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', ...summary }, null, 2));
}

main().catch((error) => {
  console.error(`[tenders-wa-frontier] ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
