#!/usr/bin/env node

/**
 * Donor-Contract Crossover Alert Agent
 *
 * Detects when an entity that has made political donations also wins
 * government contracts. This is the core "exposure" intelligence.
 *
 * Logic:
 *   1. Find new austender_contracts in last N days
 *   2. Cross-reference supplier ABNs against political_donations
 *   3. For matches, check if an alert already exists
 *   4. Create new procurement_alerts for crossover events
 *
 * Usage:
 *   node --env-file=.env scripts/check-donor-contract-crossover.mjs [--apply] [--days=7]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'donor-contract-crossover';
const AGENT_NAME = 'Donor-Contract Crossover Detector';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '7');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const runId = await logStart(db, AGENT_ID, AGENT_NAME);
  const stats = { contracts_checked: 0, crossovers_found: 0, alerts_created: 0 };

  try {
    const sinceDate = new Date(Date.now() - DAYS * 86400_000).toISOString();

    // 1. Get recent contracts with ABNs
    const { data: recentContracts, error: contractError } = await db
      .from('austender_contracts')
      .select('id, title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, category')
      .not('supplier_abn', 'is', null)
      .gt('created_at', sinceDate)
      .order('contract_value', { ascending: false })
      .limit(500);

    if (contractError) throw contractError;
    if (!recentContracts?.length) {
      console.log('No new contracts found.');
      await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    stats.contracts_checked = recentContracts.length;
    console.log(`Checking ${recentContracts.length} recent contracts against donation records...`);

    // 2. Get unique supplier ABNs
    const supplierAbns = [...new Set(recentContracts.map(c => c.supplier_abn).filter(Boolean))];

    // 3. Find which of these ABNs have political donations
    const { data: donors } = await db
      .from('political_donations')
      .select('donor_abn, donor_name, donation_to, amount, financial_year')
      .in('donor_abn', supplierAbns)
      .order('amount', { ascending: false });

    if (!donors?.length) {
      console.log('No crossovers found.');
      await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    // Group donations by ABN
    const donationsByAbn = new Map();
    for (const d of donors) {
      if (!donationsByAbn.has(d.donor_abn)) donationsByAbn.set(d.donor_abn, []);
      donationsByAbn.get(d.donor_abn).push(d);
    }

    console.log(`Found ${donationsByAbn.size} supplier ABNs with donation history`);

    // 4. Create alerts for crossover events
    for (const contract of recentContracts) {
      const donorRecords = donationsByAbn.get(contract.supplier_abn);
      if (!donorRecords) continue;

      stats.crossovers_found++;

      const totalDonated = donorRecords.reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const parties = [...new Set(donorRecords.map(d => d.donation_to))].join(', ');
      const severity = (contract.contract_value || 0) > 10_000_000 ? 'critical'
        : (contract.contract_value || 0) > 1_000_000 ? 'high' : 'medium';

      const alertTitle = `Donor-contractor crossover: ${contract.supplier_name}`;
      const alertBody = `Won $${Number(contract.contract_value || 0).toLocaleString()} contract from ${contract.buyer_name}. ` +
        `Has donated $${totalDonated.toLocaleString()} to ${parties} across ${donorRecords.length} records.`;

      if (APPLY) {
        // Check for existing alert on this contract
        const { data: existing } = await db
          .from('procurement_alerts')
          .select('id')
          .eq('alert_type', 'donor_contract_crossover')
          .eq('payload->>contract_id', contract.id)
          .maybeSingle();

        if (existing) continue;

        const { error: alertError } = await db
          .from('procurement_alerts')
          .insert({
            alert_type: 'donor_contract_crossover',
            severity,
            status: 'unread',
            title: alertTitle,
            body: alertBody,
            payload: {
              contract_id: contract.id,
              contract_value: contract.contract_value,
              buyer_name: contract.buyer_name,
              supplier_abn: contract.supplier_abn,
              supplier_name: contract.supplier_name,
              total_donated: totalDonated,
              donation_count: donorRecords.length,
              parties_donated_to: parties,
              category: contract.category,
            },
          });

        if (alertError) {
          console.error(`  Alert creation failed: ${alertError.message}`);
          continue;
        }
        stats.alerts_created++;
      } else {
        console.log(`  [DRY RUN] ${severity.toUpperCase()}: ${alertTitle}`);
        console.log(`            ${alertBody}`);
        stats.alerts_created++;
      }
    }

    console.log(`\nDone. ${stats.contracts_checked} contracts checked, ${stats.crossovers_found} crossovers, ${stats.alerts_created} alerts${APPLY ? ' created' : ' (dry run)'}`);
    await logComplete(db, runId, { items_found: stats.crossovers_found, items_new: stats.alerts_created });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
