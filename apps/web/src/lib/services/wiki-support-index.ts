import wikiSupportIndex from '@/lib/generated/wiki-support-index.json';

export type WikiSupportRouteType = 'procurement' | 'foundation' | 'grant' | 'capital' | 'evidence' | 'systems';

export interface WikiSupportSource {
  label: string;
  path: string;
}

export interface WikiSupportRoute {
  type: WikiSupportRouteType;
  label: string;
  why: string;
  search_terms: string[];
  next_action: string;
  source_documents: WikiSupportSource[];
}

export interface WikiSupportAction {
  id: string;
  project_slug: string;
  project_name: string;
  project_code: string | null;
  route_type: WikiSupportRouteType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  next_step: string;
  search_terms: string[];
  grant_finder_href: string;
  source_discovery_queries: string[];
  source_documents: WikiSupportSource[];
}

export interface WikiSupportEvidence {
  label: string;
  value: string;
  detail: string;
  source: string;
}

export interface WikiSupportProject {
  slug: string;
  aliases: string[];
  name: string;
  code: string | null;
  summary: string;
  themes: string[];
  source_documents: WikiSupportSource[];
  evidence: WikiSupportEvidence[];
  routes: WikiSupportRoute[];
  support_actions: WikiSupportAction[];
  readiness_gaps: string[];
  search_terms: string[];
}

export interface WikiSupportInventoryItem {
  label: string;
  role: string;
  path: string;
  exists: boolean;
  bytes: number;
  lines: number;
  modified_at: string | null;
}

export interface WikiSupportIndex {
  generated_at: string;
  generated_by: string;
  source_roots: {
    grantscope: string;
    goods: string;
    act_global_infrastructure: string;
  };
  summary: {
    project_count: number;
    route_count: number;
    support_action_count: number;
    source_document_count: number;
    route_counts: Partial<Record<WikiSupportRouteType, number>>;
    primary_use: string;
  };
  ten_area_framework: string[];
  cross_project_terms: string[];
  source_inventory: WikiSupportInventoryItem[];
  support_actions: WikiSupportAction[];
  projects: WikiSupportProject[];
}

const INDEX = wikiSupportIndex as WikiSupportIndex;

export function getWikiSupportIndex() {
  return INDEX;
}

export function wikiSupportSourceSlug(source: Pick<WikiSupportInventoryItem, 'label' | 'role'>) {
  return `${source.label}-${source.role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getWikiSupportSourceBySlug(slug: string) {
  return INDEX.source_inventory.find((source) => wikiSupportSourceSlug(source) === slug) ?? null;
}

export function getWikiSupportProject(slug: string) {
  const normalizedSlug = slug.toLowerCase();
  return (
    INDEX.projects.find(
      (project) =>
        project.slug === normalizedSlug ||
        project.aliases.some((alias) => alias.toLowerCase() === normalizedSlug),
    ) ?? null
  );
}

export function getWikiSupportProjectsForSlugs(slugs: string[]) {
  const normalizedSlugs = new Set(slugs.map((slug) => slug.toLowerCase()));
  return INDEX.projects.filter(
    (project) =>
      normalizedSlugs.has(project.slug) ||
      project.aliases.some((alias) => normalizedSlugs.has(alias.toLowerCase())),
  );
}

export function getWikiSupportActions(projectSlug?: string) {
  if (!projectSlug) return INDEX.support_actions;
  const project = getWikiSupportProject(projectSlug);
  if (!project) return [];
  return project.support_actions;
}
