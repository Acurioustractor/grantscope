'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ImpersonateButton } from './impersonate-button';

type OrgAdminListItem = {
  id: string;
  name: string;
  slug: string | null;
  abn: string | null;
  org_type: string | null;
  subscription_plan: string | null;
  team_size: number | null;
  annual_revenue: number | null;
  owner_email: string | null;
  project_backed: {
    project_name: string;
    parent_org_name: string | null;
    parent_org_slug: string | null;
  } | null;
};

type FilterKey = 'all' | 'owner-linked' | 'missing-owner' | 'with-revenue' | 'with-abn';
type SortKey = 'attention' | 'alphabetical' | 'revenue';

function orgAttentionScore(item: OrgAdminListItem) {
  let score = 0;
  if (!item.owner_email) score += 3;
  if (!item.abn) score += 2;
  if (item.annual_revenue == null) score += 1;
  if (!item.slug) score += 4;
  return score;
}

function orgAttentionFlags(item: OrgAdminListItem) {
  const flags: string[] = [];
  if (!item.slug) flags.push('Missing slug');
  if (!item.owner_email) flags.push('Missing owner');
  if (!item.abn) flags.push('Missing ABN');
  if (item.annual_revenue == null) flags.push('Missing revenue');
  return flags;
}

export function OrgAdminListClient({ items }: { items: OrgAdminListItem[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('attention');
  const standaloneItems = useMemo(() => items.filter((item) => !item.project_backed), [items]);
  const projectBackedItems = useMemo(() => items.filter((item) => Boolean(item.project_backed)), [items]);

  const counts = useMemo(
    () => ({
      all: standaloneItems.length,
      'owner-linked': standaloneItems.filter((item) => Boolean(item.owner_email)).length,
      'missing-owner': standaloneItems.filter((item) => !item.owner_email).length,
      'with-revenue': standaloneItems.filter((item) => item.annual_revenue != null).length,
      'with-abn': standaloneItems.filter((item) => Boolean(item.abn)).length,
    }),
    [standaloneItems],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scoped = standaloneItems.filter((item) => {
      if (filter === 'owner-linked' && !item.owner_email) return false;
      if (filter === 'missing-owner' && item.owner_email) return false;
      if (filter === 'with-revenue' && item.annual_revenue == null) return false;
      if (filter === 'with-abn' && !item.abn) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        item.name,
        item.slug,
        item.abn,
        item.org_type,
        item.subscription_plan,
        item.owner_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return [...scoped].sort((left, right) => {
      if (sort === 'alphabetical') {
        return left.name.localeCompare(right.name);
      }

      if (sort === 'revenue') {
        const revenueDelta = (right.annual_revenue ?? -1) - (left.annual_revenue ?? -1);
        if (revenueDelta !== 0) return revenueDelta;
        return left.name.localeCompare(right.name);
      }

      const attentionDelta = orgAttentionScore(right) - orgAttentionScore(left);
      if (attentionDelta !== 0) return attentionDelta;
      return left.name.localeCompare(right.name);
    });
  }, [filter, standaloneItems, query, sort]);

  const attentionItems = useMemo(
    () =>
      [...standaloneItems]
        .filter((item) => orgAttentionScore(item) > 0)
        .sort((left, right) => {
          const attentionDelta = orgAttentionScore(right) - orgAttentionScore(left);
          if (attentionDelta !== 0) return attentionDelta;
          return left.name.localeCompare(right.name);
        })
        .slice(0, 6),
    [standaloneItems],
  );
  const healthyCount = standaloneItems.filter((item) => orgAttentionScore(item) === 0).length;

  const filterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'owner-linked', label: 'Owner linked' },
    { key: 'missing-owner', label: 'Missing owner' },
    { key: 'with-revenue', label: 'Revenue tracked' },
    { key: 'with-abn', label: 'ABN present' },
  ];
  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: 'attention', label: 'Needs attention' },
    { key: 'alphabetical', label: 'A–Z' },
    { key: 'revenue', label: 'Highest revenue' },
  ];

  return (
    <div className="space-y-5">
      <div className="border-2 border-bauhaus-black bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Find an organisation</div>
            <label className="mt-2 block">
              <span className="sr-only">Search organisations</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, slug, ABN, owner email"
                className="w-full border-2 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium text-bauhaus-black outline-none placeholder:text-gray-400 focus:border-bauhaus-red"
              />
            </label>
          </div>
          <div className="text-sm font-medium text-gray-600">
            Showing <span className="font-black text-bauhaus-black">{filtered.length}</span> of{' '}
            <span className="font-black text-bauhaus-black">{standaloneItems.length}</span> standalone orgs
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const active = filter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`border-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? 'border-bauhaus-black bg-bauhaus-black text-white'
                    : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
                }`}
              >
                {option.label} <span className="ml-1 opacity-70">{counts[option.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Sort</span>
          {sortOptions.map((option) => {
            const active = sort === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? 'border-bauhaus-red bg-bauhaus-red text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-bauhaus-black hover:text-bauhaus-black'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {attentionItems.length > 0 ? (
          <div className="xl:col-span-2 border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Attention queue</div>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-gray-700">
                  Start here when cleaning admin data. These are the orgs with the most missing operating fields right now.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="border-2 border-bauhaus-red/20 bg-bauhaus-red/5 px-3 py-2 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Needs attention</div>
                  <div className="mt-1 text-2xl font-black text-bauhaus-red">
                    {standaloneItems.filter((item) => orgAttentionScore(item) > 0).length}
                  </div>
                </div>
                <div className="border-2 border-money bg-money-light px-3 py-2 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Healthy</div>
                  <div className="mt-1 text-2xl font-black text-money">{healthyCount}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {attentionItems.map((org) => (
                <div key={`attention-${org.id}`} className="border-2 border-bauhaus-black bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-bauhaus-black">{org.name}</div>
                      <div className="mt-1 text-xs font-medium text-gray-500">
                        {org.slug ? `/${org.slug}` : 'No slug yet'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Score</div>
                      <div className="mt-1 text-xl font-black text-bauhaus-black">{orgAttentionScore(org)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {orgAttentionFlags(org).map((flag) => (
                      <span
                        key={`${org.id}-${flag}`}
                        className="border border-bauhaus-red/20 bg-bauhaus-red/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bauhaus-red"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {org.slug ? (
                      <Link
                        href={`/org/${org.slug}`}
                        className="bg-bauhaus-red px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-red-700"
                      >
                        Open org
                      </Link>
                    ) : null}
                    {org.slug ? (
                      <Link
                        href={`/funding-workspace?org=${encodeURIComponent(org.slug)}`}
                        className="border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:bg-bauhaus-canvas"
                      >
                        Funding
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {filtered.map((org) => (
          <div key={org.id} className="border-4 border-bauhaus-black bg-white p-5 hover:bg-gray-50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <h2 className="truncate text-lg font-black">{org.name}</h2>
                  {orgAttentionScore(org) > 0 ? (
                    <span className="shrink-0 border border-bauhaus-red/20 bg-bauhaus-red/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-bauhaus-red">
                      Needs attention
                    </span>
                  ) : null}
                  {org.org_type && (
                    <span className="shrink-0 bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {org.org_type}
                    </span>
                  )}
                  <span className="shrink-0 bg-bauhaus-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {org.subscription_plan ?? 'community'}
                  </span>
                  {org.project_backed ? (
                    <span className="shrink-0 border border-bauhaus-blue/20 bg-link-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bauhaus-blue">
                      Overlaps project
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  {org.slug && <span className="font-mono text-bauhaus-black">/{org.slug}</span>}
                  {org.abn && <span className="font-mono">ABN {org.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}</span>}
                  {org.team_size && <span>{org.team_size} staff</span>}
                  {org.annual_revenue && <span>~${(org.annual_revenue / 1_000_000).toFixed(0)}M turnover</span>}
                  <span>Owner: {org.owner_email ?? 'unlinked'}</span>
                </div>
                {org.project_backed ? (
                  <div className="mt-2 text-xs font-medium text-gray-600">
                    Also represented as the <span className="font-black text-bauhaus-black">{org.project_backed.project_name}</span>{' '}
                    project under{' '}
                    {org.project_backed.parent_org_slug ? (
                      <Link href={`/org/${org.project_backed.parent_org_slug}`} className="font-black text-bauhaus-black underline">
                        {org.project_backed.parent_org_name ?? org.project_backed.parent_org_slug}
                      </Link>
                    ) : (
                      <span className="font-black text-bauhaus-black">
                        {org.project_backed.parent_org_name ?? 'another org'}
                      </span>
                    )}
                    .
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {!org.owner_email ? (
                    <span className="border border-bauhaus-red/20 bg-bauhaus-red/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bauhaus-red">
                      Missing owner
                    </span>
                  ) : null}
                  {!org.abn ? (
                    <span className="border border-bauhaus-blue/20 bg-link-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bauhaus-blue">
                      Missing ABN
                    </span>
                  ) : null}
                  {org.annual_revenue == null ? (
                    <span className="border border-gray-300 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                      Missing revenue
                    </span>
                  ) : null}
                  {!org.slug ? (
                    <span className="border border-bauhaus-black bg-bauhaus-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                      Missing slug
                    </span>
                  ) : null}
                </div>
              </div>
              {org.slug ? <ImpersonateButton slug={org.slug} /> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {org.slug ? (
                <>
                  <Link
                    href={`/org/${org.slug}`}
                    className="bg-bauhaus-red px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-red-700"
                  >
                    View Dashboard
                  </Link>
                  <Link
                    href={`/org/${org.slug}/contacts`}
                    className="border-2 border-bauhaus-black bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-canvas"
                  >
                    Open Contacts
                  </Link>
                  <Link
                    href={`/funding-workspace?org=${encodeURIComponent(org.slug)}`}
                    className="border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-gray-800"
                  >
                    Funding Matches
                  </Link>
                </>
              ) : (
                <div className="border-2 border-bauhaus-red/20 bg-bauhaus-red/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-bauhaus-red">
                  Missing slug
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {projectBackedItems.length > 0 ? (
        <div className="border-2 border-bauhaus-black bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Overlapping org and project records</div>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-gray-700">
                These are real org profiles that also have a matching project representation inside a parent organisation.
                They are separated here so the main org queue stays focused on standalone-org admin work.
              </p>
            </div>
            <div className="border-2 border-bauhaus-blue/20 bg-link-light px-3 py-2 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Overlap count</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-blue">{projectBackedItems.length}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {projectBackedItems.map((org) => (
              <div key={`project-backed-${org.id}`} className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-black text-bauhaus-black">{org.name}</div>
                      <span className="border border-bauhaus-blue/20 bg-link-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bauhaus-blue">
                        Overlaps project
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-gray-600">
                      Also represented as {org.project_backed?.project_name} under{' '}
                      {org.project_backed?.parent_org_slug ? (
                        <Link href={`/org/${org.project_backed.parent_org_slug}`} className="font-black text-bauhaus-black underline">
                          {org.project_backed.parent_org_name ?? org.project_backed.parent_org_slug}
                        </Link>
                      ) : (
                        <span className="font-black text-bauhaus-black">{org.project_backed?.parent_org_name ?? 'parent org'}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {org.slug ? <div className="font-mono text-bauhaus-black">/{org.slug}</div> : null}
                    <div>Score {orgAttentionScore(org)}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {orgAttentionFlags(org).map((flag) => (
                    <span
                      key={`${org.id}-${flag}`}
                      className="border border-bauhaus-red/20 bg-bauhaus-red/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bauhaus-red"
                    >
                      {flag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {org.slug ? (
                    <Link
                      href={`/org/${org.slug}`}
                      className="bg-bauhaus-red px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-red-700"
                    >
                      Open org
                    </Link>
                  ) : null}
                  {org.project_backed?.parent_org_slug && org.slug ? (
                    <Link
                      href={`/org/${org.project_backed.parent_org_slug}/${org.slug}`}
                      className="border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:bg-bauhaus-canvas"
                    >
                      Open project
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="border-2 border-bauhaus-black bg-bauhaus-canvas px-5 py-8 text-center">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-bauhaus-black">No organisations match</div>
          <p className="mt-2 text-sm font-medium text-gray-600">Try a different search term or clear the current filter.</p>
        </div>
      ) : null}
    </div>
  );
}
