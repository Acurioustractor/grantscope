#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

const PROJECT_METADATA = {
  contained: {
    creative: true,
    profile_summary:
      'Contained is ACT’s touring documentary and experiential advocacy project about incarceration, community-led alternatives, and youth justice reform. It turns JusticeHub evidence into a felt public campaign through narrative, installation, documentary, and storytelling.',
    funding_brief:
      'Prioritise arts, documentary, cultural storytelling, justice reform, and public narrative foundations that fund exhibitions, creative campaigns, and community-led alternatives to detention.',
    funding_tags: [
      'arts',
      'culture',
      'documentary',
      'film',
      'narrative',
      'storytelling',
      'justice',
      'alternatives',
    ],
    proof_points: [
      'touring installation format',
      'justicehub evidence layer',
      'public campaign',
      'storytelling and documentary',
    ],
    preferred_foundation_types: [
      'arts_culture',
      'philanthropic_foundation',
      'corporate_foundation',
      'community_foundation',
      'grantmaker',
      'trust',
    ],
    blocked_foundation_types: [
      'university',
      'research_body',
      'hospital',
      'primary_health_network',
      'service_delivery',
      'legal_aid',
    ],
    blocked_foundation_names: [
      'Caritas Australia Limited',
      'Room to Read Australia Limited',
    ],
    blocked_grant_provider_terms: [
      'university',
    ],
    source_paths: [
      '/Users/benknight/Code/act-global-infrastructure/wiki/projects/contained.md',
    ],
  },
  'empathy-ledger': {
    pillar: 'technology',
    profile_summary:
      'Empathy Ledger is ACT’s sovereign storytelling and narrative infrastructure platform. It helps Indigenous and marginalised communities retain ownership, consent, attribution, and governance over stories while using those narratives to strengthen funding, policy, and community accountability.',
    funding_brief:
      'Prioritise funders aligned to narrative sovereignty, Indigenous data and story sovereignty, consent infrastructure, community-controlled media, cultural governance, ethical AI, and community-owned impact measurement.',
    funding_tags: [
      'narrative sovereignty',
      'story sovereignty',
      'data sovereignty',
      'indigenous',
      'community ownership',
      'consent',
      'cultural governance',
      'storytelling',
      'media',
      'ethical ai',
      'impact measurement',
      'accountability',
    ],
    proof_points: [
      'storyteller consent infrastructure',
      'community ownership of narratives',
      'indigenous data and story sovereignty',
      'policy and funding evidence',
    ],
    preferred_foundation_types: [
      'philanthropic_foundation',
      'corporate_foundation',
      'community_foundation',
      'grantmaker',
      'trust',
    ],
    blocked_foundation_types: [
      'university',
      'hospital',
      'primary_health_network',
    ],
    blocked_foundation_names: [
      'Rio Tinto Foundation',
    ],
    blocked_grant_provider_terms: [
      'university',
    ],
    blocked_grant_names: [
      'Community Heritage Grants',
      '2026 Creative Nations',
      'Justice Fellowships 2026',
      'Elders Mystery School',
    ],
    required_grant_terms: [
      'story',
      'narrative',
      'sovereignty',
      'data',
      'consent',
      'media',
      'accountability',
      'attribution',
    ],
    required_grant_min_hits: 2,
    source_paths: [
      '/Users/benknight/Code/act-global-infrastructure/wiki/projects/empathy-ledger.md',
    ],
  },
  goods: {
    pillar: 'enterprise',
    profile_summary:
      'Goods on Country is ACT’s circular economy social enterprise designing and manufacturing durable household goods from recycled plastic for remote and marginalised communities. It combines Indigenous partnership, on-Country co-design, manufacturing, employment, procurement, and housing resilience.',
    funding_brief:
      'Prioritise funders interested in Indigenous partnership, circular economy, remote community infrastructure, manufacturing, housing resilience, durable goods, employment pathways, and social enterprise scale.',
    funding_tags: [
      'circular economy',
      'indigenous partnership',
      'remote communities',
      'manufacturing',
      'durable goods',
      'housing',
      'community infrastructure',
      'procurement',
      'employment',
      'plastic waste',
      'social enterprise',
    ],
    proof_points: [
      'remote community manufacturing',
      'indigenous partnership and co-design',
      'durable goods and housing resilience',
      'circular economy and employment',
    ],
    preferred_foundation_types: [
      'philanthropic_foundation',
      'corporate_foundation',
      'community_foundation',
      'grantmaker',
      'trust',
    ],
    blocked_foundation_types: [
      'university',
      'research_body',
      'legal_aid',
    ],
    blocked_grant_provider_terms: [
      'university',
    ],
    blocked_grant_names: [
      'Justice Fellowships 2026',
      '2024-2026 LDM Implementation Funding - Stream 2',
      'Community Heritage Grants',
    ],
    required_grant_terms: [
      'remote',
      'manufacturing',
      'employment',
      'housing',
      'procurement',
      'circular',
      'infrastructure',
      'country',
      'enterprise',
      'durable',
    ],
    required_grant_min_hits: 3,
    source_paths: [
      '/Users/benknight/Code/act-global-infrastructure/wiki/projects/goods-on-country.md',
    ],
  },
  justicehub: {
    pillar: 'justice',
    strategic_priority: 'high',
    profile_summary:
      'JusticeHub is ACT’s evidence platform for youth justice alternatives. It maps community-led programs, outcomes, and spending to help divert capital from detention to healing, while supporting policymakers, communities, and partners with evidence, lived-experience proof, and justice reform infrastructure.',
    funding_brief:
      'Prioritise funders aligned to youth justice reform, diversion, community-led alternatives, First Nations justice, lived-experience advocacy, systems change, and evidence-backed policy change.',
    funding_tags: [
      'youth justice',
      'justice reform',
      'diversion',
      'community-led alternatives',
      'first nations',
      'lived experience',
      'systems change',
      'policy',
      'evidence',
      'detention alternatives',
    ],
    proof_points: [
      'youth justice evidence platform',
      'community-led alternatives to detention',
      'first nations justice reform',
      'lived-experience proof and policy influence',
    ],
    preferred_foundation_types: [
      'philanthropic_foundation',
      'community_foundation',
      'grantmaker',
      'trust',
    ],
    blocked_foundation_types: [
      'hospital',
      'primary_health_network',
      'service_delivery',
    ],
    blocked_grant_provider_terms: [
      'university',
    ],
    blocked_grant_terms: [
      'fashion',
      'creative nations',
      'scholarship',
    ],
    blocked_grant_names: [
      "Archbishop's Prize for Emerging & Young Composers",
      '2026 Professional Development - Next Steps',
      'Starlight Super Steps',
      '​​Touring and Travel Fund - International Touring',
    ],
    required_grant_terms: [
      'justice',
      'diversion',
      'detention',
      'first nations',
      'community-led',
      'lived experience',
      'policy',
      'employment',
    ],
    required_grant_min_hits: 2,
    source_paths: [
      '/Users/benknight/Code/act-global-infrastructure/wiki/projects/justicehub/justicehub.md',
    ],
  },
};

async function main() {
  const slugs = Object.keys(PROJECT_METADATA);
  const { data: projects, error } = await db
    .from('org_projects')
    .select('id, slug, metadata')
    .in('slug', slugs);

  if (error) {
    throw error;
  }

  const updates = [];

  for (const project of projects ?? []) {
    const patch = PROJECT_METADATA[project.slug];
    if (!patch) continue;

    const nextMetadata = {
      ...(project.metadata && typeof project.metadata === 'object' ? project.metadata : {}),
      ...patch,
    };

    const { error: updateError } = await db
      .from('org_projects')
      .update({ metadata: nextMetadata })
      .eq('id', project.id);

    if (updateError) {
      throw updateError;
    }

    updates.push({
      slug: project.slug,
      funding_tags: patch.funding_tags.length,
      preferred_foundation_types: patch.preferred_foundation_types.length,
      blocked_foundation_types: patch.blocked_foundation_types.length,
    });
  }

  console.log(JSON.stringify({ updated: updates }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
