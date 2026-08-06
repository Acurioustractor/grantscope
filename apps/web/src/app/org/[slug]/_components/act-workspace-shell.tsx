'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  CalendarBlank,
  Cube,
  Database,
  FileText,
  Gavel,
  Gear,
  MagnifyingGlass,
  UsersThree,
} from '@phosphor-icons/react';
import type { OrgProjectSummary } from '@/lib/services/org-dashboard-service';

const PROJECT_COLOURS = ['#c99a2e', '#6b78b8', '#4f8b63', '#a06b8b', '#44899b', '#8b6f56'];

type WorkspaceLink = {
  label: string;
  href: string;
  active: boolean;
};

function flattenProjects(projects: OrgProjectSummary[]): OrgProjectSummary[] {
  return projects.flatMap((project) => [project, ...flattenProjects(project.children)]);
}

function projectFieldRank(project: OrgProjectSummary): number {
  const value = `${project.slug} ${project.name}`.toLowerCase();
  if (/goods/.test(value)) return 0;
  if (/justice/.test(value)) return 1;
  if (/harvest|witta/.test(value)) return 2;
  if (/empathy/.test(value)) return 3;
  if (/civicgraph|civic graph/.test(value)) return 4;
  if (/palm island|picc/.test(value)) return 5;
  if (/australian living map|\balma\b/.test(value)) return 6;
  return 20;
}

function projectFieldLabel(project: OrgProjectSummary): string {
  const value = `${project.slug} ${project.name}`.toLowerCase();
  if (/australian living map|\balma\b/.test(value)) return 'ALMA';
  if (/palm island|picc/.test(value)) return 'Palm Island';
  if (/empathy/.test(value)) return 'Empathy Ledger';
  if (/civicgraph|civic graph/.test(value)) return 'CivicGraph';
  if (/justice/.test(value)) return 'JusticeHub';
  if (/harvest|witta/.test(value)) return 'Harvest';
  if (/goods/.test(value)) return 'Goods';
  return project.name;
}

function rootHref(slug: string, view?: string, hash?: string): string {
  const query = view ? `?view=${view}` : '';
  return `/org/${slug}${query}${hash ? `#${hash}` : ''}`;
}

