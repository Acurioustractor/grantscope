#!/usr/bin/env node
/**
 * Seed Governed Proof place bundles for PRF partner sites.
 * Creates/updates bundles with capital + evidence + voice context from CivicGraph data.
 *
 * Usage: node --env-file=.env scripts/seed-prf-place-bundles.mjs [--live]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dryRun = !process.argv.includes('--live');

// PRF partner sites mapped to postcodes
const sites = [
  // NSW
  { postcode: '2840', locality: 'Bourke', state: 'NSW', partners: ['Aboriginal Legal Services (NSW/ACT)', 'Maranguka'] },
  { postcode: '2440', locality: 'Kempsey', state: 'NSW', partners: ['Aboriginal Legal Services (NSW/ACT)', 'Just Reinvest NSW', 'Dhina Durriti Aboriginal Corp'] },
  { postcode: '2400', locality: 'Moree', state: 'NSW', partners: ['Aboriginal Legal Services (NSW/ACT)', 'Just Reinvest NSW'] },
  { postcode: '2770', locality: 'Mount Druitt', state: 'NSW', partners: ['Aboriginal Legal Services (NSW/ACT)', 'Just Reinvest NSW'] },
  { postcode: '2541', locality: 'Nowra', state: 'NSW', partners: ['Aboriginal Legal Services (NSW/ACT)', 'Just Reinvest NSW', 'South Coast Women\'s Health and Wellbeing'] },
  { postcode: '2832', locality: 'Walgett', state: 'NSW', partners: ['Yuwaya Ngarra-li / UNSW'] },
  // NT
  { postcode: '0870', locality: 'Alice Springs', state: 'NT', partners: ['NTCOSS'] },
  { postcode: '0822', locality: 'Groote Eylandt', state: 'NT', partners: ['Anindilyakwa Royalties Aboriginal Corporation'] },
  // SA
  { postcode: '5015', locality: 'Port Adelaide', state: 'SA', partners: ['Tiraapendi Wodli / Australian Red Cross'] },
  // VIC
  { postcode: '3003', locality: 'West Melbourne', state: 'VIC', partners: ['WEstjustice / CMY (Target Zero)'] },
  { postcode: '3337', locality: 'Melton', state: 'VIC', partners: ['WEstjustice / CMY (Target Zero)'] },
  // WA
  { postcode: '6728', locality: 'Derby', state: 'WA', partners: ['Olabud Doogethu'] },
  { postcode: '6770', locality: 'Halls Creek', state: 'WA', partners: ['Social Reinvestment WA'] },
];

async function buildCapitalContext(postcode) {
  const { data: funding } = await supabase
    .from('mv_funding_by_postcode')
    .select('*')
    .eq('postcode', postcode)
    .limit(1);

  const { data: entities } = await supabase
    .from('gs_entities')
    .select('id, canonical_name, entity_type, abn, is_community_controlled')
    .eq('postcode', postcode)
    .limit(50);

  const { data: justiceFunding } = await supabase
    .from('justice_funding')
    .select('recipient_name, program_name, amount_dollars, sector')
    .eq('source', 'prf-jr-portfolio-review-2025')
    .limit(50);

  // Match PRF funding to entities in this postcode
  const entityNames = new Set((entities || []).map(e => e.canonical_name?.toUpperCase()));
  const prfFundingHere = (justiceFunding || []).filter(jf =>
    entityNames.has(jf.recipient_name?.toUpperCase())
  );

  const entityList = entities || [];
  const ccCount = entityList.filter(e => e.is_community_controlled).length;
  const totalFunding = funding?.[0]?.total_funding || 0;

  return {
    fundingByPostcode: funding?.[0] || null,
    totalFunding,
    entityCount: entityList.length,
    communityControlledCount: ccCount,
    prfFunding: prfFundingHere,
    prfTotalHere: prfFundingHere.reduce((sum, jf) => sum + (jf.amount_dollars || 0), 0),
  };
}

async function buildEvidenceContext(postcode, state, locality) {
  // ALMA interventions near this location
  const { data: almaData } = await supabase.rpc('exec_sql', {
    query: `SELECT name, type, evidence_level, gs_entity_id IS NOT NULL as linked
      FROM alma_interventions
      WHERE geography::text ILIKE '%${locality.replace(/'/g, "''")}%'
         OR geography::text ILIKE '%${state}%'
      ORDER BY CASE WHEN gs_entity_id IS NOT NULL THEN 0 ELSE 1 END, name
      LIMIT 20`,
  });

  const interventions = Array.isArray(almaData) ? almaData : [];

  // Crime stats for this LGA
  const { data: geo } = await supabase
    .from('postcode_geo')
    .select('lga_name')
    .eq('postcode', postcode)
    .not('state', 'is', null)
    .limit(1);

  let crimeStats = null;
  if (geo?.[0]?.lga_name) {
    const lgaClean = geo[0].lga_name.replace(/\s*\(.*?\)\s*$/, '');
    const { data: crime } = await supabase.rpc('exec_sql', {
      query: `SELECT offence_group, SUM(incidents) as total_incidents, AVG(rate_per_100k) as rate_per_100k
        FROM crime_stats_lga
        WHERE lga_name = '${lgaClean.replace(/'/g, "''")}' AND state = '${state}'
          AND offence_group != 'Summary'
        GROUP BY offence_group ORDER BY total_incidents DESC LIMIT 5`,
    });
    crimeStats = Array.isArray(crime) ? crime : null;
  }

  // Schools
  const { data: schools } = await supabase
    .from('acara_schools')
    .select('school_name, icsea_value, indigenous_pct, total_enrolments')
    .eq('postcode', postcode)
    .order('total_enrolments', { ascending: false })
    .limit(10);

  return {
    interventionCount: interventions.length,
    interventions: interventions.slice(0, 10),
    linkedInterventions: interventions.filter(i => i.linked).length,
    crimeStats,
    schoolCount: (schools || []).length,
    avgIcsea: schools?.length
      ? Math.round(schools.reduce((s, r) => s + (r.icsea_value || 0), 0) / schools.length)
      : null,
    avgIndigenousPct: schools?.length
      ? Math.round(schools.reduce((s, r) => s + (r.indigenous_pct || 0), 0) / schools.length)
      : null,
  };
}

async function buildVoiceContext(locality, state) {
  // EL transcripts
  const { data: transcripts } = await supabase
    .from('el_transcripts')
    .select('id, title, storyteller_name, word_count')
    .ilike('location', `%${locality}%`)
    .order('word_count', { ascending: false })
    .limit(10);

  return {
    transcriptCount: (transcripts || []).length,
    transcripts: (transcripts || []).slice(0, 5).map(t => ({
      title: t.title,
      storyteller: t.storyteller_name,
      wordCount: t.word_count,
    })),
  };
}

function computeConfidence(capital, evidence, voice) {
  let score = 0;
  // Capital: 0.3 weight
  if (capital.totalFunding > 0) score += 0.2;
  if (capital.entityCount > 5) score += 0.1;
  // Evidence: 0.4 weight
  if (evidence.interventionCount > 0) score += 0.2;
  if (evidence.linkedInterventions > 0) score += 0.1;
  if (evidence.crimeStats) score += 0.05;
  if (evidence.schoolCount > 0) score += 0.05;
  // Voice: 0.2 weight
  if (voice.transcriptCount > 0) score += 0.15;
  if (voice.transcriptCount > 3) score += 0.05;
  // PRF connection: 0.1 bonus
  if (capital.prfTotalHere > 0) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

async function main() {
  console.log(`PRF Place Bundle Seeder — ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${sites.length} sites to process\n`);

  let created = 0;
  let updated = 0;

  for (const site of sites) {
    const bundleKey = `place:${site.postcode}`;

    // Check existing
    const { data: existing } = await supabase
      .from('governed_proof_bundles')
      .select('id, overall_confidence, promotion_status')
      .eq('bundle_key', bundleKey)
      .limit(1);

    // Build contexts in parallel
    const [capital, evidence, voice] = await Promise.all([
      buildCapitalContext(site.postcode),
      buildEvidenceContext(site.postcode, site.state, site.locality),
      buildVoiceContext(site.locality, site.state),
    ]);

    const confidence = computeConfidence(capital, evidence, voice);

    const action = existing?.length ? 'UPDATE' : 'CREATE';
    const emoji = confidence >= 0.7 ? '●' : confidence >= 0.4 ? '◐' : '○';
    console.log(`${emoji} ${action} ${site.locality}, ${site.state} (${site.postcode}) — conf=${confidence}`);
    console.log(`   Capital: ${capital.entityCount} entities, $${Math.round((capital.totalFunding || 0) / 1000)}K funding`);
    console.log(`   Evidence: ${evidence.interventionCount} ALMA, ${evidence.schoolCount} schools, crime=${evidence.crimeStats ? 'yes' : 'no'}`);
    console.log(`   Voice: ${voice.transcriptCount} transcripts`);
    console.log(`   Partners: ${site.partners.join(', ')}`);

    if (!dryRun) {
      const { error } = await supabase
        .from('governed_proof_bundles')
        .upsert(
          {
            bundle_key: bundleKey,
            subject_type: 'place',
            subject_id: site.postcode,
            owner_system: 'GS',
            lifecycle_status: 'enriched',
            review_status: 'not_required',
            promotion_status: existing?.[0]?.promotion_status || 'internal',
            overall_confidence: confidence,
            capital_confidence: capital.totalFunding > 0 ? 0.8 : 0.4,
            evidence_confidence: evidence.interventionCount > 0 ? 0.8 : 0.3,
            voice_confidence: voice.transcriptCount > 0 ? 0.8 : 0.2,
            capital_context: capital,
            evidence_context: evidence,
            voice_context: voice,
            output_context: {
              prfSite: true,
              partners: site.partners,
              locality: site.locality,
              state: site.state,
              generatedAt: new Date().toISOString(),
            },
            freshness_at: new Date().toISOString(),
          },
          { onConflict: 'bundle_key' }
        );

      if (error) {
        console.error(`   ERROR: ${error.message}`);
      } else {
        if (action === 'CREATE') created++;
        else updated++;
      }
    }
    console.log('');
  }

  console.log(`Done. Created: ${dryRun ? 'N/A' : created}, Updated: ${dryRun ? 'N/A' : updated}`);
}

main().catch(console.error);
