#!/usr/bin/env node

/**
 * Ingest Social Traders certified social enterprises into GrantScope
 *
 * Source: Social Traders Algolia index (665 certified enterprises)
 * Target: social_enterprises table + gs_entities entity linking
 *
 * Usage: node --env-file=.env scripts/ingest-social-traders.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const started = Date.now();

function log(msg) {
  console.log(`[social-traders] ${msg}`);
}

function algoliaQuery(params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: '66OIGR2MRB-dsn.algolia.net',
      path: '/1/indexes/staging_accounts/query',
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': '66OIGR2MRB',
        'X-Algolia-API-Key': 'd41cf5484af49d9b0a1d90b8286d438e',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchAllEnterprises() {
  const allHits = [];
  let page = 0;

  while (true) {
    const result = await algoliaQuery({
      query: '',
      hitsPerPage: 100,
      page,
      facetFilters: [['status__c:Certified', 'status__c:Certified (Grace Period)']],
      attributesToRetrieve: [
        'name', 'website', 'status__c', 'address',
        'supplier_product_service', 'primary_beneficiaries',
        'business_model__c', 'membership_type__c',
        '_geoloc', 'objectID', 'accountIDsafe__c',
        'office_locations', 'logo',
      ],
    });

    allHits.push(...result.hits);
    log(`Page ${page + 1}: ${result.hits.length} hits (${allHits.length}/${result.nbHits})`);
    if (allHits.length >= result.nbHits || result.hits.length === 0) break;
    page++;
  }

  return allHits;
}

async function main() {
  log(`Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const enterprises = await fetchAllEnterprises();
  log(`Fetched ${enterprises.length} certified social enterprises from Algolia`);

  // Load existing social_enterprises for dedup by name
  const { data: existing } = await supabase
    .from('social_enterprises')
    .select('id, name, source_primary')
    .eq('source_primary', 'social-traders');

  const existingNames = new Set((existing || []).map(e => e.name.toUpperCase().trim()));
  log(`Existing Social Traders records: ${existingNames.size}`);

  let itemsNew = 0;
  let itemsUpdated = 0;
  const errors = [];

  for (const ent of enterprises) {
    const addr = ent.address || {};
    const postcode = addr.postalCode || addr.postal_code_zip || null;
    const state = addr.state || null;
    const services = ent.supplier_product_service || [];
    const certStatus = ent.status__c === 'Certified'
      ? 'Social Traders Certified'
      : 'Social Traders Certified (Grace Period)';

    const rawBeneficiaries = ent.primary_beneficiaries;
    const beneficiaries = Array.isArray(rawBeneficiaries)
      ? rawBeneficiaries
      : rawBeneficiaries ? [rawBeneficiaries] : [];
    const officeLocations = ent.office_locations || [];

    const record = {
      name: ent.name,
      source_primary: 'social-traders',
      org_type: 'social_enterprise',
      certifications: [certStatus],
      sector: services.length > 0 ? services : null,
      website: ent.website || null,
      state: state,
      postcode: postcode ? String(postcode).padStart(4, '0') : null,
      city: addr.city || null,
      target_beneficiaries: beneficiaries.length > 0 ? beneficiaries : null,
      logo_url: ent.logo || null,
      business_model: ent.business_model__c || null,
      sources: {
        social_traders: {
          objectID: ent.objectID,
          accountID: ent.accountIDsafe__c || null,
          services,
          beneficiaries: beneficiaries.length > 0 ? beneficiaries : null,
          business_model: ent.business_model__c || null,
          membership_type: ent.membership_type__c || null,
          office_locations: officeLocations.length > 0 ? officeLocations : null,
          geo: ent._geoloc || null,
          synced_at: new Date().toISOString(),
        },
      },
    };

    const isNew = !existingNames.has(ent.name.toUpperCase().trim());

    if (DRY_RUN) {
      if (isNew) {
        log(`[NEW] ${ent.name} | ${state} ${postcode} | ${services.slice(0, 2).join(', ')}`);
        itemsNew++;
      } else {
        itemsUpdated++;
      }
      continue;
    }

    try {
      if (isNew) {
        const { error } = await supabase.from('social_enterprises').insert(record);
        if (error) {
          errors.push(`${ent.name}: ${error.message}`);
          continue;
        }
        itemsNew++;
      } else {
        // Update existing
        const { error } = await supabase
          .from('social_enterprises')
          .update({
            certifications: record.certifications,
            sector: record.sector,
            website: record.website,
            state: record.state,
            postcode: record.postcode,
            city: record.city,
            target_beneficiaries: record.target_beneficiaries,
            logo_url: record.logo_url,
            business_model: record.business_model,
            sources: record.sources,
          })
          .eq('name', ent.name)
          .eq('source_primary', 'social-traders');

        if (error) {
          errors.push(`update ${ent.name}: ${error.message}`);
          continue;
        }
        itemsUpdated++;
      }
    } catch (e) {
      errors.push(`${ent.name}: ${e.message}`);
    }
  }

  log(`Results: ${itemsNew} new, ${itemsUpdated} updated, ${errors.length} errors`);

  // Link to gs_entities where possible (by exact or fuzzy name match)
  if (!DRY_RUN) {
    log('Linking to gs_entities...');
    const { data: seRecords } = await supabase
      .from('social_enterprises')
      .select('id, name, abn')
      .eq('source_primary', 'social-traders');

    let linked = 0;
    for (const se of seRecords || []) {
      // Try exact name match
      const { data: entities } = await supabase
        .from('gs_entities')
        .select('id, source_datasets')
        .ilike('canonical_name', se.name.replace(/'/g, "''"))
        .limit(1);

      if (entities && entities.length > 0) {
        const entity = entities[0];
        if (!entity.source_datasets?.includes('social_enterprises')) {
          const datasets = [...(entity.source_datasets || []), 'social_enterprises'];
          await supabase
            .from('gs_entities')
            .update({ source_datasets: datasets, source_count: datasets.length })
            .eq('id', entity.id);
          linked++;
        }
      }
    }
    log(`Linked ${linked} social enterprises to gs_entities`);
  }

  if (!DRY_RUN) {
    const run = await logStart(supabase, 'social-traders-sync', 'Sync Social Traders');
    if (run) {
      await logComplete(supabase, run.id, {
        items_found: enterprises.length,
        items_new: itemsNew,
        items_updated: itemsUpdated,
      });
    }
  }

  log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (errors.length > 0) {
    log(`First 5 errors:`);
    errors.slice(0, 5).forEach(e => log(`  - ${e}`));
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
