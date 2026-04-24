#!/usr/bin/env node

/**
 * Backfill canonical foundation_grantees rows from existing grant relationships.
 *
 * Why this exists:
 * - Some foundations already have verified or semi-verified grant edges in
 *   gs_relationships, but the public review surfaces count the canonical
 *   foundation_grantees layer and the mirrored foundation_grantees dataset in
 *   gs_relationships.
 * - This script materialises those rows in an idempotent way.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-foundation-grantees-from-relationships.mjs --foundation=ian-potter
 *   node --env-file=.env scripts/backfill-foundation-grantees-from-relationships.mjs --foundation=ian-potter --apply
 *   node --env-file=.env scripts/backfill-foundation-grantees-from-relationships.mjs --foundation=minderoo --apply
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const FOUNDATION_KEY = process.argv.find((arg) => arg.startsWith('--foundation='))?.split('=')[1];
const FOUNDATION_ID_ARG = process.argv.find((arg) => arg.startsWith('--foundation-id='))?.split('=')[1];
const DATASET_ARG = process.argv.find((arg) => arg.startsWith('--dataset='))?.split('=')[1];
const SOURCE_ENTITY_ID_ARG = process.argv.find((arg) => arg.startsWith('--source-entity-id='))?.split('=')[1];
const SOURCE_URL_ARG = process.argv.find((arg) => arg.startsWith('--source-url='))?.split('=')[1];
const SOURCE_DOCUMENT_URL_ARG = process.argv.find((arg) => arg.startsWith('--source-document-url='))?.split('=')[1];
const EXTRACTION_METHOD_ARG = process.argv.find((arg) => arg.startsWith('--extraction-method='))?.split('=')[1];
const CONFIDENCE_ARG = process.argv.find((arg) => arg.startsWith('--confidence='))?.split('=')[1];
const SOURCE_MODE_ARG = process.argv.find((arg) => arg.startsWith('--source-mode='))?.split('=')[1];

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

function emitBlocked(error) {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'Database connection unavailable for foundation grant backfill.',
    foundation_key: FOUNDATION_KEY || null,
    foundation_id: FOUNDATION_ID_ARG || null,
    dataset: DATASET_ARG || null,
    apply: APPLY,
    error: String(error?.message || error || 'Unknown error'),
  }, null, 2));
}

const FOUNDATION_CONFIG = {
  'ian-potter': {
    foundationId: 'b9e090e5-1672-48ff-815a-2a6314ebe033',
    foundationAbn: '77950227010',
    foundationName: 'The Ian Potter Foundation',
    datasets: ['ian_potter_grants_db'],
    sourceUrlByDataset: {
      ian_potter_grants_db: 'https://www.ianpotter.org.au/knowledge-centre/grants-database/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      ian_potter_grants_db: 'official_grants_database_backfill',
    },
    confidenceByDataset: {
      ian_potter_grants_db: 'verified',
    },
    sourceModeByDataset: {
      ian_potter_grants_db: 'official_grants_database',
    },
  },
  minderoo: {
    foundationId: '8f8704be-d6e8-40f3-b561-ac6630ce5b36',
    foundationAbn: '24819440618',
    foundationName: 'Minderoo Foundation',
    datasets: ['minderoo_annual_report_2024'],
    sourceUrlByDataset: {
      minderoo_annual_report_2024: 'https://www.minderoo.org/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      minderoo_annual_report_2024: 'official_annual_report_backfill',
    },
    confidenceByDataset: {
      minderoo_annual_report_2024: 'verified',
    },
    sourceModeByDataset: {
      minderoo_annual_report_2024: 'official_annual_report_fallback_site',
    },
  },
  ecstra: {
    foundationId: '25b80b63-416e-4aaa-b470-2f8dc6fa835f',
    foundationAbn: '16625525162',
    foundationName: 'Ecstra Foundation',
    datasets: ['ecstra_foundation_grantees'],
    sourceUrlByDataset: {
      ecstra_foundation_grantees: 'https://ecstra.org.au/grants/completed-grants/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      ecstra_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      ecstra_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      ecstra_foundation_grantees: 'official_grantee_surface',
    },
  },
  'rio-tinto': {
    foundationId: '85f0de43-d004-4122-83a6-287eeecc4da9',
    foundationAbn: null,
    foundationName: 'Rio Tinto Foundation',
    datasets: ['rio_tinto_foundation_grantees'],
    sourceUrlByDataset: {
      rio_tinto_foundation_grantees: 'https://www.riotinto.com/sustainability/communities',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      rio_tinto_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      rio_tinto_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      rio_tinto_foundation_grantees: 'official_grantee_surface',
    },
  },
  woolworths: {
    foundationId: '6d8356c4-8efb-471f-8bdc-46bdd85d22f1',
    foundationAbn: '67937361335',
    foundationName: 'Woolworths Group Foundation',
    datasets: ['woolworths_foundation_grantees'],
    sourceUrlByDataset: {
      woolworths_foundation_grantees: 'https://www.woolworthsgroup.com.au/au/en/media/latest-news/2025/woolworths-group-foundation-and-food-relief-partners-share-fir.html',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      woolworths_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      woolworths_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      woolworths_foundation_grantees: 'official_grantee_surface',
    },
  },
  cba: {
    foundationId: 'a4b33b11-2f81-47de-a2f3-9f7b419beb01',
    foundationAbn: '27727720406',
    foundationName: 'CBA Foundation',
    datasets: ['commbank_foundation_grantees'],
    sourceUrlByDataset: {
      commbank_foundation_grantees: 'https://www.commbank.com.au/about-us/opportunity-initiatives/community-grants.html',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      commbank_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      commbank_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      commbank_foundation_grantees: 'official_grantee_surface',
    },
  },
  myer: {
    foundationId: '5fd1a683-544f-46bd-bd27-7aeb04fa75e5',
    foundationAbn: '46100632395',
    foundationName: 'The Myer Foundation',
    datasets: ['myer_annual_report_2024', 'myer_foundation_grantees'],
    sourceUrlByDataset: {
      myer_annual_report_2024: 'https://myerfoundation.org.au/',
      myer_foundation_grantees: 'https://myerfoundation.org.au/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      myer_annual_report_2024: 'official_annual_report_backfill',
      myer_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      myer_annual_report_2024: 'verified',
      myer_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      myer_annual_report_2024: 'official_annual_report_fallback_site',
      myer_foundation_grantees: 'official_grantee_surface',
    },
  },
  gandel: {
    foundationId: '086a831d-87c0-4972-9282-6d5a3fc9f1c3',
    foundationAbn: '51393866453',
    foundationName: 'Gandel Family Foundation',
    datasets: ['gandel_grantees', 'gandel_impact_report_2024'],
    sourceUrlByDataset: {
      gandel_grantees: 'https://www.gandelfoundation.org.au/',
      gandel_impact_report_2024: 'https://www.gandelfoundation.org.au/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      gandel_grantees: 'official_grantee_surface_backfill',
      gandel_impact_report_2024: 'official_impact_report_backfill',
    },
    confidenceByDataset: {
      gandel_grantees: 'verified',
      gandel_impact_report_2024: 'verified',
    },
    sourceModeByDataset: {
      gandel_grantees: 'official_grantee_surface',
      gandel_impact_report_2024: 'official_impact_report_fallback_site',
    },
  },
  acf: {
    foundationId: 'b2c7e6ad-237a-4ca0-8de9-2773f136928c',
    foundationAbn: '57967620066',
    foundationName: 'Australian Communities Foundation',
    datasets: ['acf_grantees'],
    sourceUrlByDataset: {
      acf_grantees: 'https://www.communityfoundation.org.au/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      acf_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      acf_grantees: 'verified',
    },
    sourceModeByDataset: {
      acf_grantees: 'official_grantee_surface',
    },
  },
  'tim-fairfax': {
    foundationId: '5cb27568-8820-441c-a536-e88b5b4d9cea',
    foundationAbn: '62124526760',
    foundationName: 'The Trustee for Tim Fairfax Family Foundation',
    datasets: ['tfff_annual_report_2024', 'tfff_grantees'],
    sourceUrlByDataset: {
      tfff_annual_report_2024: 'https://www.tfff.org.au/',
      tfff_grantees: 'https://www.tfff.org.au/',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      tfff_annual_report_2024: 'official_annual_report_backfill',
      tfff_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      tfff_annual_report_2024: 'verified',
      tfff_grantees: 'verified',
    },
    sourceModeByDataset: {
      tfff_annual_report_2024: 'official_annual_report_fallback_site',
      tfff_grantees: 'official_grantee_surface',
    },
  },
  humanitix: {
    foundationId: '34ff4c88-d286-4128-a8fc-a505fa304ec9',
    foundationAbn: '32618780439',
    foundationName: 'Humanitix Foundation',
    datasets: ['humanitix_grantees'],
    sourceUrlByDataset: {
      humanitix_grantees: 'https://www.humanitix.com',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      humanitix_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      humanitix_grantees: 'verified',
    },
    sourceModeByDataset: {
      humanitix_grantees: 'official_grantee_surface',
    },
  },
  macquarie: {
    foundationId: 'f5c80d75-6a66-4a0c-aa41-d1f3aa791f21',
    foundationAbn: null,
    foundationName: 'Macquarie Group Foundation',
    datasets: ['macquarie_group_foundation_grantees'],
    sourceUrlByDataset: {
      macquarie_group_foundation_grantees: 'https://www.macquarie.com/au/en/about/community/macquarie-group-foundation.html',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      macquarie_group_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      macquarie_group_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      macquarie_group_foundation_grantees: 'official_grantee_surface',
    },
  },
  prf: {
    foundationId: '4ee5baca-c898-4318-ae2b-d79b95379cc7',
    foundationAbn: '32623132472',
    foundationName: 'Paul Ramsay Foundation Limited',
    datasets: ['foundation_grantees', 'paul_ramsay_grantees'],
    sourceUrlByDataset: {
      foundation_grantees: 'https://www.paulramsayfoundation.org.au',
      paul_ramsay_grantees: 'https://www.paulramsayfoundation.org.au',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      foundation_grantees: 'canonical_relationship_backfill',
      paul_ramsay_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      foundation_grantees: 'verified',
      paul_ramsay_grantees: 'verified',
    },
    sourceModeByDataset: {
      foundation_grantees: 'canonical_relationship_fallback_site',
      paul_ramsay_grantees: 'official_grantee_surface',
    },
  },
  'lindsay-fox': {
    foundationId: '35ea9a84-df9c-4f25-a015-46e9108a6b5b',
    foundationAbn: '46029271914',
    foundationName: 'Lindsay Fox Foundation',
    datasets: ['fox_foundation_grantees'],
    sourceUrlByDataset: {},
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      fox_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      fox_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      fox_foundation_grantees: 'official_grantee_surface',
    },
  },
  origin: {
    foundationId: '848d51ab-d01b-4a1c-bd1b-b34ae492fdf8',
    foundationAbn: '65623569291',
    foundationName: 'Origin Foundation Limited',
    datasets: ['origin_foundation_grantees'],
    sourceUrlByDataset: {
      origin_foundation_grantees: 'http://www.originfoundation.org.au',
    },
    sourceDocumentUrlByDataset: {},
    extractionMethodByDataset: {
      origin_foundation_grantees: 'official_grantee_surface_backfill',
    },
    confidenceByDataset: {
      origin_foundation_grantees: 'verified',
    },
    sourceModeByDataset: {
      origin_foundation_grantees: 'official_grantee_surface',
    },
  },
};

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function normaliseName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ensureUrl(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

function buildAbrUrl(abn) {
  if (!abn) return null;
  const digits = String(abn).replace(/\D/g, '');
  if (!digits) return null;
  return `https://abr.business.gov.au/ABN/View?abn=${digits}`;
}

function getProgramName(properties) {
  if (!properties || typeof properties !== 'object') return '';
  if (typeof properties.program === 'string' && properties.program.trim()) return properties.program.trim();
  if (typeof properties.focus === 'string' && properties.focus.trim()) return properties.focus.trim();
  return '';
}

function getEvidenceText(properties) {
  if (!properties || typeof properties !== 'object') return null;
  const parts = [];
  if (typeof properties.title === 'string' && properties.title.trim()) parts.push(properties.title.trim());
  if (typeof properties.program === 'string' && properties.program.trim()) parts.push(`Program: ${properties.program.trim()}`);
  if (typeof properties.focus === 'string' && properties.focus.trim()) parts.push(`Focus: ${properties.focus.trim()}`);
  if (typeof properties.state === 'string' && properties.state.trim()) parts.push(`State: ${properties.state.trim()}`);
  return parts.length ? parts.join(' | ') : null;
}

function buildFoundationGranteeKey({ granteeNameNormalised, grantYear, programName, sourceUrl, extractionMethod }) {
  return [
    granteeNameNormalised,
    grantYear ?? -1,
    programName || '',
    sourceUrl || '',
    extractionMethod || '',
  ].join('::');
}

function buildRelationshipSourceRecordId({ foundationId, dataset, targetEntityId, year, programName }) {
  return [
    'foundation-grantee-backfill',
    foundationId,
    dataset,
    targetEntityId,
    year ?? 'na',
    normaliseName(programName || 'general').replace(/\s+/g, '-'),
  ].join(':');
}

async function fetchAllRows({ table, columns, buildQuery, pageSize = 1000 }) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = db.from(table).select(columns);
    query = buildQuery(query).range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function resolveConfig(configKey) {
  if (configKey) {
    const configured = FOUNDATION_CONFIG[configKey];
    if (!configured) {
      throw new Error(`Unknown foundation key "${configKey}". Expected one of: ${Object.keys(FOUNDATION_CONFIG).join(', ')}`);
    }
    return configured;
  }

  if (!FOUNDATION_ID_ARG || !DATASET_ARG) {
    throw new Error(
      `Missing required flags. Use either --foundation=<${Object.keys(FOUNDATION_CONFIG).join('|')}> or --foundation-id=<uuid> --dataset=<dataset_name>.`,
    );
  }

  const { data: foundation, error } = await db
    .from('foundations')
    .select('id, name, acnc_abn')
    .eq('id', FOUNDATION_ID_ARG)
    .single();

  if (error || !foundation) {
    throw error || new Error(`Foundation not found for ${FOUNDATION_ID_ARG}`);
  }

  return {
    foundationId: foundation.id,
    foundationAbn: foundation.acnc_abn || null,
    foundationName: foundation.name,
    sourceEntityId: SOURCE_ENTITY_ID_ARG || null,
    datasets: DATASET_ARG.split(',').map((value) => value.trim()).filter(Boolean),
    sourceUrlByDataset: SOURCE_URL_ARG ? Object.fromEntries(DATASET_ARG.split(',').map((dataset) => [dataset.trim(), SOURCE_URL_ARG])) : {},
    sourceDocumentUrlByDataset: SOURCE_DOCUMENT_URL_ARG ? Object.fromEntries(DATASET_ARG.split(',').map((dataset) => [dataset.trim(), SOURCE_DOCUMENT_URL_ARG])) : {},
    extractionMethodByDataset: Object.fromEntries(
      DATASET_ARG.split(',').map((dataset) => [dataset.trim(), EXTRACTION_METHOD_ARG || 'relationship_backfill']),
    ),
    confidenceByDataset: Object.fromEntries(
      DATASET_ARG.split(',').map((dataset) => [dataset.trim(), CONFIDENCE_ARG || 'verified']),
    ),
    sourceModeByDataset: Object.fromEntries(
      DATASET_ARG.split(',').map((dataset) => [dataset.trim(), SOURCE_MODE_ARG || 'relationship_backfill']),
    ),
  };
}

async function processFoundation(configKey) {
  const config = await resolveConfig(configKey);

  log(`${config.foundationName} grant backfill (${APPLY ? 'APPLY' : 'DRY RUN'})`);

  const { data: foundation, error: foundationError } = await db
    .from('foundations')
    .select('id, name, acnc_abn, website, gs_entity_id')
    .eq('id', config.foundationId)
    .single();

  if (foundationError || !foundation) {
    throw new Error(`Foundation not found for ${config.foundationId}`);
  }

  const foundationWebsite = ensureUrl(foundation.website) || buildAbrUrl(foundation.acnc_abn || config.foundationAbn);
  const relationshipSourceEntityId = config.sourceEntityId || foundation.gs_entity_id;

  const relationships = await fetchAllRows({
    table: 'gs_relationships',
    columns: 'target_entity_id, amount, year, dataset, confidence, source_url, properties',
    buildQuery: (query) =>
      query
        .eq('source_entity_id', relationshipSourceEntityId)
        .eq('relationship_type', 'grant')
        .in('dataset', config.datasets),
  });

  if (!relationships?.length) {
    log('No source relationships found.');
    return { foundationGranteeInsertCount: 0, relationshipInsertCount: 0, sourceCount: 0 };
  }

  const targetIds = [...new Set(relationships.map((row) => row.target_entity_id).filter(Boolean))];
  const targetMap = new Map();
  const lookupBatchSize = 250;
  for (let index = 0; index < targetIds.length; index += lookupBatchSize) {
    const batch = targetIds.slice(index, index + lookupBatchSize);
    const { data: targets, error: targetsError } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn')
      .in('id', batch);

    if (targetsError) throw targetsError;
    for (const target of targets || []) {
      targetMap.set(target.id, target);
    }
  }

  const existingGrantees = await fetchAllRows({
    table: 'foundation_grantees',
    columns: 'id, grantee_name_normalised, grant_year, program_name, source_url, extraction_method',
    buildQuery: (query) => query.eq('foundation_id', foundation.id),
  });

  const existingGranteeKeys = new Set(
    (existingGrantees || []).map((row) =>
      buildFoundationGranteeKey({
        granteeNameNormalised: row.grantee_name_normalised,
        grantYear: row.grant_year,
        programName: row.program_name,
        sourceUrl: row.source_url,
        extractionMethod: row.extraction_method,
      }),
    ),
  );

  const existingCanonicalRelationships = await fetchAllRows({
    table: 'gs_relationships',
    columns: 'source_record_id',
    buildQuery: (query) =>
      query
        .eq('source_entity_id', foundation.gs_entity_id)
        .eq('relationship_type', 'grant')
        .eq('dataset', 'foundation_grantees'),
  });
  const existingRelationshipIds = new Set((existingCanonicalRelationships || []).map((row) => row.source_record_id));

  const foundationGranteeRows = [];
  const canonicalRelationshipRows = [];
  let missingTargets = 0;

  for (const row of relationships) {
    const target = targetMap.get(row.target_entity_id);
    if (!target) {
      missingTargets += 1;
      continue;
    }

    const sourceUrl = ensureUrl(row.source_url) || config.sourceUrlByDataset[row.dataset] || foundationWebsite;
    const sourceDocumentUrl = config.sourceDocumentUrlByDataset[row.dataset] || sourceUrl;
    const extractionMethod = config.extractionMethodByDataset[row.dataset] || 'relationship_backfill';
    const programName = getProgramName(row.properties);
    const granteeName = target.canonical_name;
    const granteeNameNormalised = normaliseName(granteeName);
    const key = buildFoundationGranteeKey({
      granteeNameNormalised,
      grantYear: row.year,
      programName,
      sourceUrl,
      extractionMethod,
    });

    if (!existingGranteeKeys.has(key)) {
      foundationGranteeRows.push({
        foundation_id: foundation.id,
        foundation_abn: foundation.acnc_abn,
        foundation_name: foundation.name,
        grantee_name: granteeName,
        grantee_name_normalised: granteeNameNormalised,
        grantee_entity_id: target.id,
        grantee_abn: target.abn || null,
        grant_amount: row.amount ?? null,
        grant_year: row.year ?? null,
        program_name: programName,
        source_url: sourceUrl,
        source_document_url: sourceDocumentUrl,
        evidence_text: getEvidenceText(row.properties),
        link_method: 'gs_relationship_backfill',
        extraction_method: extractionMethod,
        confidence: config.confidenceByDataset[row.dataset] || row.confidence || 'verified',
        metadata: {
          backfilled_from: 'gs_relationships',
          source_dataset: row.dataset,
          source_mode: config.sourceModeByDataset[row.dataset] || 'relationship_backfill',
          relationship_confidence: row.confidence || null,
          properties: row.properties || {},
          imported_by: 'backfill-foundation-grantees-from-relationships.mjs',
        },
        extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      existingGranteeKeys.add(key);
    }

    if (row.dataset !== 'foundation_grantees') {
      const sourceRecordId = buildRelationshipSourceRecordId({
        foundationId: foundation.id,
        dataset: row.dataset,
        targetEntityId: target.id,
        year: row.year,
        programName,
      });

      if (!existingRelationshipIds.has(sourceRecordId)) {
        canonicalRelationshipRows.push({
          source_entity_id: foundation.gs_entity_id,
          target_entity_id: target.id,
          relationship_type: 'grant',
          amount: row.amount ?? null,
          year: row.year ?? null,
          dataset: 'foundation_grantees',
          source_record_id: sourceRecordId,
          source_url: sourceUrl,
          confidence: config.confidenceByDataset[row.dataset] || row.confidence || 'verified',
          properties: {
            source: 'foundation_grantees_backfill',
            source_dataset: row.dataset,
            foundation: config.foundationName,
            program: programName || null,
            source_url: sourceUrl,
            source_document_url: sourceDocumentUrl,
            relationship_confidence: row.confidence || null,
          },
        });
        existingRelationshipIds.add(sourceRecordId);
      }
    }
  }

  log(`Source grant relationships: ${relationships.length}`);
  log(`Missing target entities: ${missingTargets}`);
  log(`New foundation_grantees rows: ${foundationGranteeRows.length}`);
  log(`New canonical grant relationships: ${canonicalRelationshipRows.length}`);

  if (VERBOSE && foundationGranteeRows.length) {
    for (const row of foundationGranteeRows.slice(0, 10)) {
      log(`  ${row.grantee_name} (${row.grant_year ?? 'n/a'}) [${row.program_name || 'general'}]`);
    }
  }

  if (!APPLY) {
    return {
      foundationGranteeInsertCount: foundationGranteeRows.length,
      relationshipInsertCount: canonicalRelationshipRows.length,
      sourceCount: relationships.length,
    };
  }

  const batchSize = 250;
  for (let index = 0; index < foundationGranteeRows.length; index += batchSize) {
    const batch = foundationGranteeRows.slice(index, index + batchSize);
    const { error } = await db.from('foundation_grantees').insert(batch);
    if (error) throw error;
  }

  for (let index = 0; index < canonicalRelationshipRows.length; index += batchSize) {
    const batch = canonicalRelationshipRows.slice(index, index + batchSize);
    const { error } = await db.from('gs_relationships').insert(batch);
    if (error) throw error;
  }

  return {
    foundationGranteeInsertCount: foundationGranteeRows.length,
    relationshipInsertCount: canonicalRelationshipRows.length,
    sourceCount: relationships.length,
  };
}

async function main() {
  if (!FOUNDATION_KEY && !(FOUNDATION_ID_ARG && DATASET_ARG)) {
    throw new Error(
      `Missing required flags. Use either --foundation=<${Object.keys(FOUNDATION_CONFIG).join('|')}> or --foundation-id=<uuid> --dataset=<dataset_name>.`,
    );
  }

  const result = await processFoundation(FOUNDATION_KEY);
  log(`Done: ${JSON.stringify(result)}`);
}

main().catch((error) => {
  if (isNetworkError(error)) {
    emitBlocked(error);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
