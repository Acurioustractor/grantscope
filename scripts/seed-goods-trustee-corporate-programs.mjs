#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PROGRAMS = [
  {
    foundation_id: 'e1f8f068-fc24-4d2b-bc7c-357a371bf20e',
    name: 'IMPACT Philanthropy Application Program',
    url: 'https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/',
    description: 'Annual application that matches eligible not-for-profits with charitable trusts and endowments managed by Perpetual.',
    status: 'closed_monitor_next_round',
    deadline: '2025-12-05',
    eligibility: 'Registered Australian charity and/or DGR Item 1. Organisations may submit up to two applications.',
    application_process: 'Annual online application through Grant Toolbox, normally open October to December.',
    program_type: 'philanthropic_grant',
    thematic_focus: ['community', 'health', 'environment', 'social-enterprise'],
    place_focus: ['AU-National'],
    source_urls: [
      'https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/',
      'https://www.perpetual.com.au/4a76cb/globalassets/_au-site-media/01-documents/03-wealth-management/impact/2026/2026-ipap-guidelines.pdf',
    ],
    application_mode: 'annual_application',
    metadata: { goods_focus: true, evidence_status: 'official_verified', doorway: 'trustee_application', round_year: 2026 },
  },
  {
    foundation_id: 'a4bdfdd2-1cca-4c4f-b5ed-3d3aead21513',
    name: 'Community Grants Program',
    url: 'https://www.eqt.com.au/our-services/community/grant-funding/community-grants',
    description: 'One application considered across multiple aligned trusts for locally led initiatives, community networks, self-determination and social justice.',
    status: 'closed_monitor_next_round',
    eligibility: 'For-purpose organisations; live round guidelines determine trust-specific eligibility and geography.',
    application_process: 'Annual application through Equity Trustees grant systems.',
    program_type: 'philanthropic_grant',
    thematic_focus: ['community', 'indigenous', 'social-enterprise', 'climate'],
    place_focus: ['AU-National'],
    source_urls: [
      'https://www.eqt.com.au/our-services/community/grant-funding/community-grants',
      'https://equitytrustees.smartygrants.com.au/',
    ],
    application_mode: 'annual_application',
    metadata: { goods_focus: true, evidence_status: 'official_verified', doorway: 'trustee_application' },
  },
  {
    foundation_id: '386109c6-5cb5-405e-b489-96c698b4cba2',
    name: 'Australian Ethical Foundation Catalytic Partnerships',
    url: 'https://www.australianethical.com.au/foundation/',
    description: 'Catalytic philanthropy supporting early-stage nature, climate resilience and justice initiatives, including Indigenous-led approaches and innovative models.',
    status: 'relationship_research',
    eligibility: 'No public application round verified. Requires relationship development and confirmation of charitable eligibility.',
    application_process: 'Relationship-led partnership research; monitor official foundation updates.',
    program_type: 'relationship_funding',
    thematic_focus: ['environment', 'indigenous', 'community', 'climate'],
    place_focus: ['AU-National'],
    source_urls: ['https://www.australianethical.com.au/foundation/'],
    application_mode: 'relationship_led',
    metadata: { goods_focus: true, evidence_status: 'official_verified', doorway: 'relationship_research' },
  },
];

async function main() {
  const scrapedAt = new Date().toISOString();
  const payload = PROGRAMS.map(program => ({ ...program, scraped_at: scrapedAt }));
  const { data, error } = await supabase
    .from('foundation_programs')
    .upsert(payload, { onConflict: 'foundation_id,name' })
    .select('foundation_id,name,status,url');
  if (error) throw new Error(error.message);
  console.log(JSON.stringify({ upserted: data.length, programs: data }, null, 2));
}

main().catch(error => {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
});
