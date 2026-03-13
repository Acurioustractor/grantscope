#!/usr/bin/env node

/**
 * Ingest Social Traders public finder organisations into GrantScope
 *
 * Source: Social Traders Algolia index (all public social-enterprise finder records)
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

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function buildDescription({ services, beneficiaries, businessModel, statusLabel, membershipType }) {
  const bits = [];
  if (businessModel) bits.push(businessModel.trim());
  if (services.length > 0) bits.push(`Products and services include ${services.slice(0, 4).join(', ')}.`);
  if (beneficiaries.length > 0) bits.push(`Primary beneficiaries include ${beneficiaries.slice(0, 3).join(', ')}.`);
  if (statusLabel) bits.push(`Social Traders status: ${statusLabel}.`);
  if (membershipType) bits.push(`Membership: ${membershipType}.`);
  return bits.length > 0 ? bits.join(' ') : null;
}

function buildGeographicFocus({ state, city, officeLocations, location }) {
  const stateValues = [
    state,
    ...toArray(location),
    ...officeLocations.map((office) => office?.address?.state || null),
  ];
  const cityValues = [
    city,
    ...officeLocations.map((office) => office?.address?.city_suburb || office?.address?.city || null),
  ];
  return unique([...stateValues, ...cityValues]);
}

function inferProfileConfidence({ website, businessModel, beneficiaries, geographicFocus, profilePublished, visibleOnWebsite }) {
  const signalCount = [
    Boolean(website),
    Boolean(businessModel),
    beneficiaries.length > 0,
    geographicFocus.length > 0,
    Boolean(profilePublished),
    Boolean(visibleOnWebsite),
  ].filter(Boolean).length;

  if (signalCount >= 5) return 'high';
  if (signalCount >= 3) return 'medium';
  return 'low';
}

function mergeUniqueList(existing, incoming) {
  return unique([...(existing || []), ...(incoming || [])]);
}

function mergeCertifications(existing, incoming) {
  const existingList = Array.isArray(existing) ? existing : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const seen = new Set();
  const merged = [];
  for (const item of [...existingList, ...incomingList]) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.length > 0 ? merged : null;
}

function isEnterpriseRecord({ statusLabel, membershipType }) {
  if (statusLabel === 'Active Member') return false;
  if (
    ['Essentials', 'Tailored Support', 'Leadership', 'Trailblazer', 'Whole of Government'].includes(membershipType || '') &&
    !['Certified', 'Certified (Grace Period)', 'Certification Expired'].includes(statusLabel)
  ) {
    return false;
  }
  return true;
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
      filters: 'social_enterprise_finder__c:true',
      attributesToRetrieve: [
        'name', 'website', 'status__c', 'address',
        'supplier_product_service', 'primary_beneficiaries',
        'business_model__c', 'membership_type__c',
        'profile_published__c', 'visible_on_website__c',
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
  log(`Fetched ${enterprises.length} public social-enterprise finder records from Algolia`);
  const includedEnterprises = [];
  let excludedNonEnterprise = 0;
  for (const ent of enterprises) {
    const statusLabel = ent.status__c || 'Listed';
    const membershipType = ent.membership_type__c || null;
    if (!isEnterpriseRecord({ statusLabel, membershipType })) {
      excludedNonEnterprise++;
      continue;
    }
    includedEnterprises.push(ent);
  }
  log(`Included ${includedEnterprises.length} enterprise records after filtering ${excludedNonEnterprise} non-enterprise buyer/member records`);

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

  for (const ent of includedEnterprises) {
    const addr = ent.address || {};
    const postcode = addr.postalCode || addr.postal_code_zip || null;
    const state = addr.state || null;
    const city = addr.city || addr.city_suburb || null;
    const services = ent.supplier_product_service || [];
    const statusLabel = ent.status__c || 'Listed';
    const certifications = [];
    if (statusLabel === 'Certified') certifications.push('Social Traders Certified');
    if (statusLabel === 'Certified (Grace Period)') certifications.push('Social Traders Certified (Grace Period)');

    const rawBeneficiaries = ent.primary_beneficiaries;
    const beneficiaries = Array.isArray(rawBeneficiaries)
      ? rawBeneficiaries
      : rawBeneficiaries ? [rawBeneficiaries] : [];
    const officeLocations = ent.office_locations || [];
    const geographicFocus = buildGeographicFocus({
      state,
      city,
      officeLocations,
      location: ent.location,
    });
    const description = buildDescription({
      services,
      beneficiaries,
      businessModel: ent.business_model__c || null,
      statusLabel,
      membershipType: ent.membership_type__c || null,
    });
    const profileConfidence = inferProfileConfidence({
      website: ent.website || null,
      businessModel: ent.business_model__c || null,
      beneficiaries,
      geographicFocus,
      profilePublished: ent.profile_published__c,
      visibleOnWebsite: ent.visible_on_website__c,
    });

    const record = {
      name: ent.name,
      source_primary: 'social-traders',
      org_type: 'social_enterprise',
      certifications: certifications.length > 0 ? certifications : null,
      sector: services.length > 0 ? services : null,
      website: ent.website || null,
      state: state,
      postcode: postcode ? String(postcode).padStart(4, '0') : null,
      city,
      description,
      geographic_focus: geographicFocus.length > 0 ? geographicFocus : null,
      profile_confidence: profileConfidence,
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
          status: statusLabel,
          profile_published: ent.profile_published__c ?? null,
          visible_on_website: ent.visible_on_website__c ?? null,
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
          if (error.message?.includes('social_enterprises_name_state_key')) {
            const { data: existingRow, error: existingError } = await supabase
              .from('social_enterprises')
              .select('id, source_primary, website, description, sector, city, postcode, geographic_focus, certifications, sources, profile_confidence, target_beneficiaries, logo_url, business_model')
              .eq('name', record.name)
              .eq('state', record.state)
              .limit(1)
              .maybeSingle();

            if (!existingError && existingRow) {
              const mergedSources = {
                ...(existingRow.sources || {}),
                ...(record.sources || {}),
              };
              const mergedSector = mergeUniqueList(existingRow.sector, record.sector);
              const mergedGeographicFocus = mergeUniqueList(existingRow.geographic_focus, record.geographic_focus);
              const mergedBeneficiaries = mergeUniqueList(existingRow.target_beneficiaries, record.target_beneficiaries);
              const mergedCertifications = mergeCertifications(existingRow.certifications, record.certifications);

              const { error: mergeError } = await supabase
                .from('social_enterprises')
                .update({
                  website: existingRow.website || record.website,
                  description: existingRow.description || record.description,
                  sector: mergedSector.length > 0 ? mergedSector : null,
                  city: existingRow.city || record.city,
                  postcode: existingRow.postcode || record.postcode,
                  geographic_focus: mergedGeographicFocus.length > 0 ? mergedGeographicFocus : null,
                  certifications: mergedCertifications,
                  sources: mergedSources,
                  profile_confidence:
                    existingRow.profile_confidence === 'high' || record.profile_confidence === 'high'
                      ? 'high'
                      : existingRow.profile_confidence === 'medium' || record.profile_confidence === 'medium'
                        ? 'medium'
                        : existingRow.profile_confidence || record.profile_confidence,
                  target_beneficiaries: mergedBeneficiaries.length > 0 ? mergedBeneficiaries : null,
                  logo_url: existingRow.logo_url || record.logo_url,
                  business_model: existingRow.business_model || record.business_model,
                })
                .eq('id', existingRow.id);

              if (!mergeError) {
                itemsUpdated++;
                continue;
              }
            }
          }
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
            description: record.description,
            geographic_focus: record.geographic_focus,
            profile_confidence: record.profile_confidence,
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
