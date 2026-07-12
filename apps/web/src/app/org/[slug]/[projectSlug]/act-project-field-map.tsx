import Link from 'next/link';
import type {
  MatchedGrant,
  OrgContactWithEntity,
  OrgPipelineItemWithEntity,
  OrgProfile,
  OrgProject,
  OrgProjectFoundationPortfolioRow,
  OrgProjectSummary,
} from '@/lib/services/org-dashboard-service';
import {
  getMatchedGrantOpportunities,
  getOrgContacts,
  getOrgFoundationPortfolio,
  getOrgPipeline,
  getOrgProfileBySlug,
  getOrgProjectBySlug,
  getOrgProjectSummaries,
} from '@/lib/services/org-dashboard-service';
import { goodsCoreWorkAreas } from '@/lib/services/goods-operating-system';
import { getWikiSupportProject } from '@/lib/services/wiki-support-index';
import type { WikiSupportAction, WikiSupportProject, WikiSupportRouteType } from '@/lib/services/wiki-support-index';

type FieldTone = 'green' | 'blue' | 'amber' | 'red' | 'purple';

interface FieldNeed {
  id: string;
  title: string;
  detail: string;
  owner: string;
  timing: string;
  href: string;
  tone: FieldTone;
  priority: number;
}

function compact(value: string | null | undefined, fallback = 'No detail recorded.'): string {
  const text = value?.trim() || fallback;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function money(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

function initials(value: string): string {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'ACT';
}

function shortProjectName(project: OrgProject | OrgProjectSummary): string {
  const value = `${project.slug} ${project.name}`.toLowerCase();
  if (/goods/.test(value)) return 'Goods';
  if (/justice/.test(value)) return 'JusticeHub';
  if (/harvest|witta/.test(value)) return 'Harvest';
  if (/empathy/.test(value)) return 'Empathy Ledger';
  if (/civicgraph|civic graph/.test(value)) return 'CivicGraph';
  if (/palm island|picc/.test(value)) return 'Palm Island';
  if (/australian living map|\balma\b/.test(value)) return 'ALMA';
  return project.name;
}

function projectColour(project: OrgProject | OrgProjectSummary): string {
  const value = `${project.slug} ${project.name}`.toLowerCase();
  if (/goods/.test(value)) return '#c99a2e';
  if (/justice/.test(value)) return '#6b78b8';
  if (/harvest|witta/.test(value)) return '#4f8b63';
  if (/empathy/.test(value)) return '#a06b8b';
  if (/civicgraph|civic graph/.test(value)) return '#44899b';
  return '#758178';
}

function routeHref(slug: string, projectSlug: string, routeType: WikiSupportRouteType): string {
  if (routeType === 'grant') return `/grants?type=open_opportunity&sort=closing_asc&project=${encodeURIComponent(projectSlug)}&quality=ready`;
  if (routeType === 'foundation') return `/org/${slug}?view=relationships#relationships`;
  if (routeType === 'procurement') return projectSlug === 'goods' ? `/org/${slug}/goods/buyers` : '/procurement';
  if (routeType === 'evidence') return `#field-proof`;
  return `/org/${slug}?view=pipeline#pipeline`;
}

function routeTone(type: WikiSupportRouteType): FieldTone {
  if (type === 'grant') return 'blue';
  if (type === 'foundation') return 'green';
  if (type === 'procurement') return 'amber';
  if (type === 'capital') return 'purple';
  return 'green';
}

function toneClass(tone: FieldTone): string {
  if (tone === 'red') return 'border-red-200 bg-red-50 text-red-700';
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (tone === 'purple') return 'border-purple-200 bg-purple-50 text-purple-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function activePipeline(items: OrgPipelineItemWithEntity[]): OrgPipelineItemWithEntity[] {
  const closed = new Set(['won', 'lost', 'declined', 'archived', 'passed', 'no-go']);
  return items.filter((item) => !closed.has(item.status.toLowerCase()));
}

function projectContacts(
  contacts: OrgContactWithEntity[],
  project: OrgProject,
  wikiProject: WikiSupportProject | null,
): OrgContactWithEntity[] {
  const terms = [
    project.slug,
    project.code,
    project.name,
    ...(wikiProject?.aliases ?? []),
  ]
    .filter((value): value is string => Boolean(value && value.length >= 3))
    .map((value) => value.toLowerCase());

  return contacts
    .filter((contact) => {
      const haystack = [contact.name, contact.organisation, contact.role, contact.notes, ...contact.unified_tags].filter(Boolean).join(' ').toLowerCase();
      return terms.some((term) => haystack.includes(term));
    })
    .sort((left, right) => {
      const leftDate = left.last_contacted_at || left.ghl_last_contact_date || '';
      const rightDate = right.last_contacted_at || right.ghl_last_contact_date || '';
      return rightDate.localeCompare(leftDate) || left.name.localeCompare(right.name);
    })
    .slice(0, 6);
}

function grantMatchesProject(grant: MatchedGrant, project: OrgProject, wikiProject: WikiSupportProject | null): boolean {
  const terms = [
    shortProjectName(project),
    ...(wikiProject?.themes ?? []),
    ...(wikiProject?.search_terms ?? []).slice(0, 8),
  ]
    .filter((value) => value.length >= 4)
    .map((value) => value.toLowerCase());
  const haystack = [grant.name, grant.description, ...(grant.categories ?? []), ...(grant.focus_areas ?? [])].filter(Boolean).join(' ').toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function buildNeeds(
  slug: string,
  projectSlug: string,
  pipeline: OrgPipelineItemWithEntity[],
  actions: WikiSupportAction[],
  readinessGaps: string[],
  goodsNeeds: FieldNeed[],
): FieldNeed[] {
  const pipelineNeeds = activePipeline(pipeline).map((item): FieldNeed => {
    const missingPlan = !item.owner_name || !item.next_action || !item.next_action_at;
    return {
      id: `pipeline-${item.id}`,
      title: item.name,
      detail: item.next_action || item.notes || 'Confirm the next useful move, owner, and date.',
      owner: item.owner_name || 'Owner needed',
      timing: item.next_action_at || item.deadline || 'Date needed',
      href: `/org/${slug}?view=pipeline#pipeline`,
      tone: missingPlan ? 'red' : 'green',
      priority: missingPlan ? 5 : 25,
    };
  });
  const actionNeeds = actions.map((action): FieldNeed => ({
    id: `action-${action.id}`,
    title: action.title,
    detail: action.next_step || action.summary,
    owner: action.route_type,
    timing: action.priority,
    href: action.grant_finder_href || routeHref(slug, projectSlug, action.route_type),
    tone: routeTone(action.route_type),
    priority: action.priority === 'high' ? 10 : action.priority === 'medium' ? 30 : 45,
  }));
  const gapNeeds = readinessGaps.map((gap, index): FieldNeed => ({
    id: `gap-${index}`,
    title: 'Close a readiness gap',
    detail: gap,
    owner: 'proof',
    timing: 'before ask',
    href: '#field-proof',
    tone: 'amber',
    priority: 20 + index,
  }));

  return [...goodsNeeds, ...pipelineNeeds, ...actionNeeds, ...gapNeeds]
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title))
    .filter((item, index, rows) => rows.findIndex((candidate) => candidate.title.toLowerCase() === item.title.toLowerCase()) === index)
    .slice(0, 6);
}

function flattenProjects(projects: OrgProjectSummary[]): OrgProjectSummary[] {
  return projects.flatMap((project) => [project, ...flattenProjects(project.children)]);
}

export async function ActProjectFieldMapScreen({
  profile,
  project,
  slug,
  projectSlug,
}: {
  profile: OrgProfile;
  project: OrgProject;
  slug: string;
  projectSlug: string;
}) {
  const dataProfile = await getOrgProfileBySlug(slug);
  const liveProject = dataProfile ? await getOrgProjectBySlug(dataProfile.id, projectSlug) : null;
  const fieldProject = liveProject ?? project;
  const wikiProject = getWikiSupportProject(projectSlug);
  const [projectSummaries, allPipeline, foundationPortfolio, contacts, matchedGrants] = dataProfile
    ? await Promise.all([
      getOrgProjectSummaries(dataProfile.id),
      getOrgPipeline(dataProfile.id),
      getOrgFoundationPortfolio(dataProfile.id),
      getOrgContacts(dataProfile.id, undefined, { includeGhl: true, ghlLimit: 100 }),
      getMatchedGrantOpportunities(dataProfile.id, dataProfile.org_type, null),
    ])
    : [[], [], [], [], []];

  const pipelineTerms = [fieldProject.slug, fieldProject.name, fieldProject.code, ...(wikiProject?.aliases ?? [])]
    .filter((value): value is string => Boolean(value && value.length >= 3))
    .map((value) => value.toLowerCase());
  const projectPipeline = allPipeline.filter((item) => {
    if (liveProject && item.project_id === liveProject.id) return true;
    if (item.project_id) return false;
    const haystack = `${item.name} ${item.funder ?? ''} ${item.grant_name ?? ''} ${item.grant_provider ?? ''} ${item.notes ?? ''} ${item.project_code ?? ''}`.toLowerCase();
    return pipelineTerms.some((term) => haystack.includes(term));
  });
  const projectRelationships = foundationPortfolio.filter((row) => {
    return row.project.slug === projectSlug || (liveProject ? row.project.id === liveProject.id : false);
  });
  const isGoods = /goods/.test(`${fieldProject.slug} ${fieldProject.name}`.toLowerCase());
  const goodsNeeds = isGoods
    ? goodsCoreWorkAreas.slice(0, 4).map((row, index) => ({
      id: `goods-${index}`,
      title: row.area,
      detail: row.next,
      owner: row.status.includes('blocking') ? 'blocking' : 'goods',
      timing: row.proof,
      href: `/org/${slug}/wiki/goods-operating-system#strategy`,
      tone: row.status.includes('blocking') ? 'red' as const : 'amber' as const,
      priority: row.status.includes('blocking') ? index : 20 + index,
    }))
    : [];

  return (
    <ActProjectFieldMap
      profile={profile}
      project={fieldProject}
      slug={slug}
      projectSlug={projectSlug}
      allProjects={flattenProjects(projectSummaries)}
      pipeline={projectPipeline}
      relationships={projectRelationships}
      contacts={contacts}
      matchedGrants={matchedGrants}
      wikiProject={wikiProject}
      goodsNeeds={goodsNeeds}
    />
  );
}

export function ActProjectFieldMap({
  profile,
  project,
  slug,
  projectSlug,
  allProjects,
  pipeline,
  relationships,
  contacts,
  matchedGrants,
  wikiProject,
  goodsNeeds = [],
}: {
  profile: OrgProfile;
  project: OrgProject;
  slug: string;
  projectSlug: string;
  allProjects: OrgProjectSummary[];
  pipeline: OrgPipelineItemWithEntity[];
  relationships: OrgProjectFoundationPortfolioRow[];
  contacts: OrgContactWithEntity[];
  matchedGrants: MatchedGrant[];
  wikiProject: WikiSupportProject | null;
  goodsNeeds?: FieldNeed[];
}) {
  const projectName = shortProjectName(project);
  const activeItems = activePipeline(pipeline);
  const people = projectContacts(contacts, project, wikiProject);
  const grants = matchedGrants.filter((grant) => grantMatchesProject(grant, project, wikiProject)).slice(0, 4);
  const routes = wikiProject?.routes ?? [];
  const actions = wikiProject?.support_actions ?? [];
  const needs = buildNeeds(slug, projectSlug, activeItems, actions, wikiProject?.readiness_gaps ?? [], goodsNeeds);
  const pipelineValue = activeItems.reduce((sum, item) => sum + Number(item.amount_numeric || 0), 0);
  const sourceCount = wikiProject?.source_documents.length ?? 0;
  const projectTabs = [...allProjects]
    .sort((left, right) => {
      const preferred = ['goods', 'justicehub', 'harvest', 'empathy-ledger', 'civicgraph'];
      const leftRank = preferred.findIndex((key) => left.slug.includes(key));
      const rightRank = preferred.findIndex((key) => right.slug.includes(key));
      return (leftRank < 0 ? 20 : leftRank) - (rightRank < 0 ? 20 : rightRank) || left.sort_order - right.sort_order;
    })
    .slice(0, 6);

  return (
    <main className="ws act-desk min-h-screen bg-[var(--ws-surface-0)] text-[var(--ws-text)]">
      <header className="border-b border-[var(--ws-border)] bg-[var(--ws-surface-1)]">
        <div className="mx-auto flex min-h-[74px] max-w-[1440px] items-center gap-5 overflow-x-auto px-4 sm:px-6">
          <Link href={`/org/${slug}`} className="flex shrink-0 items-center gap-3 pr-3">
            <span className="grid h-8 w-8 place-items-center rounded bg-[#e7ef65] text-sm font-black text-[#183426]">A</span>
            <span className="hidden font-mono text-[11px] font-semibold uppercase sm:block">{profile.name}</span>
          </Link>
          <nav className="flex min-h-[74px] items-stretch" aria-label="ACT project fields">
            {projectTabs.map((tab) => {
              const active = tab.slug === projectSlug;
              return (
                <Link
                  key={tab.id}
                  href={`/org/${slug}/${tab.slug}`}
                  className={`flex min-w-[112px] items-center gap-2 border-b-2 px-3 text-xs ${active ? 'border-b-[#4f8b63] bg-[#f4f6f1] font-semibold' : 'border-b-transparent text-[var(--ws-text-secondary)] hover:text-[var(--ws-text)]'}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: projectColour(tab) }} />
                  <span className="truncate">{shortProjectName(tab)}</span>
                </Link>
              );
            })}
          </nav>
          <Link href={`/org/${slug}/${projectSlug}?full=1`} className="ml-auto hidden min-h-10 shrink-0 items-center rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold lg:inline-flex">
            Deep evidence
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-74px)] max-w-[1440px] lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="bg-[#203c2d] px-6 py-5 text-white lg:py-7">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9fb0a4]">{project.code || 'ACT'} / project field</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal">{projectName}</h1>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#cad5cd] lg:line-clamp-none">{compact(wikiProject?.summary || project.description, 'An active ACT field linking relationships, resources, action, and learning.')}</p>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-white/15 py-4 lg:mt-7 lg:gap-y-5 lg:py-5">
            <FieldSideMetric value={`${activeItems.length}`} label="Active threads" />
            <FieldSideMetric value={`${people.length}`} label="Warm people" />
            <FieldSideMetric value={money(pipelineValue)} label="In motion" />
            <FieldSideMetric value={`${routes.length}`} label="Open routes" />
          </div>

          <nav className="mt-7 hidden lg:block" aria-label={`${projectName} field sections`}>
            <FieldSideLink href="#field-needs" label="What needs moving" value={needs.length} active />
            <FieldSideLink href="#field-people" label="People around the field" value={people.length} />
            <FieldSideLink href="#field-openings" label="Funding and procurement" value={routes.length + grants.length} />
            <FieldSideLink href="#field-people" label="Gatherings and invitations" value={people.filter((person) => /event|gather|art|festival/i.test(person.unified_tags.join(' '))).length} />
            <FieldSideLink href="#field-proof" label="Proof and stories" value={sourceCount} />
            <FieldSideLink href={`/org/${slug}?view=money#money`} label="Money and commitments" value={activeItems.length} />
          </nav>
        </aside>

        <div className="min-w-0 px-4 py-7 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">The field today</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">What helps {projectName} move next</h2>
              <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">One project view linking money, people, invitations, proof, and opportunities.</p>
            </div>
            <Link href={`/org/${slug}`} className="inline-flex min-h-10 w-fit items-center rounded-md border border-[var(--ws-border)] bg-white px-3 text-xs font-semibold">Back to Today</Link>
          </div>

          <section className="mt-6 grid grid-cols-2 border border-[var(--ws-border)] bg-[#f8faf6] xl:grid-cols-4">
            <FieldMetric label="Funding fit" value={`${grants.length} current`} detail={`${actions.filter((action) => action.route_type === 'grant').length} project scans ready`} />
            <FieldMetric label="Relationship energy" value={relationships.length > 0 ? 'Active' : people.length > 0 ? 'Opening' : 'Thin'} detail={`${relationships.length} funder paths, ${people.length} people`} />
            <FieldMetric label="Money in motion" value={money(pipelineValue)} detail={`${activeItems.length} active commitments`} risk={pipelineValue > 0 && activeItems.some((item) => !item.owner_name || !item.next_action)} />
            <FieldMetric label="Proof readiness" value={`${sourceCount} sources`} detail={`${wikiProject?.readiness_gaps.length ?? 0} known gaps`} />
          </section>

          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1.1fr_.9fr]">
            <section id="field-needs" className="min-w-0 scroll-mt-24 border-t-[3px] border-t-[#2f6b4a] bg-white shadow-[0_10px_35px_rgba(23,35,27,.06)]">
              <FieldPanelHeader eyebrow="Priority sequence" title="What the field needs next" count={`${needs.length} open`} />
              <div className="divide-y divide-[var(--ws-border)]">
                {needs.map((need, index) => <FieldNeedRow key={need.id} need={need} index={index} />)}
                {needs.length === 0 ? <p className="px-5 py-6 text-sm text-[var(--ws-text-secondary)]">No open needs are loaded for this field.</p> : null}
              </div>
            </section>

            <section id="field-openings" className="min-w-0 scroll-mt-24 border-t-[3px] border-t-[#c99a2e] bg-white shadow-[0_10px_35px_rgba(23,35,27,.06)]">
              <FieldPanelHeader eyebrow="Signals worth following" title={`Openings around ${projectName}`} count="Ranked" />
              <div className="divide-y divide-[var(--ws-border)]">
                {routes.slice(0, 3).map((route) => (
                  <Link key={`${route.type}-${route.label}`} href={routeHref(slug, projectSlug, route.type)} className="block px-5 py-4 hover:bg-[var(--ws-surface-2)]">
                    <span className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${toneClass(routeTone(route.type))}`}>{route.type}</span>
                    <h3 className="mt-3 text-sm font-semibold">{route.label}</h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{compact(route.why)}</p>
                  </Link>
                ))}
                {grants.slice(0, Math.max(0, 3 - routes.length)).map((grant) => (
                  <Link key={grant.id} href={grant.url || `/grants/${grant.id}`} className="block px-5 py-4 hover:bg-[var(--ws-surface-2)]">
                    <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[8px] font-semibold uppercase text-blue-700">Grant / {grant.fit_score ?? 'fit'}</span>
                    <h3 className="mt-3 text-sm font-semibold">{grant.name}</h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--ws-text-secondary)]">{compact(grant.description)}</p>
                  </Link>
                ))}
              </div>
              <div className="mx-5 my-5 border-l-[3px] border-l-[#c99a2e] bg-[#f2f4ed] p-4">
                <div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">Invite into the field</div>
                <p className="mt-2 text-sm font-semibold">{people.length > 0 ? `${people.length} people can connect resources, story, and participation.` : 'No project-tagged people are connected yet.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {people.slice(0, 5).map((person, index) => (
                    <Link key={person.id} href={`/org/${slug}?view=relationships#relationships`} title={person.name} className="grid h-9 w-9 place-items-center rounded-full font-mono text-[9px] font-semibold text-white" style={{ backgroundColor: ['#c99a2e', '#4f8b63', '#6b78b8', '#a06b8b', '#44899b'][index % 5] }}>
                      {initials(person.name)}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section id="field-people" className="scroll-mt-24 border border-[var(--ws-border)] bg-white">
              <FieldPanelHeader eyebrow="Relationships" title="People around the field" count={`${people.length} shown`} />
              <div className="divide-y divide-[var(--ws-border)]">
                {people.map((person, index) => <FieldPersonRow key={person.id} person={person} index={index} slug={slug} />)}
                {people.length === 0 ? <p className="px-5 py-6 text-sm text-[var(--ws-text-secondary)]">Tag a useful relationship to this project in HighLevel or ACT contacts.</p> : null}
              </div>
            </section>

            <section id="field-proof" className="scroll-mt-24 border border-[var(--ws-border)] bg-white">
              <FieldPanelHeader eyebrow="Reusable evidence" title="Proof and source trail" count={`${sourceCount} sources`} />
              <div className="divide-y divide-[var(--ws-border)]">
                {(wikiProject?.evidence ?? []).slice(0, 4).map((item) => (
                  <div key={item.label} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-semibold">{item.label}</h3>
                      <span className="shrink-0 font-mono text-[9px] uppercase text-[var(--ws-text-secondary)]">{item.value}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(item.detail)}</p>
                  </div>
                ))}
                {(wikiProject?.evidence.length ?? 0) === 0 ? <p className="px-5 py-6 text-sm text-[var(--ws-text-secondary)]">No structured project evidence is loaded yet.</p> : null}
              </div>
              <div className="border-t border-[var(--ws-border)] px-5 py-4">
                <Link href={`/org/${slug}/${projectSlug}?full=1`} className="text-xs font-semibold text-[#2f6b4a] hover:underline">Open the complete evidence record</Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function FieldSideMetric({ value, label }: { value: string; label: string }) {
  return <div><div className="text-2xl font-semibold">{value}</div><div className="mt-1 font-mono text-[8px] uppercase text-[#9fb0a4]">{label}</div></div>;
}

function FieldSideLink({ href, label, value, active = false }: { href: string; label: string; value: number; active?: boolean }) {
  return <Link href={href} className={`flex min-h-12 items-center justify-between gap-3 border-b border-white/10 text-xs ${active ? 'font-semibold text-[#e7ef65]' : 'text-[#dbe3dd] hover:text-white'}`}><span>{label}</span><span className="font-mono text-[10px]">{value}</span></Link>;
}

function FieldMetric({ label, value, detail, risk = false }: { label: string; value: string; detail: string; risk?: boolean }) {
  return <div className="min-w-0 border-b border-r border-[var(--ws-border)] px-4 py-4 even:border-r-0 xl:border-b-0 xl:border-r xl:px-5 xl:py-5 xl:even:border-r xl:last:border-r-0"><div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">{label}</div><div className={`mt-3 truncate text-xl font-semibold xl:text-2xl ${risk ? 'text-[#a44235]' : ''}`}>{value}</div><div className="mt-1 hidden truncate text-[11px] text-[var(--ws-text-secondary)] sm:block">{detail}</div></div>;
}

function FieldPanelHeader({ eyebrow, title, count }: { eyebrow: string; title: string; count: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[var(--ws-border)] px-5 py-4"><div><div className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[var(--ws-text-secondary)]">{eyebrow}</div><h2 className="mt-1 text-lg font-semibold">{title}</h2></div><span className="shrink-0 rounded bg-[#e7f1ea] px-2 py-1 font-mono text-[8px] font-semibold uppercase text-[#2f6b4a]">{count}</span></div>;
}

function FieldNeedRow({ need, index }: { need: FieldNeed; index: number }) {
  return <Link href={need.href} className="grid min-h-[108px] gap-3 px-5 py-4 hover:bg-[var(--ws-surface-2)] sm:grid-cols-[34px_minmax(0,1fr)_92px]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#e7f1ea] font-mono text-[9px] font-semibold text-[#2f6b4a]">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0"><span className="block text-sm font-semibold">{need.title}</span><span className="mt-2 block text-xs leading-relaxed text-[var(--ws-text-secondary)]">{compact(need.detail)}</span></span><span className="text-left sm:text-right"><span className={`rounded border px-2 py-1 font-mono text-[8px] font-semibold uppercase ${toneClass(need.tone)}`}>{need.owner}</span><span className="mt-2 block font-mono text-[8px] uppercase text-[var(--ws-text-secondary)]">{need.timing}</span></span></Link>;
}

function FieldPersonRow({ person, index, slug }: { person: OrgContactWithEntity; index: number; slug: string }) {
  const colour = ['#c99a2e', '#4f8b63', '#6b78b8', '#a06b8b', '#44899b', '#65766b'][index % 6];
  return <Link href={`/org/${slug}?view=relationships#relationships`} className="flex min-h-[74px] items-center gap-3 px-5 py-3 hover:bg-[var(--ws-surface-2)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[9px] font-semibold text-white" style={{ backgroundColor: colour }}>{initials(person.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{person.name}</span><span className="mt-1 block truncate text-[10px] text-[var(--ws-text-secondary)]">{person.organisation || person.linked_entity_name || person.role || 'ACT relationship'}</span></span><span className="shrink-0 font-mono text-[8px] uppercase text-[#2f6b4a]">{person.ghl_engagement_status || person.contact_type}</span></Link>;
}
