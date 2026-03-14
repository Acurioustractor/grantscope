#!/usr/bin/env node
/**
 * Entity Contact Enrichment
 *
 * Backfills email and phone on gs_entities from multiple sources:
 *   Phase 1: ACNC charities (public register data)
 *   Phase 2: contact_intelligence table (bridge by ABN or name)
 *   Phase 3: ghl_contacts (bridge by email or org name)
 *
 * Only uses publicly available contact details.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-entity-contacts.mjs [--apply] [--limit=5000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const run = await logStart(db, 'enrich-entity-contacts', 'Enrich Entity Contacts');

  try {
    console.log('=== Entity Contact Enrichment ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log();

    let enriched = 0;

    // ── Phase 1: ACNC Charities ────────────────────────────────────────────
    console.log('--- Phase 1: ACNC Charities ---');

    // Check if acnc_charities has contact columns
    const { data: acncCols } = await db
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'acnc_charities')
      .in('column_name', ['email', 'phone', 'contact_email', 'contact_phone']);

    if (acncCols?.length) {
      // ACNC has contact fields — pull them
      const emailCol = acncCols.find(c => c.column_name === 'email' || c.column_name === 'contact_email')?.column_name;
      const phoneCol = acncCols.find(c => c.column_name === 'phone' || c.column_name === 'contact_phone')?.column_name;

      if (emailCol) {
        console.log(`  Found ACNC email column: ${emailCol}`);
        // Match ACNC to entities by ABN
        const { data: acncWithEmail } = await db
          .from('acnc_charities')
          .select(`abn, ${emailCol}`)
          .not(emailCol, 'is', null)
          .limit(LIMIT || 50000);

        if (acncWithEmail?.length) {
          console.log(`  ${acncWithEmail.length} ACNC charities with email`);

          if (APPLY) {
            for (const row of acncWithEmail) {
              const { error } = await db
                .from('gs_entities')
                .update({ email: row[emailCol], contact_source: 'acnc' })
                .eq('abn', row.abn)
                .is('email', null);

              if (!error) enriched++;
            }
          }
        }
      }
    } else {
      console.log('  No contact columns found in acnc_charities — skipping');
    }

    // ── Phase 2: contact_intelligence ────────────────────────────────────────
    console.log('\n--- Phase 2: contact_intelligence ---');

    // Check if table exists
    const { data: ciExists } = await db
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'contact_intelligence')
      .single();

    if (ciExists) {
      const { data: contacts } = await db
        .from('contact_intelligence')
        .select('abn, email, phone, org_name')
        .not('email', 'is', null)
        .limit(LIMIT || 50000);

      if (contacts?.length) {
        console.log(`  ${contacts.length} contact_intelligence records with email`);

        if (APPLY) {
          for (const c of contacts) {
            if (c.abn) {
              const { error } = await db
                .from('gs_entities')
                .update({
                  email: c.email,
                  phone: c.phone || undefined,
                  contact_source: 'contact_intelligence',
                })
                .eq('abn', c.abn)
                .is('email', null);

              if (!error) enriched++;
            }
          }
        }
      } else {
        console.log('  No records with email found');
      }
    } else {
      console.log('  contact_intelligence table not found — skipping');
    }

    // ── Phase 3: ghl_contacts ────────────────────────────────────────────────
    console.log('\n--- Phase 3: ghl_contacts ---');

    const { data: ghlExists } = await db
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'ghl_contacts')
      .single();

    if (ghlExists) {
      const { data: ghlContacts } = await db
        .from('ghl_contacts')
        .select('email, phone, company_name')
        .not('email', 'is', null)
        .not('company_name', 'is', null)
        .limit(LIMIT || 50000);

      if (ghlContacts?.length) {
        console.log(`  ${ghlContacts.length} GHL contacts with email + company`);

        if (APPLY) {
          for (const g of ghlContacts) {
            const { error } = await db
              .from('gs_entities')
              .update({
                email: g.email,
                phone: g.phone || undefined,
                contact_source: 'ghl',
              })
              .ilike('canonical_name', g.company_name)
              .is('email', null);

            if (!error) enriched++;
          }
        }
      } else {
        console.log('  No records found');
      }
    } else {
      console.log('  ghl_contacts table not found — skipping');
    }

    console.log(`\n=== Summary ===`);
    console.log(`Entities enriched: ${enriched}`);
    if (!APPLY) console.log('(DRY RUN — use --apply to write changes)');

    await logComplete(db, run.id, {
      items_found: enriched,
      items_new: enriched,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
