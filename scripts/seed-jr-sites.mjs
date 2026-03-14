#!/usr/bin/env node
// Seed justice reinvestment sites from research data
// Sources: PRF JR Portfolio Review, justicereinvestment.net.au, AIC

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
);

const sites = [
  {
    name: 'Maranguka Justice Reinvestment',
    location: 'Bourke, NSW',
    state: 'NSW',
    postcode: '2840',
    lga_name: 'Bourke',
    start_year: 2013,
    lead_organisation: 'Maranguka Community Hub',
    funders: ['Paul Ramsay Foundation', 'Just Reinvest NSW', 'Dusseldorp Forum'],
    total_funding: 5000000,
    focus_areas: ['youth-justice', 'indigenous', 'family-violence', 'community-safety'],
    target_population: 'Aboriginal community, youth at risk',
    outcomes: {
      'major_offences_reduction': '-18%',
      'dv_assault_reduction': '-39%',
      'juvenile_charges_reduction': '-38%',
      'bail_breaches_reduction': '-34%',
      'days_in_custody_reduction': '-31%',
      'gross_impact': '$3.1M',
      'evaluation': 'KPMG 2018'
    },
    outcome_summary: 'KPMG evaluation showed $3.1M gross community impact. 18% drop in major offences, 39% drop in DV assaults, 38% drop in juvenile charges, 34% drop in bail breaches.',
    model_type: 'place-based',
    indigenous_led: true,
    source: 'PRF JR Portfolio Review + KPMG evaluation',
    source_url: 'https://justicereinvestment.net.au/jr-in-australia/bourke/',
    status: 'active',
  },
  {
    name: 'Olabud Doogethu (Halls Creek)',
    location: 'Halls Creek, WA',
    state: 'WA',
    postcode: '6770',
    lga_name: 'Halls Creek',
    start_year: 2018,
    lead_organisation: 'Olabud Doogethu',
    funders: ['Paul Ramsay Foundation', 'WA Government'],
    focus_areas: ['youth-justice', 'indigenous', 'community-safety'],
    target_population: 'Aboriginal youth and families',
    outcomes: {
      'youth_arrests_reduction': '-69%',
      'charges_per_youth_reduction': '-56%',
    },
    outcome_summary: '69% reduction in youth arrests, 56% reduction in charges per youth. Community-led night patrol and youth engagement.',
    model_type: 'place-based',
    indigenous_led: true,
    source: 'PRF JR Portfolio Review',
    source_url: 'https://olabuddoogethu.org.au/',
    status: 'active',
  },
  {
    name: 'Cherbourg Justice Reinvestment',
    location: 'Cherbourg, QLD',
    state: 'QLD',
    postcode: '4605',
    lga_name: 'Cherbourg',
    start_year: 2019,
    lead_organisation: 'Cherbourg Aboriginal Shire Council',
    funders: ['Paul Ramsay Foundation', 'QLD Government'],
    focus_areas: ['youth-justice', 'indigenous', 'diversion'],
    target_population: 'Aboriginal youth',
    outcomes: {},
    outcome_summary: 'Community-led youth diversion and engagement programs. Early-stage outcomes being evaluated.',
    model_type: 'place-based',
    indigenous_led: true,
    source: 'PRF JR Portfolio Review',
    status: 'active',
  },
  {
    name: 'Just Reinvest NSW',
    location: 'Sydney, NSW (state-wide advocacy)',
    state: 'NSW',
    start_year: 2011,
    lead_organisation: 'Just Reinvest NSW Inc',
    funders: ['Paul Ramsay Foundation', 'Dusseldorp Forum'],
    focus_areas: ['youth-justice', 'indigenous', 'systemic-reform', 'advocacy'],
    target_population: 'Aboriginal and Torres Strait Islander communities',
    outcomes: {
      'policy_wins': 'Raised the age campaign, Bourke pilot establishment',
    },
    outcome_summary: 'Key advocacy body behind Maranguka pilot. Led Raise the Age campaign. Policy and systemic reform focus.',
    model_type: 'systemic',
    indigenous_led: false,
    source: 'justicereinvestment.net.au',
    source_url: 'https://www.justreinvest.org.au/',
    status: 'active',
  },
  {
    name: 'Logan Together',
    location: 'Logan, QLD',
    state: 'QLD',
    postcode: '4114',
    lga_name: 'Logan',
    start_year: 2015,
    lead_organisation: 'Logan Together',
    funders: ['Dusseldorp Forum', 'QLD Government', 'Logan City Council'],
    total_funding: 38000000,
    focus_areas: ['early-childhood', 'indigenous', 'community-development'],
    target_population: 'Children 0-8 years and families in Logan',
    outcomes: {
      'model': 'PLACE collective impact',
    },
    outcome_summary: 'Part of PLACE national network. Collective impact approach to early childhood outcomes in one of Australia\'s most diverse communities.',
    model_type: 'place-based',
    indigenous_led: false,
    source: 'Dusseldorp Forum / PLACE',
    source_url: 'https://logantogether.org.au/',
    status: 'active',
  },
  {
    name: 'PLACE National Centre',
    location: 'Sydney, NSW (national)',
    state: 'NSW',
    start_year: 2024,
    lead_organisation: 'Dusseldorp Forum',
    funders: ['Dusseldorp Forum'],
    focus_areas: ['place-based', 'community-development', 'systemic-reform'],
    target_population: 'Disadvantaged communities nationally',
    outcomes: {},
    outcome_summary: 'National centre for place-based collaboration established 2024. Coordinates Maranguka, Logan Together, and other place-based initiatives.',
    model_type: 'systemic',
    indigenous_led: false,
    source: 'Dusseldorp Forum',
    source_url: 'https://dusseldorp.org.au/',
    status: 'active',
  },
  {
    name: 'Tiraapendi Wodli (Port Adelaide)',
    location: 'Port Adelaide, SA',
    state: 'SA',
    postcode: '5015',
    lga_name: 'Port Adelaide Enfield',
    start_year: 2020,
    lead_organisation: 'Tiraapendi Wodli',
    funders: ['Paul Ramsay Foundation', 'SA Government'],
    focus_areas: ['youth-justice', 'indigenous', 'community-development'],
    target_population: 'Aboriginal youth and families in Port Adelaide',
    outcomes: {},
    outcome_summary: 'Community-led justice reinvestment initiative in Port Adelaide. Focus on Aboriginal youth pathways.',
    model_type: 'place-based',
    indigenous_led: true,
    source: 'PRF JR Portfolio Review',
    status: 'active',
  },
  {
    name: 'Just Futures Grant Round',
    location: 'National',
    state: null,
    start_year: 2023,
    lead_organisation: 'Paul Ramsay Foundation + Australian Communities Foundation',
    funders: ['Paul Ramsay Foundation', 'Australian Communities Foundation'],
    total_funding: 9000000,
    focus_areas: ['youth-justice', 'indigenous', 'alternatives-to-custody', 'post-release'],
    target_population: 'First Nations and CALD youth, justice-involved individuals',
    outcomes: {
      'grants_awarded': 11,
      'total_value': '$9M',
    },
    outcome_summary: '$9M to 11 organisations working on community-led prevention, post-release programs, and alternatives to custody for First Nations and CALD youth.',
    model_type: 'program',
    indigenous_led: false,
    source: 'NIT / PRF',
    source_url: 'https://nit.com.au/21-11-2023/8714/indigenous-organisations-receive-paul-ramsay-foundation-grants',
    status: 'active',
  },
  {
    name: 'Kimberley Justice Reinvestment',
    location: 'Kimberley Region, WA',
    state: 'WA',
    start_year: 2019,
    lead_organisation: 'Kimberley Aboriginal Law and Culture Centre',
    funders: ['Paul Ramsay Foundation', 'Commonwealth'],
    focus_areas: ['youth-justice', 'indigenous', 'law-and-culture'],
    target_population: 'Aboriginal communities across Kimberley',
    outcomes: {},
    outcome_summary: 'Regional justice reinvestment approach incorporating Aboriginal law and culture alongside western justice system.',
    model_type: 'place-based',
    indigenous_led: true,
    source: 'PRF JR Portfolio Review',
    status: 'active',
  },
  {
    name: 'Katherine (NT) JR Initiative',
    location: 'Katherine, NT',
    state: 'NT',
    postcode: '0850',
    lga_name: 'Katherine',
    start_year: 2021,
    lead_organisation: 'Katherine Region community organisations',
    funders: ['Paul Ramsay Foundation', 'NT Government'],
    focus_areas: ['youth-justice', 'indigenous', 'community-safety'],
    target_population: 'Aboriginal youth in Katherine region',
    outcomes: {},
    outcome_summary: 'Justice reinvestment initiative in Katherine focused on Aboriginal youth diversion and community safety.',
    model_type: 'place-based',
    indigenous_led: true,
    source: 'PRF JR Portfolio Review',
    status: 'active',
  },
  {
    name: 'Commonwealth Justice Reinvestment Program',
    location: 'National (28 initiatives)',
    state: null,
    start_year: 2021,
    lead_organisation: 'Attorney-General\'s Department',
    funders: ['Commonwealth'],
    total_funding: 69000000,
    focus_areas: ['youth-justice', 'indigenous', 'community-safety', 'systemic-reform'],
    target_population: 'Aboriginal and Torres Strait Islander communities nationally',
    outcomes: {
      'initiatives_funded': 28,
      'communities_reached': '40+',
    },
    outcome_summary: '$69M+ Commonwealth investment across 28 justice reinvestment initiatives. Part of Closing the Gap implementation.',
    model_type: 'systemic',
    indigenous_led: false,
    source: 'AG.gov.au',
    source_url: 'https://www.ag.gov.au/legal-system/justice-reinvestment',
    status: 'active',
  },
];

const dryRun = !process.argv.includes('--apply');

console.log('=== Seed Justice Reinvestment Sites ===');
console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
console.log(`  Sites: ${sites.length}`);

if (dryRun) {
  for (const s of sites) {
    console.log(`  ${s.name} — ${s.location} (${s.model_type}, indigenous_led=${s.indigenous_led})`);
  }
  console.log('\n  (DRY RUN — use --apply to write)');
  process.exit(0);
}

const { data, error } = await supabase
  .from('justice_reinvestment_sites')
  .upsert(sites, { onConflict: 'name' })
  .select('id, name');

if (error) {
  console.error('Error:', error.message);
  // Try inserting one by one to find the problem
  let ok = 0, fail = 0;
  for (const s of sites) {
    const { error: e } = await supabase
      .from('justice_reinvestment_sites')
      .insert(s);
    if (e) {
      console.error(`  FAIL: ${s.name} — ${e.message}`);
      fail++;
    } else {
      console.log(`  OK: ${s.name}`);
      ok++;
    }
  }
  console.log(`\n  ${ok} inserted, ${fail} failed`);
} else {
  console.log(`\n  ${data.length} sites upserted`);
}
