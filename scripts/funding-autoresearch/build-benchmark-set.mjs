#!/usr/bin/env node

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { ARCHETYPES, SCENARIO_FAMILIES } from './lib/archetypes.mjs';
import {
  compactUnique,
  hasCommunitySignal,
  hasIndigenousSignal,
  hasRegionalSignal,
  normalizeBeneficiaryValues,
  normalizeArray,
  normalizeText,
  overlapCount,
  stateMatches,
  deliveryTrust,
  foundationRelationshipUtility,
} from './lib/signals.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const OUTPUT_PATH = join(DATA_DIR, 'funding-benchmark.json');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function log(message) {
  console.log(`[funding-benchmark] ${message}`);
}

async function fetchAll(table, select, options = {}) {
  const results = [];
  const pageSize = options.pageSize || 1000;
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
    if (!data?.length) break;
    results.push(...data);
    offset += data.length;
    if (data.length < pageSize) break;
  }

  log(`Loaded ${results.length} rows from ${table}`);
  return results;
}

function normalizeGrant(grant) {
  return {
    kind: 'grant',
    id: grant.id,
    name: grant.name,
    provider: grant.provider,
    themes: compactUnique([...(grant.categories || []), ...(grant.focus_areas || [])], 8),
    beneficiaries: normalizeBeneficiaryValues(grant.target_recipients),
    states: grant.geography ? [String(grant.geography).replace(/^AU-/, '')] : [],
    source: grant.source,
    amountMin: grant.amount_min,
    amountMax: grant.amount_max,
    deadline: grant.closes_at,
    url: grant.url,
    lastVerifiedAt: grant.last_verified_at,
    grantType: grant.grant_type,
    programType: grant.program_type,
    foundationId: grant.foundation_id,
  };
}

function normalizeFoundation(foundation) {
  return {
    kind: 'foundation',
    id: foundation.id,
    name: foundation.name,
    themes: normalizeArray(foundation.thematic_focus),
    beneficiaries: normalizeBeneficiaryValues(foundation.target_recipients),
    states: normalizeArray(foundation.geographic_focus).map((value) => value.replace(/^AU-/, '')),
    website: foundation.website,
    profileConfidence: foundation.profile_confidence,
    totalGivingAnnual: foundation.total_giving_annual,
    hasOpenPrograms: Array.isArray(foundation.open_programs) ? foundation.open_programs.length > 0 : Boolean(foundation.open_programs),
    hasApplicationTips: Boolean(foundation.application_tips),
    enrichedAt: foundation.enriched_at,
    avgGrantSize: foundation.avg_grant_size,
    grantRangeMin: foundation.grant_range_min,
    grantRangeMax: foundation.grant_range_max,
    givingPhilosophy: foundation.giving_philosophy,
    wealthSource: foundation.wealth_source,
    boardMembersCount: Array.isArray(foundation.board_members) ? foundation.board_members.length : 0,
  };
}

function normalizeCharity(charity) {
  return {
    kind: 'charity',
    id: charity.abn,
    name: charity.name,
    purposes: normalizeArray(charity.purposes),
    beneficiaries: normalizeBeneficiaryValues([
      ...(normalizeArray(charity.beneficiaries)),
      ...(charity.ben_aboriginal_tsi ? ['First Nations'] : []),
      ...(charity.ben_rural_regional_remote ? ['Rural & Remote'] : []),
      ...(charity.ben_people_with_disabilities ? ['Disability'] : []),
      ...(charity.ben_youth ? ['Youth'] : []),
    ]),
    states: normalizeArray(charity.operating_states),
    website: charity.website,
    pbi: charity.pbi,
    hpc: charity.hpc,
    hasEnrichment: charity.has_enrichment,
    totalRevenue: charity.total_revenue,
    totalGrantsGiven: charity.total_grants_given,
    firstNations: charity.ben_aboriginal_tsi,
    regionalRemote: charity.ben_rural_regional_remote,
    disability: charity.ben_people_with_disabilities,
    youth: charity.ben_youth,
  };
}

function normalizeSocialEnterprise(enterprise) {
  return {
    kind: 'social_enterprise',
    id: enterprise.id,
    name: enterprise.name,
    sectors: normalizeArray(enterprise.sector),
    beneficiaries: normalizeBeneficiaryValues(enterprise.target_beneficiaries),
    states: compactUnique([
      ...(enterprise.state ? [enterprise.state] : []),
      ...normalizeArray(enterprise.geographic_focus).map((value) => value.replace(/^AU-/, '').toUpperCase()),
    ], 8),
    website: enterprise.website,
    profileConfidence: enterprise.profile_confidence,
    orgType: enterprise.org_type,
    hasDescription: Boolean(enterprise.description),
    hasBusinessModel: Boolean(enterprise.business_model),
    certificationsCount: Array.isArray(enterprise.certifications) ? enterprise.certifications.length : 0,
    sourcePrimary: enterprise.source_primary,
    hasGeographicFocus: normalizeArray(enterprise.geographic_focus).length > 0,
  };
}

