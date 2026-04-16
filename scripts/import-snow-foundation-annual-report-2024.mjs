#!/usr/bin/env node

/**
 * Import verified Snow Foundation annual report 2024 data.
 *
 * Why this exists:
 * - Snow's public annual report contains a structured grant table with
 *   verifiable rows and a verified total donations line.
 * - The generic PDF extractor can discover names, but amount extraction
 *   remains too error-prone to apply blindly.
 * - This script imports a curated, report-backed subset with explicit
 *   source URLs and a distinct dataset label.
 *
 * Usage:
 *   node --env-file=.env scripts/import-snow-foundation-annual-report-2024.mjs
 *   node --env-file=.env scripts/import-snow-foundation-annual-report-2024.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FOUNDATION_ABN = '49411415493';
const FOUNDATION_NAME = 'The Snow Foundation';
const DATASET = 'snow_foundation_annual_report_2024_verified';
const SOURCE_URL = 'https://www.snowfoundation.org.au/publication/annual-report-2024/';
const SOURCE_DOCUMENT_URL = 'https://www.snowfoundation.org.au/wp-content/uploads/2025/03/Snow-Foundation-Annual-Report-2024-medium-res.pdf';
const REPORT_YEAR = 2024;
const TOTAL_DONATIONS = 13_704_202;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const NAME_ALIASES = new Map([
  ['Project Independence', 'PROJECT INDEPENDENCE LTD'],
  ['The Men\'s Table', 'THE MEN\'S TABLE LIMITED'],
  ['Barnardos Australia - Queanbeyan', 'Barnardos Australia'],
  ['Foundation for Rural & Regional Renewal', 'Foundation For Rural And Regional Renewal'],
  ['Sir David Martin Foundation', 'SIR DAVID MARTIN FOUNDATION LTD'],
  ['Heart Foundation-Champions4Change', 'National Heart Foundation Of Australia'],
  ['NACCHO', 'National Aboriginal Community Controlled Health Organisation Limited'],
  ['Take Heart', 'Take Heart Australia Limited'],
  ['Philanthropy Australia', 'Philanthropy Australia Ltd'],
  ['Social Enterprise Australia', 'SOCIAL ENTERPRISE AUSTRALIA LTD'],
  ['The Funding Network', 'The Funding Network Australia Limited'],
  ['Australian Spatial Analytics', 'AUSTRALIAN SPATIAL ANALYTICS LTD'],
  ['Global Sisters', 'Global Sisters Limited'],
  ['ReLove', 'ReLove Incorporated'],
  ['Hands Across Canberra', 'Hands Across Canberra Ltd'],
  ['Lifeline Canberra', 'Lifeline Canberra Inc'],
  ['Menslink', "Men's Link"],
  ['YWCA Canberra', 'YWCA Canberra'],
  ['The Smith Family', 'The Smith Family'],
  ['Woden Community Service', 'Woden Community Service Limited'],
  ['Yerrabi Yurwang Child and Family Aboriginal Corporation', 'Yerrabi Yurwang Child & Family Aboriginal Corporation'],
  ['EveryMan Australia', 'EveryMan Australia Limited'],
  ['Fearless Women', 'Fearless Women Incorporated'],
  ['First Steps Pregnancy Support', 'FIRST STEPS PREGNANCY SUPPORT LTD'],
  ['Orange Sky Australia', 'Orange Sky Australia Limited'],
  ['Roundabout Canberra', 'Roundabout Canberra Limited'],
  ['Toora Women', 'Toora Women Incorporated'],
  ['Beryl Women', 'Beryl Women Incorporated'],
  ['Communities@Work', 'Communities@Work'],
  ['Consent Labs', 'CONSENT LABS LTD'],
  ['University of Canberra', 'University Of Canberra'],
  ['Economic Justice Australia', 'Economic Justice Australia'],
  ['Equality Australia', 'Equality Australia Ltd'],
  ['Tender Funerals Canberra Region', 'TENDER FUNERALS AUSTRALIA LTD'],
  ['Together4Youth', 'TOGETHER 4 YOUTH LTD'],
  ["Women's Health Matters", "Women's Centre For Health Matters"],
  ["Doris Women's Refuge", 'Doris Womens Refuge Incorporated'],
  ['Deadly Connections', 'WUNDIRRA COMMUNITY & CONSULTANCY SERVICES LTD'],
  ["St Vincent's Hospital Sydney", "St. Vincent's Hospital Sydney Limited"],
  ["Sydney Women's Fund", 'Sydney Community Foundation'],
]);

const VERIFIED_GRANTS = [
  { name: 'Campbell Page', amount: 110000, program: 'Our Place - Canberra Region Flagships', focus: 'Single parents', purpose: 'Young Mothers Pathways Program in Queanbeyan' },
  { name: 'EveryMan Australia', amount: 250000, program: 'Our Place - Canberra Region Flagships', focus: 'Domestic violence/abuse', purpose: 'Men and families impacted by family and domestic violence' },
  { name: 'Project Independence', amount: 300000, program: 'Our Place - Canberra Region Flagships', focus: 'Disability', purpose: 'Infrastructure and staffing' },
  { name: 'Tender Funerals Canberra Region', amount: 250000, program: 'Our Place - Canberra Region Flagships', focus: 'Community', purpose: 'Fitout and core funding' },
  { name: 'The Men\'s Table', amount: 100000, program: 'Our Place - Canberra Region Flagships', focus: 'Mental health', purpose: 'Core funding: support groups' },
  { name: 'Together4Youth', amount: 100000, program: 'Our Place - Canberra Region Flagships', focus: 'Youth mental health', purpose: 'Coordinated wellbeing programs for secondary schools in Queanbeyan' },
  { name: 'Women\'s Health Matters', amount: 150000, program: 'Our Place - Canberra Region Flagships', focus: 'Women/girls', purpose: 'Community research' },

  { name: 'Beryl Women', amount: 15000, program: 'Our Place - Canberra Region Small Grants', focus: 'Domestic violence/abuse', purpose: 'Van equipment' },
  { name: 'Doris Women\'s Refuge', amount: 10000, program: 'Our Place - Canberra Region Small Grants', focus: 'Domestic violence/abuse', purpose: 'Assistance for women and children' },
  { name: 'First Steps Pregnancy Support', amount: 10000, program: 'Our Place - Canberra Region Small Grants', focus: 'Women and families', purpose: 'Nutrition education and support' },
  { name: 'Orange Sky Australia', amount: 10000, program: 'Our Place - Canberra Region Small Grants', focus: 'At risk/disadvantaged', purpose: 'Mobile laundry services' },
  { name: 'Roundabout Canberra', amount: 20000, program: 'Our Place - Canberra Region Small Grants', focus: 'Families in hardship', purpose: 'Essential items for families experiencing hardship' },
  { name: 'Toora Women', amount: 20000, program: 'Our Place - Canberra Region Small Grants', focus: 'Women/girls', purpose: 'Women\'s drop-in centre' },
  { name: 'University of Canberra', amount: 20000, program: 'Our Place - Canberra Region Small Grants', focus: 'Domestic violence/abuse', purpose: 'Community-based strength training program' },
  { name: 'Barnardos Australia - Queanbeyan', amount: 10000, program: 'Our Place - Education and Employment', focus: 'Indigenous students', purpose: 'After school program in Queanbeyan' },
  { name: 'Communities@Work', amount: 40000, program: 'Our Place - Education and Employment', focus: 'Youth at risk', purpose: 'Multi-purpose outdoor recreation space at Galilee School' },
  { name: 'Consent Labs', amount: 50000, program: 'Our Place - Education and Employment', focus: 'Youth', purpose: 'Respectful relationships education' },
  { name: 'The Smith Family', amount: 10000, program: 'Our Place - Education and Employment', focus: 'At risk/disadvantaged', purpose: 'Reading program' },
  { name: 'Woden Community Service', amount: 5000, program: 'Our Place - Education and Employment', focus: 'Refugees', purpose: 'Learning to speak English program' },
  { name: 'Yerrabi Yurwang Child and Family Aboriginal Corporation', amount: 25000, program: 'Our Place - Education and Employment', focus: 'Indigenous', purpose: 'Yawarj Mara – Strong Pathways for youth program' },
  { name: 'Fearless Women', amount: 50000, program: 'Our Place - Canberra Region Small Grants Continued', focus: 'Women/girls', purpose: 'Core funding: Counselling, mentor and education programs' },
  { name: 'Lifeline Canberra', amount: 24122, program: 'Our Place - Canberra Region Small Grants Continued', focus: 'Mental health', purpose: 'Equipment upgrades' },
  { name: 'Menslink', amount: 50000, program: 'Our Place - Canberra Region Small Grants Continued', focus: 'Young men', purpose: 'Core funding: Counselling, mentor and education programs' },
  { name: 'YWCA Canberra', amount: 70000, program: 'Our Place - Canberra Region Small Grants', focus: 'People on low income', purpose: 'YWCA Rentwell: Affordable rentals' },

  { name: 'Foundation for Rural & Regional Renewal', amount: 578500, program: 'Our Place - Key Regions: NSW South Coast', focus: 'Communities', purpose: 'Investing in Rural Community Futures' },
  { name: 'Sir David Martin Foundation', amount: 75000, program: 'Our Place - Key Regions: NSW South Coast', focus: 'Youth with addiction', purpose: 'Aftercare worker' },
  { name: '4 Voices', amount: 100000, program: 'Our Place - Sydney', focus: 'Women/girls', purpose: 'Snowflake - mobile digital and social support service' },
  { name: 'Deadly Connections', amount: 75000, program: 'Our Place - Sydney', focus: 'Indigenous', purpose: 'Core funding' },
  { name: 'St Vincent\'s Hospital Sydney', amount: 5000, program: 'Our Place - Sydney', focus: 'Community', purpose: 'Nursing Excellence' },
  { name: 'Story Factory', amount: 5000, program: 'Our Place - Sydney', focus: 'Community', purpose: 'Free to Fashion project' },
  { name: 'Sydney Women\'s Fund', amount: 305000, program: 'Our Place - Sydney', focus: 'Women/girls', purpose: 'Core operations and grant funding' },

  { name: 'Australian Spatial Analytics', amount: 175000, program: 'Our Country - Social Entrepreneurs & Innovation', focus: 'Disability', purpose: 'Core funding: Employment for neurodiverse people in high-end data jobs' },
  { name: 'Global Sisters', amount: 75000, program: 'Our Country - Social Entrepreneurs & Innovation', focus: 'Women/girls', purpose: 'Core funding: Supporting women-led businesses' },
  { name: 'ReLove', amount: 150000, program: 'Our Country - Social Entrepreneurs & Innovation', focus: 'Domestic violence/abuse', purpose: 'Core funding: Furnishing homes for people leaving crisis accommodation' },
  { name: 'Hands Across Canberra', amount: 50000, program: 'Our Sector', focus: 'Community', purpose: 'Core and grant funding' },
  { name: 'Philanthropy Australia', amount: 75000, program: 'Our Sector', focus: 'Community', purpose: 'Core funding' },
  { name: 'Social Enterprise Australia', amount: 75000, program: 'Our Sector', focus: 'Community', purpose: 'Core funding' },
  { name: 'The Funding Network', amount: 50000, program: 'Our Sector', focus: 'Community', purpose: 'Core funding' },

  { name: 'Heart Foundation-Champions4Change', amount: 160000, program: 'Our Country - Social Justice Issues', focus: 'Indigenous', purpose: 'RHD: Lived experience experts Champions4Change program support' },
  { name: 'NACCHO', amount: 500000, program: 'Our Country - Social Justice Issues', focus: 'Indigenous', purpose: 'RHD: Peak National Aboriginal Community Controlled Health Organisation acute rheumatic fever and rheumatic heart disease program' },
  { name: 'Orange Sky Australia', amount: 230000, program: 'Our Country - Social Justice Issues', focus: 'Indigenous', purpose: 'RHD: Remote Mobile laundry services in Maningrida and Alice Springs' },
  { name: 'Take Heart', amount: 75000, program: 'Our Country - Social Justice Issues', focus: 'Indigenous', purpose: 'RHD: Take Heart documentary and short films' },
  { name: 'Economic Justice Australia', amount: 166000, program: 'Our Country - Social Justice Issues', focus: 'Domestic violence/abuse', purpose: 'Core funding: economic justice reform and domestic violence advocacy' },
  { name: 'Equality Australia', amount: 200000, program: 'Our Country - Social Justice Issues', focus: 'LGBTIQ+', purpose: 'Core funding: Advocacy for LGBTIQ+ rights and reform' },
];

function normaliseName(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildSourceRecordId(grant) {
  return [
    'snow',
    REPORT_YEAR,
    normaliseName(grant.name).replace(/\s+/g, '-'),
    normaliseName(grant.program).replace(/\s+/g, '-'),
  ].join(':');
}

async function matchGrantee(name) {
  const searchName = NAME_ALIASES.get(name) || name;
  const clean = searchName.replace(/[()[\]\\\/]/g, '').trim();

  const { data: exact } = await db
    .from('gs_entities')
    .select('id, canonical_name, abn')
    .ilike('canonical_name', clean)
    .limit(5);

  if (exact?.length === 1) return exact[0];

  const { data: entities } = await db
    .from('gs_entities')
    .select('id, canonical_name, abn')
    .ilike('canonical_name', `%${clean}%`)
    .limit(10);

  if (!entities?.length) return null;

  const normalisedTarget = normaliseName(clean);
  const exactNormalised = entities.find((entity) => normaliseName(entity.canonical_name) === normalisedTarget);
  if (exactNormalised) return exactNormalised;

  const aliasNormalised = normaliseName(name);
  const aliasHit = entities.find((entity) => normaliseName(entity.canonical_name) === aliasNormalised);
  if (aliasHit) return aliasHit;

  return entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
}

async function main() {
  log(`Snow Foundation annual report 2024 import (${APPLY ? 'APPLY' : 'DRY RUN'})`);

  const { data: foundation, error: foundationError } = await db
    .from('foundations')
    .select('id, name, metadata')
    .eq('acnc_abn', FOUNDATION_ABN)
    .single();

  if (foundationError || !foundation) {
    throw new Error(`Foundation profile not found for ABN ${FOUNDATION_ABN}`);
  }

  const { data: foundationEntity, error: entityError } = await db
    .from('gs_entities')
    .select('id, canonical_name')
    .eq('abn', FOUNDATION_ABN)
    .single();

  if (entityError || !foundationEntity) {
    throw new Error(`Foundation entity not found for ABN ${FOUNDATION_ABN}`);
  }

  const foundationGranteeRows = [];
  const relationshipRows = [];
  const unmatched = [];

  for (const grant of VERIFIED_GRANTS) {
    const entity = await matchGrantee(grant.name);

    const foundationGranteeRow = {
      foundation_id: foundation.id,
      foundation_abn: FOUNDATION_ABN,
      foundation_name: FOUNDATION_NAME,
      grantee_name: grant.name,
      grantee_name_normalised: normaliseName(grant.name),
      grantee_entity_id: entity?.id || null,
      grantee_abn: entity?.abn || null,
      grant_amount: grant.amount,
      grant_year: REPORT_YEAR,
      program_name: grant.program,
      source_url: SOURCE_URL,
      source_document_url: SOURCE_DOCUMENT_URL,
      evidence_text: grant.purpose,
      link_method: entity ? 'entity_match' : 'report_only',
      extraction_method: 'manual_verified_report',
      confidence: entity ? 'verified' : 'report_verified_unmatched',
      metadata: {
        focus: grant.focus,
        report_year: REPORT_YEAR,
        imported_by: 'import-snow-foundation-annual-report-2024.mjs',
      },
    };

    foundationGranteeRows.push(foundationGranteeRow);

    if (entity) {
      const sourceRecordId = buildSourceRecordId(grant);
      relationshipRows.push({
        source_entity_id: foundationEntity.id,
        target_entity_id: entity.id,
        relationship_type: 'grant',
        amount: grant.amount,
        year: REPORT_YEAR,
        dataset: DATASET,
        source_record_id: sourceRecordId,
        confidence: 'verified',
        properties: {
          source: 'annual_report_pdf_verified',
          foundation: FOUNDATION_NAME,
          program: grant.program,
          focus: grant.focus,
          purpose: grant.purpose,
          source_url: SOURCE_URL,
          source_document_url: SOURCE_DOCUMENT_URL,
        },
      });
    } else {
      unmatched.push(grant.name);
    }
  }

  log(`Verified grant rows: ${foundationGranteeRows.length}`);
  log(`Matched gs_entities: ${relationshipRows.length}`);
  log(`Unmatched rows: ${unmatched.length}`);

  if (VERBOSE && unmatched.length) {
    for (const name of unmatched) log(`  unmatched: ${name}`);
  }

  if (!APPLY) {
    log(`Would update foundation total_giving_annual to ${TOTAL_DONATIONS.toLocaleString('en-AU')}`);
    return;
  }

  const updatedMetadata = {
    ...(foundation.metadata || {}),
    verified_annual_report_2024: {
      total_donations: TOTAL_DONATIONS,
      source_url: SOURCE_URL,
      source_document_url: SOURCE_DOCUMENT_URL,
      imported_at: new Date().toISOString(),
      dataset: DATASET,
      verified_grant_rows: foundationGranteeRows.length,
      matched_relationship_rows: relationshipRows.length,
    },
  };

  const { error: foundationUpdateError } = await db
    .from('foundations')
    .update({
      total_giving_annual: TOTAL_DONATIONS,
      profile_confidence: 'medium',
      enrichment_source: 'manual_verified_report',
      metadata: updatedMetadata,
      enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', foundation.id);

  if (foundationUpdateError) throw foundationUpdateError;

  const { error: deleteGranteesError } = await db
    .from('foundation_grantees')
    .delete()
    .eq('foundation_id', foundation.id)
    .eq('source_url', SOURCE_URL)
    .eq('extraction_method', 'manual_verified_report');

  if (deleteGranteesError) throw deleteGranteesError;

  const { error: insertGranteesError } = await db
    .from('foundation_grantees')
    .insert(foundationGranteeRows);

  if (insertGranteesError) throw insertGranteesError;

  const { error: deleteRelationshipsError } = await db
    .from('gs_relationships')
    .delete()
    .eq('source_entity_id', foundationEntity.id)
    .eq('dataset', DATASET);

  if (deleteRelationshipsError) throw deleteRelationshipsError;

  if (relationshipRows.length) {
    const { error: insertRelationshipsError } = await db
      .from('gs_relationships')
      .insert(relationshipRows);
    if (insertRelationshipsError) throw insertRelationshipsError;
  }

  log(`Foundation profile updated`);
  log(`Inserted foundation_grantees rows: ${foundationGranteeRows.length}`);
  log(`Inserted verified grant relationships: ${relationshipRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
