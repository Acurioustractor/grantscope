import type { OrgProfile, OrgProject } from '@/lib/services/org-dashboard-service';
import type { WikiSupportProject } from '@/lib/services/wiki-support-index';

export const ACT_FAST_PROFILE: OrgProfile = {
  id: 'act-fast-local',
  name: 'A Curious Tractor',
  abn: '697347676',
  slug: 'act',
  linked_gs_entity_id: null,
  description: 'A Curious Tractor operating workspace.',
  team_size: null,
  annual_revenue: null,
  org_type: 'social_enterprise_ecosystem',
  subscription_plan: 'enterprise',
  logo_url: null,
  updated_at: null,
};

export function isActSlug(slug: string) {
  return ['act', 'a-curious-tractor', 'curious-tractor'].includes(slug.toLowerCase());
}

export function shouldUseFastLocalOrg(fullParam?: string) {
  return process.env.NODE_ENV !== 'production' && fullParam !== '1';
}

export function fastProjectFromWiki(projectSlug: string, project?: WikiSupportProject | null): OrgProject {
  return {
    id: `fast-${projectSlug}`,
    org_profile_id: ACT_FAST_PROFILE.id,
    parent_project_id: null,
    name: project?.name ?? projectSlug.replace(/-/g, ' '),
    slug: project?.slug ?? projectSlug,
    code: project?.code ?? null,
    description: project?.summary ?? null,
    tier: 'major',
    category: null,
    status: 'active',
    sort_order: 0,
    abn: null,
    linked_gs_entity_id: null,
    logo_url: null,
    metadata: {
      support_keywords: project?.search_terms ?? [],
      funding_tags: project?.themes ?? [],
    },
    updated_at: null,
  };
}