function normalizePlace(place, geoByPostcode, seifaByPostcode) {
  const geo = geoByPostcode.get(place.postcode) || {};
  const seifa = seifaByPostcode.get(place.postcode);
  return {
    kind: 'place',
    id: place.postcode,
    postcode: place.postcode,
    state: place.state,
    states: place.state ? [place.state] : [],
    remoteness: place.remoteness,
    entityCount: place.entity_count,
    totalFunding: Number(place.total_funding || 0),
    locality: geo.locality || null,
    lgaName: geo.lga_name || place.lga_name || null,
    seifaDecile: seifa?.decile_national || null,
  };
}

function baseGrantPoolScore(archetype, grant) {
  let score = 0;
  score += overlapCount(archetype.themes, grant.themes) * 3;
  score += overlapCount(archetype.beneficiaries, grant.beneficiaries) * 2;
  score += stateMatches(archetype.states, grant.states) * 2;
  if (grant.grantType === 'open_opportunity') score += 2;
  if (grant.url) score += 1;
  if (grant.deadline) score += 1;
  if (archetype.preferIndigenous && hasIndigenousSignal(grant)) score += 2;
  if (archetype.preferCommunityControlled && hasCommunitySignal(grant)) score += 1;
  return score;
}

function baseFoundationPoolScore(archetype, foundation) {
  let score = 0;
  score += overlapCount(archetype.themes, foundation.themes) * 3;
  score += overlapCount(archetype.beneficiaries, foundation.beneficiaries) * 2;
  score += stateMatches(archetype.states, foundation.states) * 2;
  score += foundationRelationshipUtility(foundation) * 0.75;
  if (archetype.preferIndigenous && hasIndigenousSignal(foundation)) score += 2;
  return score;
}

function baseCharityPoolScore(archetype, charity) {
  let score = 0;
  score += overlapCount(archetype.themes, charity.purposes) * 3;
  score += overlapCount(archetype.beneficiaries, charity.beneficiaries) * 2;
  score += stateMatches(archetype.states, charity.states) * 2;
  score += deliveryTrust(charity) * 0.75;
  if (archetype.preferIndigenous && hasIndigenousSignal(charity)) score += 2;
  if (archetype.preferRegional && hasRegionalSignal(charity)) score += 1;
  return score;
}

function baseSocialEnterprisePoolScore(archetype, enterprise) {
  let score = 0;
  score += overlapCount(archetype.themes, enterprise.sectors) * 3;
  score += overlapCount(archetype.beneficiaries, enterprise.beneficiaries) * 2;
  score += stateMatches(archetype.states, enterprise.states) * 2;
  score += deliveryTrust(enterprise) * 0.75;
  if (enterprise.orgType === 'social_enterprise') score += 1;
  if (archetype.preferIndigenous && hasIndigenousSignal(enterprise)) score += 2;
  return score;
}

function basePlacePoolScore(archetype, place) {
  let score = 0;
  score += stateMatches(archetype.states, place.states) * 2;
  if (archetype.needFirst) score += 4;
  if (place.totalFunding === 0) score += 4;
  if (place.seifaDecile && place.seifaDecile <= 3) score += 3;
  if (hasRegionalSignal(place)) score += 2;
  if (place.entityCount && place.entityCount > 0) score += 1;
  return score;
}

