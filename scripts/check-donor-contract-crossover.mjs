#!/usr/bin/env node

/**
 * Donor-Contract Crossover Alert Agent
 *
 * Detects when an entity that has made political donations also wins
 * government contracts. This is the core "exposure" intelligence.
 *
 * Strategy:
 *   1. Use the mv_gs_donor_contractors materialized view for known crossovers
 *   2. Find all contracts for those ABNs
 *   3. Create alerts for high-value crossover events (deduped by contract ID)
 *
 * Usage:
 *   node --env-file=.env scripts/check-donor-contract-crossover.mjs [--apply] [--days=7] [--min-value=100000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'donor-contract-crossover';
const AGENT_NAME = 'Donor-Contract Crossover Detector';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '7');
const MIN_VALUE = parseInt(process.argv.find(a => a.startsWith('--min-value='))?.split('=')[1] || '100000');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;
  const stats = { contracts_checked: 0, crossovers_found: 0, alerts_created: 0, skipped_existing: 0 };

  try {
    // 1. Load all donor ABN → aggregated donation stats
    // We aggregate client-side to avoid needing SQL functions
    console.log('Loading donor ABN aggregates from political_donations...');
    const donorStats = new Map(); // abn → { totalDonated, donationCount, parties, topDonorName }

    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data: rows, error } = await db
        .from('political_donations')
        .select('donor_abn, donor_name, donation_to, amount')
        .not('donor_abn', 'is', null)
        .neq('donor_abn', '')
        .order('donor_abn', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      if (!rows?.length) break;

      for (const r of rows) {
        const existing = donorStats.get(r.donor_abn);
        if (existing) {
          existing.totalDonated += Number(r.amount) || 0;
          existing.donationCount++;
          if (r.donation_to) existing.parties.add(r.donation_to);
        } else {
          donorStats.set(r.donor_abn, {
            totalDonated: Number(r.amount) || 0,
            donationCount: 1,
            parties: new Set(r.donation_to ? [r.donation_to] : []),
            topDonorName: r.donor_name,
          });
        }
      }

      page++;
      if (rows.length < PAGE_SIZE) break;
      if (page % 10 === 0) console.log(`  Loaded ${page * PAGE_SIZE} donation records, ${donorStats.size} unique ABNs...`);
    }

    console.log(`Loaded ${donorStats.size} unique donor ABNs from ${page * PAGE_SIZE} records`);

    // 2. Load existing alert contract IDs to skip
    console.log('Loading existing alert contract IDs...');
    const existingAlertContractIds = new Set();
    let alertPage = 0;
    while (true) {
      const { data: alerts } = await db
        .from('procurement_alerts')
        .select('payload')
        .eq('alert_type', 'donor_contract_crossover')
        .range(alertPage * PAGE_SIZE, (alertPage + 1) * PAGE_SIZE - 1);

      if (!alerts?.length) break;
      for (const a of alerts) {
        if (a.payload?.contract_id) existingAlertContractIds.add(a.payload.contract_id);
      }
      alertPage++;
      if (alerts.length < PAGE_SIZE) break;
    }
    console.log(`Found ${existingAlertContractIds.size} existing alerts to skip`);

    // 3. Paginate through contracts, checking for crossovers
    const sinceDate = DAYS >= 9000 ? '1900-01-01' : new Date(Date.now() - DAYS * 86400_000).toISOString().split('T')[0];
    console.log(`\nScanning contracts since ${sinceDate} with value >= $${MIN_VALUE.toLocaleString()}...`);

    let contractPage = 0;
    while (true) {
      let query = db
        .from('austender_contracts')
        .select('id, title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, category')
        .not('supplier_abn', 'is', null)
        .gte('contract_value', MIN_VALUE)
        .order('id', { ascending: true })
        .range(contractPage * PAGE_SIZE, (contractPage + 1) * PAGE_SIZE - 1);

      if (DAYS < 9000) {
        query = query.gte('contract_start', sinceDate);
      }

      const { data: contracts, error: contractError } = await query;
      if (contractError) throw contractError;
      if (!contracts?.length) break;

      stats.contracts_checked += contracts.length;

      for (const contract of contracts) {
        const donor = donorStats.get(contract.supplier_abn);
        if (!donor) continue;

        stats.crossovers_found++;

        // Skip if alert already exists
        if (existingAlertContractIds.has(contract.id)) {
          stats.skipped_existing++;
          continue;
        }

        const severity = (contract.contract_value || 0) > 10_000_000 ? 'critical'
          : (contract.contract_value || 0) > 1_000_000 ? 'high' : 'medium';

        const parties = [...donor.parties].join(', ');
        const alertTitle = `Donor-contractor crossover: ${contract.supplier_name}`;
        const alertBody = `Won $${Number(contract.contract_value || 0).toLocaleString()} contract from ${contract.buyer_name}. ` +
          `Has donated $${donor.totalDonated.toLocaleString()} to ${parties} across ${donor.donationCount} records.`;

        if (APPLY) {
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
                total_donated: donor.totalDonated,
                donation_count: donor.donationCount,
                parties_donated_to: parties,
                category: contract.category,
              },
            });

          if (alertError) {
            console.error(`  Alert creation failed: ${alertError.message}`);
            continue;
          }
          stats.alerts_created++;
          existingAlertContractIds.add(contract.id);
        } else {
          if (stats.alerts_created < 20) {
            console.log(`  [DRY RUN] ${severity.toUpperCase()}: ${alertTitle}`);
            console.log(`            ${alertBody}`);
          }
          stats.alerts_created++;
        }
      }

      contractPage++;
      if (contracts.length < PAGE_SIZE) break;
      if (contractPage % 50 === 0) {
        console.log(`  Processed ${stats.contracts_checked} contracts, ${stats.crossovers_found} crossovers, ${stats.alerts_created} new alerts...`);
      }
    }

    console.log(`\nDone. ${stats.contracts_checked} contracts checked, ${stats.crossovers_found} crossovers found`);
    console.log(`  ${stats.alerts_created} new alerts${APPLY ? ' created' : ' (dry run)'}, ${stats.skipped_existing} already existed`);
    await logComplete(db, runId, { items_found: stats.crossovers_found, items_new: stats.alerts_created });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
