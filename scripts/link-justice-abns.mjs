#!/usr/bin/env node
/**
 * link-justice-abns.mjs
 *
 * Links justice_funding records missing recipient_abn to gs_entities
 * using pg_trgm fuzzy matching via the <-> operator (uses GiST index).
 *
 * Processes in batches to avoid statement timeouts.
 *
 * Usage:
 *   node --env-file=.env scripts/link-justice-abns.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function sql(query) {
  const { data, error } = await db.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}\nQuery: ${query.substring(0, 200)}`);
  return data;
}

async function main() {
  log('╔══════════════════════════════════════════════════╗');
  log('║  Justice Funding ABN Linkage                     ║');
  log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                  ║`);
  log('╚══════════════════════════════════════════════════╝');

  // Get before state
  const before = await sql(`SELECT COUNT(*) as total, COUNT(recipient_abn) as has_abn FROM justice_funding`);
  log(`Before: ${before[0].has_abn}/${before[0].total} have ABN`);

  // Get unique unlinked recipient names ordered by total funding (paginated to avoid exec_sql row limit)
  let unlinked = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const page = await sql(`
      SELECT recipient_name, COUNT(*) as records, COALESCE(SUM(amount_dollars), 0) as total_amount
      FROM justice_funding
      WHERE recipient_abn IS NULL
        AND recipient_name IS NOT NULL
        AND length(recipient_name) > 3
        AND recipient_name NOT SIMILAR TO '%(Total|total|Youth Justice -)%'
        AND recipient_name !~ '^[0-9]+$'
      GROUP BY recipient_name
      ORDER BY COALESCE(SUM(amount_dollars), 0) DESC NULLS LAST
      LIMIT ${PAGE} OFFSET ${offset}
    `);
    unlinked.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  log(`Unique unlinked recipients: ${unlinked.length}`);

  let totalMatched = 0, totalRecordsUpdated = 0, noMatch = 0, errors = 0;
  const matches = [];

  for (let i = 0; i < unlinked.length; i++) {
    const row = unlinked[i];
    const name = row.recipient_name?.trim();
    if (!name) continue;

    const escaped = name.replace(/'/g, "''");

    try {
      // Use <-> operator which leverages the GiST trgm index
      // Threshold 0.75 to avoid false positives (0.5-0.7 range has many wrong matches)
      const result = await sql(`
        SELECT canonical_name, abn,
               1 - (lower(canonical_name) <-> lower('${escaped}')) as sim
        FROM gs_entities
        WHERE abn IS NOT NULL
          AND lower(canonical_name) <-> lower('${escaped}') < 0.25
        ORDER BY lower(canonical_name) <-> lower('${escaped}')
        LIMIT 1
      `);

      if (result.length > 0 && result[0].sim >= 0.75) {
        const m = result[0];
        totalMatched++;
        matches.push({
          name,
          match: m.canonical_name,
          abn: m.abn,
          sim: m.sim,
          records: parseInt(row.records),
          amount: parseFloat(row.total_amount) || 0,
        });

        if (!DRY_RUN) {
          const { error: updateErr } = await db
            .from('justice_funding')
            .update({ recipient_abn: m.abn })
            .eq('recipient_name', name)
            .is('recipient_abn', null);
          if (updateErr) throw new Error(`Update error: ${updateErr.message}`);
          totalRecordsUpdated += parseInt(row.records);
        }
      } else {
        noMatch++;
      }
    } catch (e) {
      errors++;
      if (errors <= 5) log(`  ⚠ Error for "${name.substring(0, 40)}": ${e.message.substring(0, 80)}`);
    }

    if ((i + 1) % 100 === 0) {
      log(`  Progress: ${i + 1}/${unlinked.length} | matched: ${totalMatched} | updated: ${totalRecordsUpdated} records`);
    }
  }

  log('\n═══ Summary ═══');
  log(`  Processed: ${unlinked.length} unique names`);
  log(`  Matched: ${totalMatched} names → ${totalRecordsUpdated} records`);
  log(`  No match: ${noMatch}`);
  log(`  Errors: ${errors}`);

  // Show top matches by funding amount
  matches.sort((a, b) => b.amount - a.amount);
  log('\n═══ Top Matches (by funding amount) ═══');
  for (const m of matches.slice(0, 30)) {
    const amt = m.amount ? `$${(m.amount / 1e6).toFixed(1)}M` : '$?';
    log(`  ${(m.sim * 100).toFixed(0)}% | ${m.name.substring(0, 42).padEnd(42)} → ${m.match.substring(0, 42)} | ${m.records} recs, ${amt}`);
  }

  // Show lowest-confidence matches for review
  matches.sort((a, b) => a.sim - b.sim);
  log('\n═══ Lowest Confidence Matches (review for false positives) ═══');
  for (const m of matches.slice(0, 15)) {
    log(`  ${(m.sim * 100).toFixed(0)}% | ${m.name.substring(0, 42).padEnd(42)} → ${m.match.substring(0, 42)}`);
  }

  if (DRY_RUN) {
    log('\n⚠ DRY RUN — no changes made. Remove --dry-run to apply.');
  } else {
    // Verify
    const after = await sql(`SELECT COUNT(*) as total, COUNT(recipient_abn) as has_abn FROM justice_funding`);
    log(`\nAfter: ${after[0].has_abn}/${after[0].total} have ABN (was ${before[0].has_abn})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
