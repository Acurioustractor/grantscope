#!/usr/bin/env node

/**
 * Contract Alert Agent
 *
 * Checks for new AusTender contracts matching entities in active procurement
 * shortlist watches. Creates alerts + notification queue entries.
 *
 * Logic:
 *   1. Load all enabled shortlist watches with their shortlist items
 *   2. Find new austender_contracts since last watch run for those entities (by ABN)
 *   3. Create procurement_alerts for each match
 *   4. Queue notifications in procurement_notification_outbox
 *   5. Update watch last_run_at + snapshot
 *
 * Usage:
 *   node --env-file=.env scripts/check-contract-alerts.mjs [--apply] [--limit=100]
 *
 * Flags:
 *   --apply    Actually write alerts (dry-run by default)
 *   --limit=N  Max contracts to process per watch (default 100)
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'contract-alert-checker';
const AGENT_NAME = 'Contract Alert Checker';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;
  const stats = { watches_checked: 0, new_contracts: 0, alerts_created: 0, notifications_queued: 0 };

  try {
    // 1. Load enabled watches
    const { data: watches, error: watchError } = await db
      .from('procurement_shortlist_watches')
      .select('id, org_profile_id, shortlist_id, last_run_at, interval_hours')
      .eq('enabled', true);

    if (watchError) throw watchError;
    if (!watches?.length) {
      console.log('No enabled watches found.');
      await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    console.log(`Found ${watches.length} enabled watches`);

    for (const watch of watches) {
      stats.watches_checked++;
      const sinceDate = watch.last_run_at || '2020-01-01T00:00:00Z';

      // 2. Get shortlist items with ABNs
      const { data: items } = await db
        .from('procurement_shortlist_items')
        .select('id, entity_name, entity_abn, entity_gs_id')
        .eq('shortlist_id', watch.shortlist_id);

      if (!items?.length) continue;

      const abnList = items.map(i => i.entity_abn).filter(Boolean);
      if (!abnList.length) continue;

      // 3. Find new contracts for these ABNs since last run
      const { data: newContracts } = await db
        .from('austender_contracts')
        .select('id, title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, contract_end, category')
        .in('supplier_abn', abnList)
        .gt('created_at', sinceDate)
        .order('contract_value', { ascending: false })
        .limit(LIMIT);

      if (!newContracts?.length) {
        console.log(`  Watch ${watch.id}: no new contracts since ${sinceDate}`);
        continue;
      }

      console.log(`  Watch ${watch.id}: ${newContracts.length} new contracts found`);
      stats.new_contracts += newContracts.length;

      // Map ABN → shortlist item for attribution
      const abnToItem = new Map(items.map(i => [i.entity_abn, i]));

      for (const contract of newContracts) {
        const item = abnToItem.get(contract.supplier_abn);
        if (!item) continue;

        const alertTitle = `New contract: ${contract.supplier_name || item.entity_name}`;
        const alertBody = `${contract.title} — $${Number(contract.contract_value || 0).toLocaleString()} from ${contract.buyer_name}`;
        const severity = (contract.contract_value || 0) > 1_000_000 ? 'high' : (contract.contract_value || 0) > 100_000 ? 'medium' : 'low';

        if (APPLY) {
          // 4a. Create alert
          const { data: alert, error: alertError } = await db
            .from('procurement_alerts')
            .insert({
              org_profile_id: watch.org_profile_id,
              shortlist_id: watch.shortlist_id,
              shortlist_item_id: item.id,
              alert_type: 'new_contract',
              severity,
              status: 'unread',
              title: alertTitle,
              body: alertBody,
              payload: {
                contract_id: contract.id,
                contract_value: contract.contract_value,
                buyer_name: contract.buyer_name,
                supplier_abn: contract.supplier_abn,
                category: contract.category,
                contract_start: contract.contract_start,
                contract_end: contract.contract_end,
              },
            })
            .select('id')
            .single();

          if (alertError) {
            console.error(`  Alert creation failed: ${alertError.message}`);
            continue;
          }

          stats.alerts_created++;

          // 4b. Queue notification
          const { error: notifError } = await db
            .from('procurement_notification_outbox')
            .insert({
              org_profile_id: watch.org_profile_id,
              shortlist_id: watch.shortlist_id,
              alert_id: alert.id,
              notification_type: 'contract_alert',
              delivery_mode: 'in_app',
              status: 'queued',
              subject: alertTitle,
              body: alertBody,
              payload: { contract_id: contract.id, severity },
              queued_at: new Date().toISOString(),
            });

          if (!notifError) stats.notifications_queued++;
        } else {
          console.log(`  [DRY RUN] Would alert: ${alertTitle}`);
          console.log(`            ${alertBody} (severity: ${severity})`);
          stats.alerts_created++;
        }
      }

      // 5. Update watch snapshot
      if (APPLY) {
        await db
          .from('procurement_shortlist_watches')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: new Date(Date.now() + watch.interval_hours * 3600_000).toISOString(),
            last_alert_count: newContracts.length,
            last_summary: {
              contracts_found: newContracts.length,
              total_value: newContracts.reduce((s, c) => s + (Number(c.contract_value) || 0), 0),
              top_contract: newContracts[0]?.title,
            },
          })
          .eq('id', watch.id);
      }
    }

    console.log(`\nDone. ${stats.watches_checked} watches checked, ${stats.new_contracts} new contracts, ${stats.alerts_created} alerts${APPLY ? ' created' : ' (dry run)'}`);
    await logComplete(db, runId, { items_found: stats.new_contracts, items_new: stats.alerts_created });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