function buildCandidatePool(records, scoreFn, limit = 24, distractors = 8) {
  const seen = new Set();
  const uniqueRecords = records.filter((record) => {
    const key = `${record.kind}:${normalizeText(String(record.id || record.name || record.postcode || ''))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ranked = uniqueRecords
    .map((record) => ({ ...record, poolScore: scoreFn(record) }))
    .sort((a, b) => b.poolScore - a.poolScore || normalizeText(a.name || a.postcode).localeCompare(normalizeText(b.name || b.postcode)));

  const positive = ranked.filter((row) => row.poolScore > 0);
  const strong = positive.slice(0, limit);
  const nearMisses = positive.slice(limit, limit + Math.ceil(limit / 2));
  const weak = ranked.filter((row) => row.poolScore === 0);
  const weakStride = Math.max(1, Math.floor(weak.length / Math.max(distractors, 1)));
  const sampledWeak = weak.filter((_, index) => index % weakStride === 0).slice(0, distractors);

  return [...strong, ...nearMisses, ...sampledWeak];
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const [
    orgProfiles,
    grantsRaw,
    foundationsRaw,
    charitiesRaw,
    socialEnterprisesRaw,
    postcodeFundingRaw,
    postcodeGeoRaw,
    seifaRaw,
  ] = await Promise.all([
    fetchAll('org_profiles', 'id, name, mission, geographic_focus'),
    fetchAll(
      'grant_opportunities',
      'id, name, provider, categories, focus_areas, target_recipients, geography, source, amount_min, amount_max, closes_at, url, last_verified_at, grant_type, program_type, foundation_id'
    ),
    fetchAll(
      'foundations',
      'id, name, thematic_focus, geographic_focus, target_recipients, website, profile_confidence, total_giving_annual, avg_grant_size, grant_range_min, grant_range_max, open_programs, application_tips, giving_philosophy, wealth_source, board_members, enriched_at'
    ),
    fetchAll(
      'v_charity_explorer',
      'abn, name, purposes, beneficiaries, operating_states, website, pbi, hpc, has_enrichment, total_revenue, total_grants_given, ben_aboriginal_tsi, ben_rural_regional_remote, ben_people_with_disabilities, ben_youth, is_foundation'
    ),
    fetchAll(
      'social_enterprises',
      'id, name, org_type, state, sector, geographic_focus, target_beneficiaries, website, profile_confidence, description, certifications, business_model, source_primary'
    ),
    fetchAll(
      'mv_funding_by_postcode',
      'postcode, state, remoteness, locality, entity_count, total_funding'
    ),
    fetchAll(
      'postcode_geo',
      'postcode, locality, lga_name'
    ),
    fetchAll(
      'seifa_2021',
      'postcode, index_type, decile_national'
    ),
  ]);

  const profile = orgProfiles.find((row) => normalizeText(row.name).includes('curious tractor')) || null;

  const grants = grantsRaw.map(normalizeGrant);
  const foundations = foundationsRaw.map(normalizeFoundation);
  const charities = charitiesRaw.filter((row) => !row.is_foundation).map(normalizeCharity);
  const socialEnterprises = socialEnterprisesRaw.map(normalizeSocialEnterprise);
  const geoByPostcode = new Map(postcodeGeoRaw.map((row) => [row.postcode, row]));
  const seifaByPostcode = new Map(
    seifaRaw
      .filter((row) => normalizeText(row.index_type) === 'irsd')
      .map((row) => [row.postcode, row]),
  );
  const places = postcodeFundingRaw.map((row) => normalizePlace(row, geoByPostcode, seifaByPostcode));

  const scenarios = [];
  for (const archetype of ARCHETYPES) {
    for (const family of SCENARIO_FAMILIES) {
      let candidatePool = [];
      if (family === 'grant_discovery') {
        candidatePool = buildCandidatePool(grants, (grant) => baseGrantPoolScore(archetype, grant));
      } else if (family === 'foundation_discovery') {
        candidatePool = buildCandidatePool(foundations, (foundation) => baseFoundationPoolScore(archetype, foundation));
      } else if (family === 'charity_delivery_match') {
        candidatePool = buildCandidatePool(charities, (charity) => baseCharityPoolScore(archetype, charity));
      } else if (family === 'social_enterprise_delivery_match') {
        candidatePool = buildCandidatePool(socialEnterprises, (enterprise) => baseSocialEnterprisePoolScore(archetype, enterprise));
      } else if (family === 'need_gap_search') {
        candidatePool = buildCandidatePool(places, (place) => basePlacePoolScore(archetype, place));
      }

      scenarios.push({
        id: `${family}:${archetype.id}`,
        family,
        title: archetype.title,
        seekerType: archetype.seekerType,
        needStatement: archetype.needFirst
          ? 'Start with communities and places where funding is thin relative to need.'
          : 'Find the most plausible funding and delivery network for this mission.',
        target: {
          themes: archetype.themes,
          states: archetype.states,
          beneficiaries: archetype.beneficiaries,
          preferIndigenous: archetype.preferIndigenous,
          preferCommunityControlled: archetype.preferCommunityControlled,
          preferRegional: archetype.preferRegional,
          needFirst: archetype.needFirst,
        },
        candidatePool,
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    benchmarkVersion: 'funding-network-v2',
    scenarioCount: scenarios.length,
    profileContext: profile
      ? {
          id: profile.id,
          name: profile.name,
          mission: profile.mission,
          geographicFocus: normalizeArray(profile.geographic_focus),
        }
      : null,
    families: SCENARIO_FAMILIES,
    scenarios,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  log(`Wrote ${scenarios.length} scenarios to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error('[funding-benchmark] Fatal:', error);
  process.exit(1);
});