export function ActWorkspaceShell({
  slug,
  projects,
  children,
}: {
  slug: string;
  projects: OrgProjectSummary[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') ?? 'today';
  const orgRoot = `/org/${slug}`;
  const onOrgRoot = pathname === orgRoot;
  const goodsDecisionDesk = pathname.endsWith('/goods/model');
  const justiceHubDecisionDesk = pathname.endsWith('/justicehub/model');
  const resourceDesk = pathname.endsWith('/resources');
  const matterDecisionDesk = goodsDecisionDesk || justiceHubDecisionDesk || resourceDesk;
  const projectRows = flattenProjects(projects)
    .filter((project) => project.status === 'active')
    .sort((left, right) => projectFieldRank(left) - projectFieldRank(right) || left.name.localeCompare(right.name));
  const fieldProjects = projectRows.slice(0, 7);
  const workModes: WorkspaceLink[] = [
    // The one-system front door: every workable record, one ranked queue.
    // "Today" retired 2026-08-05 — One Desk IS today (CONTEXT.md).
    { label: 'One Desk', href: `/org/${slug}/desk`, active: pathname.startsWith(`/org/${slug}/desk`) || (onOrgRoot && view === 'today') },
    // Listen folded into Orgs 2026-08-05 — the Org record + one list.
    // Legacy lens stays reachable at ?view=relationships (not on the rail).
    { label: 'Orgs', href: `/org/${slug}/orgs`, active: pathname.startsWith(`/org/${slug}/orgs`) },
    // The one cross-project noun (ADR 0002): cultivated humans, org-wide.
    { label: 'People', href: `/org/${slug}/people`, active: pathname.startsWith(`/org/${slug}/people`) },
    { label: 'Curiosity', href: rootHref(slug, 'opportunities', 'opportunities'), active: onOrgRoot && (view === 'opportunities' || view === 'triage') },
    // Rail cut to the spine (Ben, 2026-08-05): Action, Art, Money, Sources,
    // Research and Funding all left the rail. Art = the Harvest project, which
    // the project list already carries; the rest stay reachable by URL
    // (?view=pipeline, ?view=money, ?view=evidence, /research, /funding).
  ];
  const utilityLinks = [
    {
      label: 'Atlas',
      detail: 'Search everything',
      href: `/org/${slug}/explore`,
      active: pathname.startsWith(`/org/${slug}/explore`),
    },
  ];

  return (
    <div className="act-desk min-h-screen bg-[var(--ws-surface-0)] text-[var(--ws-text)]">
      <div
        className={`!mx-0 grid min-w-0 !max-w-none ${
          matterDecisionDesk
            ? 'lg:grid-cols-[72px_minmax(0,1fr)]'
            : 'lg:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[208px_minmax(0,1fr)]'
        }`}
        data-testid="act-desk-workspace"
      >
        <aside className="hidden min-h-screen bg-[#183426] text-white lg:block" data-testid="act-desk-sidebar">
          {matterDecisionDesk ? (
            <MatterDecisionRail
              slug={slug}
              project={resourceDesk ? 'resources' : justiceHubDecisionDesk ? 'justicehub' : 'goods'}
            />
          ) : (
          <div className="sticky top-0 flex h-screen flex-col overflow-hidden px-3 py-3 [@media(max-height:680px)]:py-2" data-testid="act-desk-sidebar-content">
            <Link href={rootHref(slug)} className="flex min-h-10 items-center gap-3 px-2 [@media(max-height:680px)]:min-h-9">
              <span className="grid h-7 w-7 place-items-center rounded bg-[#e7ef65] text-xs font-black text-[#183426]">A</span>
              <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wide">A Curious Tractor</span>
            </Link>

            <div className="mt-5 px-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8fa196] [@media(max-height:680px)]:mt-3">Where you work</div>
            <nav className="mt-1.5 space-y-1" aria-label="ACT work modes">
              {workModes.map((mode, index) => (
                <div key={mode.label}>
                  <WorkspaceModeLink {...mode} index={index + 1} />
                  {mode.label === 'One Desk' && pathname.startsWith(`/org/${slug}/desk`) ? (
                    <DeskRailTree slug={slug} activeKind={searchParams.get('kind')} project={searchParams.get('project')} />
                  ) : null}
                </div>
              ))}
            </nav>

            <div className="mt-5 px-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8fa196] [@media(max-height:680px)]:mt-3">Jump to a project</div>
            <nav className="mt-1" aria-label="ACT project fields">
              {fieldProjects.map((project, index) => (
                <div key={project.id}>
                  <WorkspaceProjectLink
                    project={project}
                    slug={slug}
                    index={index}
                    active={pathname.startsWith(`/org/${slug}/${project.slug}`)}
                  />
                  {project.slug === 'goods' && pathname.startsWith(`/org/${slug}/goods`) ? (
                    <GoodsRailTree slug={slug} pathname={pathname} />
                  ) : null}
                </div>
              ))}
              {fieldProjects.length === 0 ? <div className="px-2 py-3 text-xs text-[#aebcb2]">No project fields loaded.</div> : null}
            </nav>

            <div className="mt-auto border-t border-white/10 pt-2">
              {utilityLinks.map((link) => <WorkspaceUtilityLink key={link.label} {...link} />)}
            </div>
          </div>
          )}
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex min-h-12 items-center gap-2 border-b border-[var(--ws-border)] bg-[var(--ws-surface-0)]/95 px-3 backdrop-blur lg:hidden" data-testid="act-mobile-navigation">
            <Link href={rootHref(slug)} className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#183426] text-[11px] font-black text-[#e7ef65]" aria-label="ACT Today">
              A
            </Link>
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="ACT mobile work modes">
              {matterDecisionDesk ? (
                <MobileWorkspaceLink
                  href={
                    resourceDesk
                      ? `/org/${slug}/resources`
                      : `/org/${slug}/${justiceHubDecisionDesk ? 'justicehub' : 'goods'}/model`
                  }
                  label={resourceDesk ? 'Resources' : justiceHubDecisionDesk ? 'JusticeHub' : 'Goods'}
                  active
                />
              ) : null}
              <MobileWorkspaceLink href={`/org/${slug}/explore`} label="Atlas" active={pathname.startsWith(`/org/${slug}/explore`)} />
              {workModes.slice(0, 4).map((mode) => <MobileWorkspaceLink key={mode.label} {...mode} />)}
              <MobileWorkspaceLink href={rootHref(slug, 'money', 'money')} label="Money" active={onOrgRoot && view === 'money'} />
              <MobileWorkspaceLink href={rootHref(slug, 'evidence', 'systems')} label="Sources" active={onOrgRoot && view === 'evidence'} />
              <MobileWorkspaceLink href={`/org/${slug}/research`} label="Research" active={pathname.startsWith(`/org/${slug}/research`)} />
            </nav>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

function MatterDecisionRail({
  slug,
  project,
}: {
  slug: string;
  project: 'goods' | 'justicehub' | 'resources';
}) {
  const isJusticeHub = project === 'justicehub';
  const isResources = project === 'resources';
  const links = [
    { label: 'Today', href: `/org/${slug}`, icon: CalendarBlank, active: false },
    { label: 'Field', href: `/org/${slug}?view=relationships#relationships`, icon: UsersThree, active: false },
    {
      label: isResources ? 'Resources' : isJusticeHub ? 'Justice' : 'Goods',
      href: isResources ? `/org/${slug}/resources` : `/org/${slug}/${project}/model`,
      icon: isResources ? Database : isJusticeHub ? Gavel : Cube,
      active: true,
    },
    {
      label: 'Evidence',
      href: isResources
        ? '/grants'
        : isJusticeHub
          ? '/reports/youth-justice/qld/announcements'
          : `/org/${slug}/goods/proof`,
      icon: FileText,
      active: false,
    },
    { label: 'Sources', href: `/org/${slug}?view=evidence#systems`, icon: Database, active: false },
  ];

  return (
    <div
      className="sticky top-0 flex h-screen flex-col items-center overflow-hidden px-2 py-4"
      data-testid="act-desk-sidebar-content"
    >
      <Link
        href={`/org/${slug}`}
        className="grid h-11 w-11 place-items-center rounded-lg bg-[#e7ef65] text-sm font-black text-[#183426] shadow-sm"
        aria-label="A Curious Tractor"
      >
        A
      </Link>

      <nav
        className="mt-7 flex w-full flex-col gap-2"
        aria-label={`${isResources ? 'Resource' : isJusticeHub ? 'JusticeHub' : 'Goods'} decision workspace`}
      >
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.active ? 'page' : undefined}
              title={link.label}
              className={`flex min-h-[62px] w-full flex-col items-center justify-center gap-1.5 rounded-xl text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7ef65] ${
                link.active
                  ? 'bg-[#2f8f64] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]'
                  : 'text-[#c7d1ca] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon size={24} weight={link.active ? 'fill' : 'regular'} aria-hidden />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex w-full flex-col gap-2">
        <Link
          href={`/org/${slug}/explore`}
          title="Search"
          className="flex min-h-[58px] w-full flex-col items-center justify-center gap-1.5 rounded-xl text-[10px] font-semibold text-[#c7d1ca] transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7ef65]"
        >
          <MagnifyingGlass size={23} weight="regular" aria-hidden />
          Search
        </Link>
        <Link
          href={`/org/${slug}/goods/governance`}
          title="Structure"
          className="flex min-h-[58px] w-full flex-col items-center justify-center gap-1.5 rounded-xl text-[10px] font-semibold text-[#c7d1ca] transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7ef65]"
        >
          <Gear size={23} weight="regular" aria-hidden />
          Structure
        </Link>
      </div>
    </div>
  );
}

function WorkspaceModeLink({ href, label, active, index }: WorkspaceLink & { index: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`grid min-h-10 grid-cols-[26px_minmax(0,1fr)] items-center gap-2 rounded-md px-3 py-2 transition-colors [@media(max-height:680px)]:min-h-9 ${
        active ? 'bg-white/10 text-white' : 'text-[#c7d1ca] hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className={`font-mono text-[10px] font-semibold ${active ? 'text-[#e7ef65]' : 'text-[#8fa196]'}`}>
        {String(index).padStart(2, '0')}
      </span>
      <span className="truncate text-sm font-semibold">{label}</span>
    </Link>
  );
}

// Rail-owned Goods navigation (Ben's call, 2026-08-05): the rail is the ONE
// nav. These groups replace the pill rows that lived in the green page header.
const GOODS_RAIL_SECTIONS: ReadonlyArray<{ label: string; items: ReadonlyArray<readonly [string, string]> }> = [
  { label: 'Work', items: [['today', 'Today'], ['capital', 'Capital'], ['matters', 'Matters'], ['network', 'Network'], ['applications', 'Applications'], ['learning', 'Learning']] },
  { label: 'Money in', items: [['foundations', 'Foundations'], ['foundations/scan', 'Funder Scan'], ['grants', 'Grants'], ['money', 'Money']] },
  { label: 'Delivery', items: [['funnel', 'Delivery map'], ['communities', 'Communities'], ['channels', 'Channels'], ['buyers', 'Buyers']] },
  { label: 'Trust', items: [['model', 'Story & model'], ['proof', 'Evidence'], ['governance', 'Governance']] },
];

/** The desk's lenses live under One Desk on the rail (Ben, 2026-08-05):
 * click a lens to filter the one pool in place; the detail pane's
 * "Open full workspace" remains the full-screen jump. */
const DESK_LENSES: ReadonlyArray<readonly [string | null, string]> = [
  [null, 'Everything'],
  ['money', 'Money owed to us'],
  ['commitment', 'Committed work'],
  ['funder', 'Funders'],
  ['grant', 'Grant rounds'],
  ['buyer', 'Buyers'],
];

function DeskRailTree({ slug, activeKind, project }: { slug: string; activeKind: string | null; project: string | null }) {
  const href = (kind: string | null) => {
    const params = new URLSearchParams({ ...(kind ? { kind } : {}), ...(project ? { project } : {}) });
    const qs = params.toString();
    return qs ? `/org/${slug}/desk?${qs}` : `/org/${slug}/desk`;
  };
  return (
    <div className="ml-3 border-l border-white/15 pb-1 pl-2">
      {DESK_LENSES.map(([kind, label]) => (
        <Link
          key={kind ?? 'all'}
          href={href(kind)}
          aria-current={activeKind === kind || (!activeKind && !kind) ? 'page' : undefined}
          className={`block rounded px-1.5 py-1 text-[11px] leading-4 hover:bg-white/5 hover:text-white ${
            activeKind === kind || (!activeKind && !kind) ? 'bg-white/10 font-semibold text-white' : 'text-[#c7d1ca]'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function GoodsRailTree({ slug, pathname }: { slug: string; pathname: string }) {
  const base = `/org/${slug}/goods`;
  // Highlight only the deepest matching entry so foundations/scan doesn't also
  // light up foundations.
  const allPaths = GOODS_RAIL_SECTIONS.flatMap((s) => s.items.map(([p]) => p));
  const best = allPaths
    .filter((p) => pathname === `${base}/${p}` || pathname.startsWith(`${base}/${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <div className="ml-3 border-l border-white/15 pb-1 pl-2">
      {GOODS_RAIL_SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="mt-1.5 px-1 font-mono text-[8px] font-semibold uppercase tracking-widest text-[#8fa196]">{section.label}</div>
          {section.items.map(([path, label]) => (
            <Link
              key={path}
              href={`${base}/${path}`}
              aria-current={best === path ? 'page' : undefined}
              className={`block rounded px-1.5 py-1 text-[11px] leading-4 hover:bg-white/5 hover:text-white ${
                best === path ? 'bg-white/10 font-semibold text-white' : 'text-[#c7d1ca]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

function WorkspaceProjectLink({
  project,
  slug,
  index,
  active,
}: {
  project: OrgProjectSummary;
  slug: string;
  index: number;
  active: boolean;
}) {
  return (
    <Link
      href={`/org/${slug}/${project.slug}`}
      aria-current={active ? 'page' : undefined}
      className={`grid min-h-8 grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2.5 rounded px-2 text-[#d7ded9] hover:bg-white/5 hover:text-white [@media(max-height:680px)]:min-h-7 ${active ? 'bg-white/10 text-white' : ''}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECT_COLOURS[index % PROJECT_COLOURS.length] }} />
      <span className="truncate text-xs">{projectFieldLabel(project)}</span>
      <span className="font-mono text-[10px] text-[#8fa196]">{project.pipeline_count}</span>
    </Link>
  );
}

function WorkspaceUtilityLink({ href, label, detail, active }: { href: string; label: string; detail: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 items-center justify-between gap-2 rounded-md px-2 [@media(max-height:680px)]:min-h-9 ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
    >
      <span className="shrink-0 text-xs font-semibold text-white">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-[8px] text-[#9fb0a4]">{detail}</span>
    </Link>
  );
}

function MobileWorkspaceLink({ href, label, active }: WorkspaceLink) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-md px-3 text-xs font-semibold ${
        active ? 'bg-[#183426] text-white' : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-2)] hover:text-[var(--ws-text)]'
      }`}
    >
      {label}
    </Link>
  );
}
