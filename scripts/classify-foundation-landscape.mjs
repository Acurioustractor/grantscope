#!/usr/bin/env node

/**
 * Classify Foundation Landscape
 *
 * Deterministically maps foundations into a normalized giving-landscape taxonomy
 * and geography layer. This deliberately records assignment kind and evidence
 * so the UI can separate declared/program/observed/inferred focus.
 *
 * Usage:
 *   node --env-file=.env scripts/classify-foundation-landscape.mjs
 *   node --env-file=.env scripts/classify-foundation-landscape.mjs --limit=500
 *   node --env-file=.env scripts/classify-foundation-landscape.mjs --foundation-id=<uuid>
 *   node --env-file=.env scripts/classify-foundation-landscape.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logComplete, logFailed, logStart } from './lib/log-agent-run.mjs';

const AGENT_ID = 'classify-foundation-landscape';
const AGENT_NAME = 'Classify Foundation Landscape';
const VERSION = 'v1';
const NOW = new Date().toISOString();
const DRY_RUN = process.argv.includes('--dry-run');

function getArgValue(prefix) {
  const arg = process.argv.find(entry => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const LIMIT = getArgValue('--limit') ? Math.max(1, Number(getArgValue('--limit'))) : null;
const FOUNDATION_ID = getArgValue('--foundation-id');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORY_RULES = [
  {
    slug: 'first-nations',
    words: ['first nations', 'aboriginal', 'torres strait', 'indigenous', 'native title', 'on-country', 'cultural connection', 'acco', 'accho'],
  },
  {
    slug: 'housing-homelessness',
    words: ['housing', 'homeless', 'homelessness', 'shelter', 'rough sleeping', 'tenancy', 'accommodation', 'domestic violence refuge'],
  },
  {
    slug: 'health-wellbeing',
    words: ['health', 'wellbeing', 'mental health', 'hospital', 'medical', 'patient', 'clinical', 'disease', 'cancer', 'diabetes', 'epilepsy', 'maternal'],
  },
  {
    slug: 'education-scholarships',
    words: ['education', 'school', 'student', 'scholarship', 'bursary', 'learning', 'literacy', 'training', 'university', 'tafe'],
  },
  {
    slug: 'youth-families',
    words: ['youth', 'young people', 'children', 'child', 'family', 'families', 'early years', 'parenting', 'kids'],
  },
  {
    slug: 'justice-systems-change',
    words: ['justice', 'legal', 'diversion', 'reintegration', 'incarceration', 'prison', 'systems change', 'advocacy', 'policy', 'human rights'],
  },
  {
    slug: 'arts-culture',
    words: ['art', 'arts', 'artist', 'creative', 'culture', 'cultural', 'heritage', 'museum', 'music', 'festival', 'film', 'theatre'],
  },
  {
    slug: 'environment-climate',
    words: ['environment', 'climate', 'sustainability', 'biodiversity', 'conservation', 'landcare', 'reef', 'water', 'tree', 'circular economy', 'regenerative'],
  },
  {
    slug: 'regional-rural',
    words: ['regional', 'rural', 'remote', 'outback', 'country', 'place-based', 'local community', 'community resilience'],
  },
  {
    slug: 'disability-inclusion',
    words: ['disability', 'disabled', 'accessibility', 'inclusion', 'inclusive', 'assistive', 'neurodiverse', 'autism'],
  },
  {
    slug: 'social-enterprise-employment',
    words: ['social enterprise', 'employment', 'jobs', 'workforce', 'enterprise', 'startup', 'business', 'economic participation', 'financial wellbeing'],
  },
  {
    slug: 'disaster-resilience',
    words: ['disaster', 'emergency relief', 'recovery', 'resilience', 'flood', 'bushfire', 'cyclone', 'crisis'],
  },
  {
    slug: 'animal-welfare',
    words: ['animal', 'wildlife', 'rspca', 'pet', 'rescue animal', 'veterinary'],
  },
  {
    slug: 'research-medical-science',
    words: ['research', 'science', 'medical science', 'phd', 'fellowship', 'laboratory', 'translational', 'clinical trial'],
  },
  {
    slug: 'faith-community-welfare',
    words: ['faith', 'church', 'religious', 'catholic', 'anglican', 'christian', 'welfare', 'parish', 'scripture'],
  },
  {
    slug: 'community-capacity',
    words: ['community', 'volunteer', 'capacity building', 'equipment', 'club', 'neighbourhood', 'grassroots', 'community grant'],
  },
];

const STATE_RULES = [
  ['AU-NSW', 'New South Wales', ['au-nsw', 'nsw', 'new south wales', 'sydney']],
  ['AU-VIC', 'Victoria', ['au-vic', 'vic', 'victoria', 'melbourne']],
  ['AU-QLD', 'Queensland', ['au-qld', 'qld', 'queensland', 'brisbane', 'gold coast', 'sunshine coast', 'noosa', 'buderim', 'bundaberg']],
  ['AU-WA', 'Western Australia', ['au-wa', 'wa', 'western australia', 'perth', 'pilbara', 'kimberley']],
  ['AU-SA', 'South Australia', ['au-sa', 'sa', 'south australia', 'adelaide']],
  ['AU-TAS', 'Tasmania', ['au-tas', 'tas', 'tasmania', 'hobart']],
  ['AU-ACT', 'Australian Capital Territory', ['au-act', 'act', 'canberra', 'australian capital territory']],
  ['AU-NT', 'Northern Territory', ['au-nt', 'nt', 'northern territory', 'darwin', 'central australia', 'alice springs']],
];

const REMOTENESS_RULES = [
  ['regional', 'Regional communities', ['regional', 'regions']],
  ['rural', 'Rural communities', ['rural', 'country']],
  ['remote', 'Remote communities', ['remote', 'outback', 'very remote']],
  ['metro', 'Metropolitan communities', ['metro', 'metropolitan', 'urban']],
];

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function errorToString(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    if (error.message) return String(error.message);
    if (error.error) return String(error.error);
    try { return JSON.stringify(error); } catch { return '[unserializable object]'; }
  }
  return String(error);
}

function arrayText(value) {
  return Array.isArray(value) ? value.join(' ') : '';
}

function evidenceForTerm(text, term) {
  const lower = normalizeText(text);
  const needle = normalizeText(term);
  const index = lower.indexOf(needle);
  if (index === -1) return String(text || '').slice(0, 220);
  const start = Math.max(0, index - 80);
  return String(text || '').slice(start, start + 240).trim();
}

function addCategory(assignments, seen, foundationId, slug, kind, confidence, evidenceText, evidenceUrl = null) {
  const key = `${foundationId}::${slug}::${kind}`;
  if (seen.has(key)) return;
  seen.add(key);
  assignments.push({
    foundation_id: foundationId,
    category_slug: slug,
    assignment_kind: kind,
    confidence,
    evidence_text: evidenceText ? String(evidenceText).slice(0, 700) : null,
    evidence_url: evidenceUrl,
    assignment_source: AGENT_ID,
    classifier_version: VERSION,
    updated_at: NOW,
  });
}

function addGeo(assignments, seen, foundationId, geoType, geoCode, geoName, confidence, evidenceText, evidenceUrl = null) {
  const key = `${foundationId}::${geoType}::${geoCode || ''}::${normalizeText(geoName)}`;
  if (seen.has(key)) return;
  seen.add(key);
  assignments.push({
    foundation_id: foundationId,
    geo_type: geoType,
    geo_code: geoCode,
    geo_name: geoName,
    confidence,
    evidence_text: evidenceText ? String(evidenceText).slice(0, 700) : null,
    evidence_url: evidenceUrl,
    assignment_source: AGENT_ID,
    classifier_version: VERSION,
    updated_at: NOW,
  });
}

function classifyCategories(foundation, programs, grantees) {
  const assignments = [];
  const seen = new Set();
  const declaredText = [
    arrayText(foundation.thematic_focus),
    foundation.description,
    foundation.giving_philosophy,
    foundation.application_tips,
    arrayText(foundation.target_recipients),
    foundation.name,
  ].filter(Boolean).join(' ');
  const programText = programs.map(program => [
    program.name,
    program.description,
    arrayText(program.categories),
    arrayText(program.thematic_focus),
    program.eligibility,
    program.application_process,
  ].filter(Boolean).join(' ')).join(' ');
  const observedText = grantees.map(grantee => [
    grantee.program_name,
    grantee.evidence_text,
    grantee.grantee_name,
  ].filter(Boolean).join(' ')).join(' ');

  for (const rule of CATEGORY_RULES) {
    const declaredHit = rule.words.find(word => normalizeText(declaredText).includes(word));
    if (declaredHit) {
      addCategory(assignments, seen, foundation.id, rule.slug, 'declared', 0.82, evidenceForTerm(declaredText, declaredHit), foundation.website);
    }

    const programHit = rule.words.find(word => normalizeText(programText).includes(word));
    if (programHit) {
      const program = programs.find(item => normalizeText([
        item.name,
        item.description,
        arrayText(item.categories),
        arrayText(item.thematic_focus),
      ].join(' ')).includes(programHit));
      addCategory(assignments, seen, foundation.id, rule.slug, 'program', 0.74, program ? `${program.name}: ${evidenceForTerm(program.description || program.name, programHit)}` : evidenceForTerm(programText, programHit), program?.url || foundation.website);
    }

    const observedHit = rule.words.find(word => normalizeText(observedText).includes(word));
    if (observedHit) {
      const grantee = grantees.find(item => normalizeText([
        item.program_name,
        item.evidence_text,
        item.grantee_name,
      ].join(' ')).includes(observedHit));
      addCategory(assignments, seen, foundation.id, rule.slug, 'observed', 0.68, grantee ? `${grantee.grantee_name}: ${evidenceForTerm(grantee.evidence_text || grantee.program_name || grantee.grantee_name, observedHit)}` : evidenceForTerm(observedText, observedHit), grantee?.source_url || grantee?.source_document_url || foundation.website);
    }
  }

  if (assignments.length === 0) {
    addCategory(assignments, seen, foundation.id, 'community-capacity', 'inferred', 0.42, 'Fallback category for foundations without enough structured thematic evidence.', foundation.website);
  }

  return assignments;
}

function classifyGeography(foundation, programs, grantees) {
  const assignments = [];
  const seen = new Set();
  const geoValues = [
    arrayText(foundation.geographic_focus),
    foundation.description,
    ...programs.map(program => arrayText(program.place_focus)),
    ...programs.map(program => program.description),
    ...grantees.map(grantee => grantee.evidence_text),
  ].filter(Boolean);
  const joined = normalizeText(geoValues.join(' '));

  if (/(au-national|national|australia-wide|across australia|australian communities)/.test(joined)) {
    addGeo(assignments, seen, foundation.id, 'national', 'AU', 'Australia', 0.82, 'Declared or program text indicates national Australian focus.', foundation.website);
  }

  for (const [code, name, terms] of STATE_RULES) {
    const term = terms.find(item => joined.includes(item));
    if (term) addGeo(assignments, seen, foundation.id, 'state', code, name, 0.76, evidenceForTerm(geoValues.join(' '), term), foundation.website);
  }

  for (const [code, name, terms] of REMOTENESS_RULES) {
    const term = terms.find(item => joined.includes(item));
    if (term) addGeo(assignments, seen, foundation.id, 'remoteness', code, name, 0.7, evidenceForTerm(geoValues.join(' '), term), foundation.website);
  }

  const placeCandidates = [
    'Gold Coast',
    'Sunshine Coast',
    'Noosa',
    'Buderim',
    'Bundaberg',
    'Gladstone',
    'Central Australia',
    'Pilbara',
    'Kimberley',
    'Cape York',
    'Palm Island',
  ];

  for (const place of placeCandidates) {
    if (joined.includes(normalizeText(place))) {
      addGeo(assignments, seen, foundation.id, 'place', null, place, 0.68, evidenceForTerm(geoValues.join(' '), place), foundation.website);
    }
  }

  if (assignments.length === 0) {
    addGeo(assignments, seen, foundation.id, 'national', 'AU', 'Australia', 0.35, 'No precise geography found; defaulted to national/unknown Australian landscape bucket.', foundation.website);
  }

  return assignments;
}

async function fetchFoundations() {
  const selectColumns = 'id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, target_recipients, giving_philosophy, application_tips, profile_confidence, updated_at';

  if (FOUNDATION_ID) {
    const { data, error } = await db
      .from('foundations')
      .select(selectColumns)
      .eq('id', FOUNDATION_ID);
    if (error) throw error;
    return data || [];
  }

  const rows = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    let query = db
      .from('foundations')
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (LIMIT) {
      const remaining = LIMIT - rows.length;
      if (remaining <= 0) break;
      query = db
        .from('foundations')
        .select(selectColumns)
        .order('id', { ascending: true })
        .range(page * pageSize, page * pageSize + Math.min(pageSize, remaining) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize || (LIMIT && rows.length >= LIMIT)) break;
    page += 1;
  }

  const byId = new Map(rows.map(row => [row.id, row]));
  const deduped = [...byId.values()];
  return LIMIT ? deduped.slice(0, LIMIT) : deduped;
}

async function fetchPrograms(foundationIds) {
  if (!foundationIds.length) return new Map();
  const rows = [];
  for (let i = 0; i < foundationIds.length; i += 200) {
    const batch = foundationIds.slice(i, i + 200);
    const { data, error } = await db
      .from('foundation_programs')
      .select('foundation_id, name, url, description, status, categories, eligibility, application_process, thematic_focus, place_focus')
      .in('foundation_id', batch);
    if (error) throw error;
    rows.push(...(data || []));
  }

  const byFoundation = new Map();
  for (const row of rows) {
    const list = byFoundation.get(row.foundation_id) || [];
    list.push(row);
    byFoundation.set(row.foundation_id, list);
  }
  return byFoundation;
}

async function fetchGrantees(foundationIds) {
  if (!foundationIds.length) return new Map();
  const rows = [];
  for (let i = 0; i < foundationIds.length; i += 200) {
    const batch = foundationIds.slice(i, i + 200);
    const { data, error } = await db
      .from('foundation_grantees')
      .select('foundation_id, grantee_name, program_name, evidence_text, source_url, source_document_url')
      .in('foundation_id', batch)
      .limit(5000);
    if (error) throw error;
    rows.push(...(data || []));
  }

  const byFoundation = new Map();
  for (const row of rows) {
    const list = byFoundation.get(row.foundation_id) || [];
    list.push(row);
    byFoundation.set(row.foundation_id, list);
  }
  return byFoundation;
}

async function replaceAssignments(table, foundationIds, rows) {
  if (DRY_RUN || !foundationIds.length) return;

  for (let i = 0; i < foundationIds.length; i += 200) {
    const batch = foundationIds.slice(i, i + 200);
    const { error } = await db
      .from(table)
      .delete()
      .eq('assignment_source', AGENT_ID)
      .in('foundation_id', batch);
    if (error) throw error;
  }

  const uniqueRows = [];
  const seen = new Set();
  for (const row of rows) {
    const key = table === 'foundation_category_assignments'
      ? `${row.foundation_id}::${row.category_slug}::${row.assignment_kind}::${row.assignment_source}`
      : `${row.foundation_id}::${row.geo_type}::${row.geo_code || ''}::${normalizeText(row.geo_name)}::${row.assignment_source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  for (let i = 0; i < uniqueRows.length; i += 500) {
    const batch = uniqueRows.slice(i, i + 500);
    const { error } = await db
      .from(table)
      .insert(batch);
    if (error) throw error;
  }
}

async function refreshViews() {
  if (!DRY_RUN) {
    console.log('Refresh materialized views with psql after this script finishes.');
  }
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    const foundations = await fetchFoundations();
    const foundationIds = foundations.map(row => row.id);
    const [programsByFoundation, granteesByFoundation] = await Promise.all([
      fetchPrograms(foundationIds),
      fetchGrantees(foundationIds),
    ]);

    const categoryRows = [];
    const geoRows = [];

    for (const foundation of foundations) {
      const programs = programsByFoundation.get(foundation.id) || [];
      const grantees = granteesByFoundation.get(foundation.id) || [];
      categoryRows.push(...classifyCategories(foundation, programs, grantees));
      geoRows.push(...classifyGeography(foundation, programs, grantees));
    }

    console.log(`Foundations classified: ${foundations.length}`);
    console.log(`Category assignments: ${categoryRows.length}`);
    console.log(`Geo assignments: ${geoRows.length}`);

    await replaceAssignments('foundation_category_assignments', foundationIds, categoryRows);
    await replaceAssignments('foundation_geo_focus', foundationIds, geoRows);
    await refreshViews();

    if (!DRY_RUN) {
      await logComplete(db, run.id, {
        items_found: foundations.length,
        items_new: categoryRows.length + geoRows.length,
        items_updated: foundations.length,
      });
    }
  } catch (error) {
    if (!DRY_RUN) await logFailed(db, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(errorToString(error));
  process.exit(1);
});
