#!/usr/bin/env node
/**
 * Ingest Strategic Grants "Latest Grants Wrap" published on LinkedIn 2026-07-31.
 *
 * Source:
 * https://www.linkedin.com/pulse/latest-grants-wrap-strategic-grants-pty-ltd-pscrc/
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-strategic-grants-wrap-2026-07.mjs --dry-run
 *   node --env-file=.env scripts/ingest-strategic-grants-wrap-2026-07.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const ARTICLE_URL = 'https://www.linkedin.com/pulse/latest-grants-wrap-strategic-grants-pty-ltd-pscrc/';
const SOURCE = 'strategic-grants-wrap-2026-07';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const grants = [
  {
    name: 'Bell Bay Aluminium Community Grants',
    provider: 'Bell Bay Aluminium',
    url: 'https://bellbayaluminium.com.au/community-grants',
    description:
      'Community grants for Tasmanian organisations, groups and initiatives in social, environmental and economic focus areas including education, environment, inclusion and diversity, culture and heritage, health and wellbeing, and economic outcomes.',
    geography: 'TAS',
    deadline: '2026-09-13',
    amountMax: 3000,
    focusAreas: ['community development', 'environment', 'education', 'health and wellbeing', 'economic development'],
    categories: ['community', 'environment', 'education'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'NAB Foundation - Community Grants 2026 Round 2',
    provider: 'NAB Foundation',
    url: 'https://www.nab.com.au/about-us/sustainability/nab-foundation/community-grants',
    description:
      'Funding for local projects that help communities withstand and recover from natural disasters, including training and planning, community recovery, environment and wildlife restoration, and equipment and infrastructure.',
    geography: 'AU',
    deadline: '2026-09-14',
    amountMax: 25000,
    focusAreas: ['disaster resilience', 'community recovery', 'environment', 'equipment', 'infrastructure'],
    categories: ['community', 'disaster resilience', 'infrastructure'],
    alignedProjects: ['goods', 'harvest'],
  },
  {
    name: 'CreateSA - Collaboration',
    provider: 'CreateSA',
    url: 'https://www.create.sa.gov.au/funding-and-grants/arts-and-culture-grants-program/grants-for-individuals,-groups,-organisations/major-projects-collaboration',
    description:
      'Partnership opportunity for strategic and innovative collaborations across the arts sector, focused on risk-taking, knowledge and resource sharing, new employment opportunities, creative development, art making and presentation.',
    geography: 'SA',
    deadline: '2026-09-28',
    amountMax: 100000,
    focusAreas: ['arts', 'culture', 'collaboration', 'employment'],
    categories: ['arts and culture'],
    alignedProjects: [],
  },
  {
    name: 'The Hamer Sprout Fund Grant',
    provider: 'The Hamer Sprout Fund',
    url: 'https://www.thehamersproutfund.com/apply-for-funding',
    description:
      'Supports projects and organisations that promote innovation in environmental education, facilitate engagement in environmental action, advocate for environmental sustainability, and foster youth environmental leadership.',
    geography: 'AU',
    deadline: '2026-09-30',
    amountMax: 10000,
    focusAreas: ['environmental education', 'environmental action', 'sustainability', 'youth leadership'],
    categories: ['environment', 'education', 'youth'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'Visit Victoria: Regional Events Fund Stream 2 – Event Growth and Development',
    provider: 'Visit Victoria',
    url: 'https://corporate.visitvictoria.com/events/regional-events-fund',
    description:
      'Funding to grow the economic impact of medium to large-scale regional Victorian events, showcasing regional tourism strengths and building Victoria’s reputation as an events destination.',
    geography: 'VIC',
    deadline: '2026-09-30',
    amountMax: 500000,
    focusAreas: ['regional events', 'tourism', 'economic development'],
    categories: ['events', 'regional development'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'Mazda Foundation Australia',
    provider: 'Mazda Foundation Australia',
    url: 'https://www.mazdafoundation.org.au/obtaining-funding/',
    description:
      'Funding focused on primary producers facing hardship, community projects that strengthen and build resilience in primary producer communities, and literacy and numeracy programs for disadvantaged primary school children.',
    geography: 'AU',
    deadline: '2026-09-30',
    amountMin: 1000,
    amountMax: 400000,
    focusAreas: ['primary producers', 'community resilience', 'literacy', 'numeracy', 'children'],
    categories: ['community', 'agriculture', 'education'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'The Flora & Frank Leith Charitable Trust',
    provider: 'The Flora & Frank Leith Charitable Trust',
    url: 'https://www.leithtrust.org.au/',
    description:
      'Victorian charitable trust with emphasis on assistance to children in poverty, including accommodation, advancement in life and education, including Anglican welfare services. Applicants should have an ABN and DGR status.',
    geography: 'VIC',
    deadline: '2026-09-30',
    amountMin: 5000,
    amountMax: 290000,
    focusAreas: ['children', 'poverty', 'accommodation', 'education', 'welfare'],
    categories: ['children and families', 'housing', 'education'],
    alignedProjects: ['goods'],
    dgrRequired: true,
  },
  {
    name: 'Creative New Zealand - Creative Impact Fund',
    provider: 'Creative New Zealand',
    url: 'https://creativenz.govt.nz/funding-and-support/all-opportunities/creative-impact-fund',
    description:
      'Funding for artists and practitioners to create, share and present work that enriches audiences and communities, deepens understanding and participation in the arts, and encourages knowledge and skills sharing.',
    geography: 'NZ',
    deadline: '2026-09-17',
    amountMax: 125000,
    focusAreas: ['arts', 'creative practice', 'community participation'],
    categories: ['arts and culture'],
    alignedProjects: [],
  },
  {
    name: 'Mazda Foundation (NZ) Grants',
    provider: 'Mazda Foundation New Zealand',
    url: 'https://www.mazda.co.nz/foundation#applying-for-funding',
    description:
      'Financial aid for individuals and causes supporting the natural environment, culture and education, youth education and employment skills development, and the arts in New Zealand.',
    geography: 'NZ',
    deadline: '2026-09-30',
    amountMax: 12000,
    focusAreas: ['environment', 'culture', 'education', 'youth employment', 'arts'],
    categories: ['environment', 'education', 'arts and culture'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'NZ Ministry of Social Development Office for Seniors Age-friendly Fund',
    provider: 'New Zealand Ministry of Social Development Office for Seniors',
    url: 'https://www.officeforseniors.govt.nz/our-work/age-friendly-communities/apply-for-an-age-friendly-community-grant',
    description:
      'Funding for community-led projects that encourage older people to actively participate and contribute to their community, including age-friendly plans and initiatives.',
    geography: 'NZ',
    deadline: '2026-09-30',
    amountMin: 5000,
    amountMax: 15000,
    focusAreas: ['older people', 'community participation', 'age-friendly communities'],
    categories: ['community', 'seniors'],
    alignedProjects: [],
  },
  {
    name: 'Trust Tairāwhiti Community Funding',
    provider: 'Trust Tairāwhiti',
    url: 'https://trusttairawhiti.nz/apply-for-funding',
    description:
      'Community funding for projects and initiatives benefiting Tairāwhiti, including community wellbeing, community-led initiatives, social or cultural benefits, participation, connection, local capability and equitable access.',
    geography: 'NZ-Gisborne',
    amountMin: 10000,
    amountMax: 1500000,
    focusAreas: ['community wellbeing', 'community-led initiatives', 'local capability', 'equitable access'],
    categories: ['community', 'regional development'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'Jenkins Foundation',
    provider: 'Jenkins Foundation',
    url: 'https://www.jenkinsfoundation.org.nz/application-process/',
    description:
      'Community and economic development funding that may include environmental protection, preservation of historic places, public amenities, recreation facilities and education initiatives prioritising youth culture, life skills and environmental education.',
    geography: 'NZ',
    focusAreas: ['community development', 'economic development', 'environment', 'heritage', 'public amenities', 'youth education'],
    categories: ['community', 'environment', 'education'],
    alignedProjects: ['harvest'],
  },
  {
    name: 'Awhero Nui Trust',
    provider: 'Awhero Nui Trust',
    url: 'https://awheronui.org.nz/',
    description:
      'Funding aligned to a good life for people in New Zealand, with priority areas including primary education, homelessness, social housing, mentoring of ex-prisoners, poverty reduction, international aid, sport, environment and heritage.',
    geography: 'NZ',
    amountMin: 5000,
    amountMax: 150000,
    focusAreas: ['primary education', 'homelessness', 'social housing', 'poverty reduction', 'environment', 'heritage'],
    categories: ['housing', 'education', 'community', 'environment'],
    alignedProjects: ['goods'],
  },
  {
    name: 'June Gray Charitable Trust',
    provider: 'June Gray Charitable Trust',
    url: 'https://www.cdg.org.nz/apply/',
    description:
      'Financial subsidies and support for community-based projects across New Zealand, focused on people needing a step up, especially young people and community health, education and personal development.',
    geography: 'NZ',
    amountMin: 450,
    amountMax: 12000,
    focusAreas: ['community projects', 'young people', 'health', 'education', 'personal development'],
    categories: ['community', 'health', 'education', 'youth'],
    alignedProjects: [],
  },
];

function rowForGrant(grant) {
  const sourceId = `${SOURCE}:${grant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const deadline = grant.deadline ?? null;
  return {
    name: grant.name,
    provider: grant.provider,
    program: grant.name,
    url: grant.url,
    description: grant.description,
    amount_min: grant.amountMin ?? null,
    amount_max: grant.amountMax ?? null,
    deadline,
    closes_at: deadline,
    source: SOURCE,
    source_id: sourceId,
    geography: grant.geography,
    status: 'open',
    application_status: 'open',
    grant_type: 'open_opportunity',
    program_type: 'grant',
    categories: grant.categories,
    focus_areas: grant.focusAreas,
    aligned_projects: grant.alignedProjects,
    discovered_by: 'strategic-grants-linkedin-wrap',
    discovery_method: 'public_grants_wrap_manual_extract',
    last_verified_at: '2026-08-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
    requirements_summary: [
      grant.geography ? `Eligible region: ${grant.geography}` : null,
      deadline ? `Deadline: ${deadline}` : 'Rolling / anytime deadline noted by source',
      grant.dgrRequired ? 'DGR status indicated by source' : null,
    ].filter(Boolean).join(' · '),
    dgr_required: grant.dgrRequired ?? null,
    accepts_charity: true,
    sources: [
      {
        type: 'article',
        label: 'Strategic Grants Latest Grants Wrap',
        url: ARTICLE_URL,
        published_at: '2026-07-31',
      },
      {
        type: 'grant_page',
        label: 'More information',
        url: grant.url,
      },
    ],
    metadata: {
      imported_from: ARTICLE_URL,
      imported_by_script: 'scripts/ingest-strategic-grants-wrap-2026-07.mjs',
      source_published_at: '2026-07-31',
      source_title: 'Latest Grants Wrap',
      project_tagging_note: 'aligned_projects are conservative keyword/project-fit tags at ingest time; downstream scoring may add or remove fit.',
    },
  };
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  const rows = grants.map(rowForGrant);
  console.log(`${APPLY ? 'Applying' : 'Dry-run'} Strategic Grants July 2026 wrap ingest`);
  console.log(`Rows: ${rows.length}`);
  for (const row of rows) {
    console.log(`- ${row.name} | ${row.provider} | ${row.geography} | ${row.deadline ?? 'rolling'} | ${row.aligned_projects.join(',') || 'no project tag'}`);
  }

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write to grant_opportunities.');
    return;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('grant_opportunities')
    .select('id, name, url, source, source_id, aligned_projects')
    .in('url', rows.map((row) => row.url));

  if (existingError) throw existingError;

  const existingByUrl = new Map((existingRows || []).map((row) => [row.url, row]));
  const results = [];

  for (const row of rows) {
    const existing = existingByUrl.get(row.url);

    if (existing) {
      const mergedProjects = Array.from(new Set([...(existing.aligned_projects || []), ...(row.aligned_projects || [])]));
      const update = {
        ...row,
        source: existing.source || row.source,
        source_id: existing.source_id || row.source_id,
        aligned_projects: mergedProjects,
      };
      delete update.id;

      const { data, error } = await supabase
        .from('grant_opportunities')
        .update(update)
        .eq('id', existing.id)
        .select('id, name, source_id, aligned_projects')
        .single();

      if (error) throw error;
      results.push({ action: 'updated-existing-url', ...data });
      continue;
    }

    const { data, error } = await supabase
      .from('grant_opportunities')
      .upsert(row, { onConflict: 'name,source_id' })
      .select('id, name, source_id, aligned_projects')
      .single();

    if (error) throw error;
    results.push({ action: 'upserted-source-id', ...data });
  }

  console.log(`Processed ${results.length} grant_opportunities rows.`);
  for (const result of results) {
    console.log(`  ${result.action}: ${result.name} (${result.id})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
