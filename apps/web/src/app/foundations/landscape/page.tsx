import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface CategoryRow {
  category_slug: string;
  label: string;
  color_hex: string;
  foundation_count: number;
  estimated_annual_giving: number;
  open_program_count: number;
  observed_grantee_count: number;
  observed_grant_amount: number;
}

interface GeoRow {
  geo_type: string;
  geo_code: string | null;
  geo_name: string;
  foundation_count: number;
  estimated_annual_giving: number;
  open_program_count: number;
}

interface AccessRow {
  access_mode: string;
  foundation_count: number;
  estimated_annual_giving: number;
}

interface TopFoundationRow {
  foundation_id: string;
  name: string;
  type: string | null;
  website: string | null;
  total_giving_annual: number | null;
  categories: string[];
  geographies: string[];
  open_program_count: number;
  observed_grantee_count: number;
  observed_grant_amount: number;
  landscape_weight: number;
}

function numberValue(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function money(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return amount ? `$${amount.toLocaleString()}` : 'Unknown';
}

function count(value: number | null | undefined) {
  return Number(value || 0).toLocaleString();
}

function pct(value: number, max: number) {
  if (!max) return '0%';
  return `${Math.max(3, Math.min(100, (value / max) * 100)).toFixed(1)}%`;
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function typeLabel(value: string | null) {
  if (!value) return 'Unclassified';
  const labels: Record<string, string> = {
    private_ancillary_fund: 'Private Ancillary Fund',
    public_ancillary_fund: 'Public Ancillary Fund',
    corporate_foundation: 'Corporate Foundation',
    community_foundation: 'Community Foundation',
    giving_circle: 'Giving Circle',
    trustee: 'Trustee',
    trust: 'Trust',
    grantmaker: 'Grantmaker',
  };
  return labels[value] || labelize(value);
}

function safeRows<T>(data: T[] | null, error: unknown): T[] {
  if (error || !data) return [];
  return data;
}

async function loadLandscape() {
  const db = getServiceSupabase();
  const [categoriesResult, geoResult, accessResult, topResult] = await Promise.all([
    db
      .from('mv_foundation_landscape_category')
      .select('*')
      .order('estimated_annual_giving', { ascending: false })
      .limit(16),
    db
      .from('mv_foundation_landscape_geo')
      .select('*')
      .in('geo_type', ['state', 'national', 'remoteness', 'place'])
      .order('estimated_annual_giving', { ascending: false })
      .limit(18),
    db
      .from('mv_foundation_landscape_access')
      .select('*')
      .order('foundation_count', { ascending: false }),
    db
      .from('mv_foundation_landscape_top_foundations')
      .select('*')
      .order('landscape_weight', { ascending: false })
      .limit(18),
  ]);

  const categories = safeRows<CategoryRow>(categoriesResult.data as CategoryRow[] | null, categoriesResult.error)
    .map(row => ({
      ...row,
      foundation_count: numberValue(row.foundation_count),
      estimated_annual_giving: numberValue(row.estimated_annual_giving),
      open_program_count: numberValue(row.open_program_count),
      observed_grantee_count: numberValue(row.observed_grantee_count),
      observed_grant_amount: numberValue(row.observed_grant_amount),
    }))
    .filter(row => row.foundation_count > 0);

  const geographies = safeRows<GeoRow>(geoResult.data as GeoRow[] | null, geoResult.error)
    .map(row => ({
      ...row,
      foundation_count: numberValue(row.foundation_count),
      estimated_annual_giving: numberValue(row.estimated_annual_giving),
      open_program_count: numberValue(row.open_program_count),
    }))
    .filter(row => row.foundation_count > 0);

  const access = safeRows<AccessRow>(accessResult.data as AccessRow[] | null, accessResult.error)
    .map(row => ({
      ...row,
      foundation_count: numberValue(row.foundation_count),
      estimated_annual_giving: numberValue(row.estimated_annual_giving),
    }))
    .filter(row => row.foundation_count > 0);

  const topFoundations = safeRows<TopFoundationRow>(topResult.data as TopFoundationRow[] | null, topResult.error)
    .map(row => ({
      ...row,
      total_giving_annual: numberValue(row.total_giving_annual),
      open_program_count: numberValue(row.open_program_count),
      observed_grantee_count: numberValue(row.observed_grantee_count),
      observed_grant_amount: numberValue(row.observed_grant_amount),
      landscape_weight: numberValue(row.landscape_weight),
      categories: Array.isArray(row.categories) ? row.categories : [],
      geographies: Array.isArray(row.geographies) ? row.geographies : [],
    }));

  return {
    categories,
    geographies,
    access,
    topFoundations,
    errors: {
      categories: categoriesResult.error?.message,
      geographies: geoResult.error?.message,
      access: accessResult.error?.message,
      top: topResult.error?.message,
    },
  };
}

export default async function FoundationLandscapePage() {
  const { categories, geographies, access, topFoundations, errors } = await loadLandscape();
  const totalFoundations = categories.reduce((sum, row) => sum + row.foundation_count, 0);
  const totalGiving = categories.reduce((sum, row) => sum + row.estimated_annual_giving, 0);
  const openPrograms = categories.reduce((sum, row) => sum + row.open_program_count, 0);
  const observedGiving = categories.reduce((sum, row) => sum + row.observed_grant_amount, 0);
  const maxCategoryGiving = Math.max(...categories.map(row => row.estimated_annual_giving), 0);
  const maxGeoGiving = Math.max(...geographies.map(row => row.estimated_annual_giving), 0);
  const maxAccessCount = Math.max(...access.map(row => row.foundation_count), 0);
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <section className="border-b-4 border-bauhaus-black bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link href="/foundations" className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-red">
              Foundations
            </Link>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
              Category + geography landscape
            </div>
          </div>
          <h1 className="max-w-5xl text-3xl font-black uppercase tracking-normal text-bauhaus-black sm:text-5xl">
            Australian Foundation Giving Landscape
          </h1>
          <div className="mt-6 grid border-4 border-bauhaus-black bg-bauhaus-black text-white sm:grid-cols-4">
            <Metric label="classified category rows" value={count(totalFoundations)} />
            <Metric label="estimated annual giving" value={money(totalGiving)} />
            <Metric label="open programs" value={count(openPrograms)} />
            <Metric label="observed grants" value={money(observedGiving)} />
          </div>
          {hasErrors ? (
            <div className="mt-4 border-4 border-bauhaus-yellow bg-warning-light p-4 text-sm font-bold text-bauhaus-black">
              Landscape views are not fully available yet. Run the foundation landscape migration and classifier.
            </div>
          ) : null}
          {!hasErrors ? (
            <LandscapeVisual
              categories={categories}
              geographies={geographies}
              access={access}
              totalGiving={totalGiving}
              totalFoundations={totalFoundations}
            />
          ) : null}
          {!hasErrors ? <LandscapeActionBrief categories={categories} geographies={geographies} access={access} /> : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="border-4 border-bauhaus-black bg-white">
          <PanelHeader title="Giving By Category" detail="Estimated annual giving, open programs, and observed grants" />
          <div className="divide-y-4 divide-bauhaus-black">
            {categories.map(row => (
              <div key={row.category_slug} className="grid gap-3 p-4 sm:grid-cols-[220px_1fr_150px] sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-bauhaus-black" style={{ backgroundColor: row.color_hex }} />
                    <div className="text-sm font-black uppercase leading-tight">{row.label}</div>
                  </div>
                  <div className="mt-1 text-xs font-bold text-bauhaus-muted">
                    {count(row.foundation_count)} foundations · {count(row.open_program_count)} open programs
                  </div>
                </div>
                <div className="h-8 border-2 border-bauhaus-black bg-bauhaus-canvas">
                  <div
                    className="h-full border-r-2 border-bauhaus-black"
                    style={{ width: pct(row.estimated_annual_giving, maxCategoryGiving), backgroundColor: row.color_hex }}
                  />
                </div>
                <div className="text-right font-mono text-lg font-black text-bauhaus-black">
                  {money(row.estimated_annual_giving)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <PanelHeader title="Access Modes" detail="How funders can be approached" />
          <div className="space-y-4 p-4">
            {access.map(row => (
              <div key={row.access_mode}>
                <div className="mb-1 flex items-end justify-between gap-3">
                  <div className="text-xs font-black uppercase tracking-widest">{labelize(row.access_mode)}</div>
                  <div className="font-mono text-sm font-black">{count(row.foundation_count)}</div>
                </div>
                <div className="h-7 border-2 border-bauhaus-black bg-bauhaus-canvas">
                  <div className="h-full bg-bauhaus-red" style={{ width: pct(row.foundation_count, maxAccessCount) }} />
                </div>
                <div className="mt-1 text-xs font-bold text-bauhaus-muted">{money(row.estimated_annual_giving)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border-4 border-bauhaus-black bg-white">
          <PanelHeader title="Place Focus" detail="Declared and inferred geography" />
          <div className="divide-y-2 divide-bauhaus-black">
            {geographies.map(row => (
              <div key={`${row.geo_type}-${row.geo_code || row.geo_name}`} className="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase">{row.geo_name}</div>
                    <div className="text-xs font-bold uppercase tracking-widest text-bauhaus-muted">{labelize(row.geo_type)}</div>
                  </div>
                  <div className="font-mono text-sm font-black">{money(row.estimated_annual_giving)}</div>
                </div>
                <div className="h-5 border-2 border-bauhaus-black bg-bauhaus-canvas">
                  <div className="h-full bg-bauhaus-blue" style={{ width: pct(row.estimated_annual_giving, maxGeoGiving) }} />
                </div>
                <div className="mt-1 text-xs font-bold text-bauhaus-muted">
                  {count(row.foundation_count)} foundations · {count(row.open_program_count)} programs
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <PanelHeader title="Top Foundations" detail="Weighted by known giving and observed grants" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="p-3 text-xs font-black uppercase tracking-widest">Foundation</th>
                  <th className="p-3 text-xs font-black uppercase tracking-widest">Type</th>
                  <th className="p-3 text-right text-xs font-black uppercase tracking-widest">Annual</th>
                  <th className="p-3 text-right text-xs font-black uppercase tracking-widest">Programs</th>
                  <th className="p-3 text-xs font-black uppercase tracking-widest">Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-bauhaus-black">
                {topFoundations.map(row => (
                  <tr key={row.foundation_id} className="align-top">
                    <td className="p-3">
                      <Link href={`/foundations/${row.foundation_id}`} className="font-black text-bauhaus-black hover:text-bauhaus-red">
                        {row.name}
                      </Link>
                      <div className="mt-1 text-xs font-bold text-bauhaus-muted">
                        {row.geographies.slice(0, 3).join(', ') || 'Geography unknown'}
                      </div>
                    </td>
                    <td className="p-3 text-sm font-bold text-bauhaus-muted">{typeLabel(row.type)}</td>
                    <td className="p-3 text-right font-mono font-black">{money(row.total_giving_annual)}</td>
                    <td className="p-3 text-right font-mono font-black">{count(row.open_program_count)}</td>
                    <td className="p-3 text-xs font-bold text-bauhaus-muted">
                      {row.categories.slice(0, 4).join(', ') || 'Unclassified'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b-4 border-bauhaus-black p-4 sm:border-b-0 sm:border-r-4 last:sm:border-r-0">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">{label}</div>
      <div className="mt-2 font-mono text-2xl font-black">{value}</div>
    </div>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas p-4">
      <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black">{title}</h2>
      <p className="mt-1 text-xs font-bold text-bauhaus-muted">{detail}</p>
    </div>
  );
}

function LandscapeActionBrief({
  categories,
  geographies,
  access,
}: {
  categories: CategoryRow[];
  geographies: GeoRow[];
  access: AccessRow[];
}) {
  const maxGiving = Math.max(...categories.map(row => row.estimated_annual_giving), 1);
  const accessTotal = access.reduce((sum, row) => sum + row.foundation_count, 0) || 1;
  const unknownCount = access
    .filter(row => row.access_mode === 'unknown')
    .reduce((sum, row) => sum + row.foundation_count, 0);
  const relationshipCount = access
    .filter(row => ['relationship_led', 'invitation_only'].includes(row.access_mode))
    .reduce((sum, row) => sum + row.foundation_count, 0);
  const gapCategories = categories
    .map(row => {
      const capitalScore = row.estimated_annual_giving / maxGiving;
      const openDensity = row.open_program_count / Math.max(row.foundation_count, 1);
      const accessGap = Math.max(0, 1 - Math.min(1, openDensity * 5));
      return { ...row, actionScore: capitalScore * accessGap, openDensity };
    })
    .sort((a, b) => b.actionScore - a.actionScore)
    .slice(0, 4);
  const placeTargets = geographies
    .filter(row => row.geo_type !== 'national')
    .map(row => ({
      ...row,
      openDensity: row.open_program_count / Math.max(row.foundation_count, 1),
    }))
    .sort((a, b) => b.estimated_annual_giving - a.estimated_annual_giving)
    .slice(0, 4);

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-3">
      <div className="border-4 border-bauhaus-black bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Next move 01</div>
        <h2 className="mt-1 text-lg font-black uppercase leading-tight">Turn capital pools into campaigns</h2>
        <p className="mt-2 text-sm font-bold leading-snug text-bauhaus-muted">
          Prioritise large categories where open-program density is thin.
        </p>
        <div className="mt-4 space-y-3">
          {gapCategories.map(row => (
            <div key={row.category_slug}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase">{row.label}</span>
                <span className="font-mono text-xs font-black">{money(row.estimated_annual_giving)}</span>
              </div>
              <div className="mt-1 h-4 border-2 border-bauhaus-black bg-bauhaus-canvas">
                <div className="h-full bg-bauhaus-red" style={{ width: pct(row.actionScore, 1) }} />
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                {count(row.open_program_count)} open signals · {(row.openDensity * 100).toFixed(1)}% density
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-4 border-bauhaus-black bg-bauhaus-black p-4 text-white">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Next move 02</div>
        <h2 className="mt-1 text-lg font-black uppercase leading-tight">Make the hidden door visible</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="border-4 border-white p-3">
            <div className="font-mono text-2xl font-black">{count(unknownCount)}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">unknown access</div>
          </div>
          <div className="border-4 border-white p-3">
            <div className="font-mono text-2xl font-black">{count(relationshipCount)}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">relationship led</div>
          </div>
        </div>
        <p className="mt-4 text-sm font-bold leading-snug">
          The fastest data product win is not more rows. It is classifying who accepts approaches, who needs an introducer, and who is closed.
        </p>
        <div className="mt-4 h-5 border-2 border-white bg-bauhaus-canvas">
          <div className="h-full bg-bauhaus-yellow" style={{ width: `${((unknownCount + relationshipCount) / accessTotal) * 100}%` }} />
        </div>
      </div>

      <div className="border-4 border-bauhaus-black bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Next move 03</div>
        <h2 className="mt-1 text-lg font-black uppercase leading-tight">Build place briefs for funders</h2>
        <p className="mt-2 text-sm font-bold leading-snug text-bauhaus-muted">
          Pair top geography concentrations with live local need, org networks, and current grants.
        </p>
        <div className="mt-4 divide-y-2 divide-bauhaus-black border-y-2 border-bauhaus-black">
          {placeTargets.map(row => (
            <div key={`${row.geo_type}-${row.geo_code || row.geo_name}`} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase">{row.geo_name}</span>
                <span className="font-mono text-xs font-black">{money(row.estimated_annual_giving)}</span>
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                {count(row.foundation_count)} signals · {count(row.open_program_count)} open programs
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandscapeVisual({
  categories,
  geographies,
  access,
  totalGiving,
  totalFoundations,
}: {
  categories: CategoryRow[];
  geographies: GeoRow[];
  access: AccessRow[];
  totalGiving: number;
  totalFoundations: number;
}) {
  const categoryLanes = categories.slice(0, 9);
  const places = geographies.slice(0, 6);
  const maxGiving = Math.max(...categoryLanes.map(row => row.estimated_annual_giving), 1);
  const maxOpenPrograms = Math.max(...categoryLanes.map(row => row.open_program_count), 1);
  const maxGeoGiving = Math.max(...places.map(row => row.estimated_annual_giving), 1);
  const relationshipCount = access
    .filter(row => ['relationship_led', 'invitation_only'].includes(row.access_mode))
    .reduce((sum, row) => sum + row.foundation_count, 0);
  const unknownCount = access
    .filter(row => row.access_mode === 'unknown')
    .reduce((sum, row) => sum + row.foundation_count, 0);
  const openCount = access
    .filter(row => ['open_or_rolling', 'open_application', 'eoi'].includes(row.access_mode))
    .reduce((sum, row) => sum + row.foundation_count, 0);
  const accessGroups = [
    { label: 'Relationship led', count: relationshipCount, color: '#C9342E' },
    { label: 'Unknown', count: unknownCount, color: '#121212' },
    { label: 'Open surface', count: openCount, color: '#2448C8' },
  ];
  const accessTotal = accessGroups.reduce((sum, row) => sum + row.count, 0) || 1;
  const openShare = (openCount / accessTotal) * 100;

  return (
    <section className="mt-8 border-4 border-bauhaus-black bg-bauhaus-canvas">
      <div className="grid border-b-4 border-bauhaus-black bg-bauhaus-black text-white lg:grid-cols-[1fr_420px]">
        <div className="p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">One visual</div>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-normal md:text-4xl">
            <span className="block">The money is there.</span>
            <span className="block">The door is not.</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-snug text-bauhaus-canvas">
            Category lanes show where foundation capital concentrates. The access gate shows how much of the landscape is openly reachable.
          </p>
        </div>
        <div className="grid grid-cols-2 border-t-4 border-bauhaus-black lg:border-l-4 lg:border-t-0">
          <div className="border-r-4 border-bauhaus-black p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Weighted giving</div>
            <div className="mt-1 font-mono text-xl font-black">{money(totalGiving)}</div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Category signals</div>
            <div className="mt-1 font-mono text-xl font-black">{count(totalFoundations)}</div>
          </div>
        </div>
      </div>

      <div className="grid bg-white xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border-b-4 border-bauhaus-black p-4 lg:p-5 xl:border-b-0 xl:border-r-4">
          <div className="grid gap-3 sm:grid-cols-[190px_1fr_110px]">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Capital pool</div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Estimated annual giving</div>
            <div className="text-right text-xs font-black uppercase tracking-widest text-bauhaus-muted">Open signals</div>
          </div>
          <div className="mt-3 space-y-2">
            {categoryLanes.map(row => (
              <div
                key={row.category_slug}
                className="grid min-h-16 gap-3 border-4 border-bauhaus-black bg-bauhaus-canvas p-3 sm:grid-cols-[190px_1fr_110px] sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-bauhaus-black" style={{ backgroundColor: row.color_hex }} />
                    <span className="text-sm font-black uppercase leading-tight">{row.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-black text-bauhaus-muted">{count(row.foundation_count)} signals</div>
                </div>
                <div>
                  <div className="h-8 border-4 border-bauhaus-black bg-white">
                    <div
                      className="flex h-full items-center justify-end bg-bauhaus-blue pr-2 text-right font-mono text-xs font-black text-white"
                      style={{ width: pct(row.estimated_annual_giving, maxGiving) }}
                    >
                      {money(row.estimated_annual_giving)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg font-black">{count(row.open_program_count)}</div>
                  <div className="ml-auto mt-1 h-2 max-w-24 border-2 border-bauhaus-black bg-white">
                    <div className="h-full bg-bauhaus-red" style={{ width: pct(row.open_program_count, maxOpenPrograms) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white">
          <div className="border-b-4 border-bauhaus-black p-4">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Access gate</div>
            <div className="mt-2 font-mono text-5xl font-black text-bauhaus-blue">{openShare.toFixed(1)}%</div>
            <p className="mt-1 text-sm font-bold leading-snug text-bauhaus-black">
              of classified access signals are visibly open, rolling, or EOI-based.
            </p>
            <div className="mt-4 flex h-14 overflow-hidden border-4 border-bauhaus-black">
              {accessGroups.map(row => (
                <div
                  key={row.label}
                  className="h-full border-r-4 border-bauhaus-black last:border-r-0"
                  title={`${row.label}: ${count(row.count)}`}
                  style={{
                    width: `${Math.max(row.count ? 2 : 0, (row.count / accessTotal) * 100)}%`,
                    backgroundColor: row.color,
                  }}
                />
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {accessGroups.map(row => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 font-black uppercase tracking-widest">
                    <span className="h-3 w-3 border-2 border-bauhaus-black" style={{ backgroundColor: row.color }} />
                    {row.label}
                  </span>
                  <span className="font-mono font-black">{count(row.count)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Place concentration</div>
            <div className="mt-3 space-y-3">
              {places.map(row => (
                <div key={`${row.geo_type}-${row.geo_code || row.geo_name}`}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="text-xs font-black uppercase">{row.geo_name}</div>
                    <div className="font-mono text-xs font-black">{money(row.estimated_annual_giving)}</div>
                  </div>
                  <div className="h-5 border-2 border-bauhaus-black bg-bauhaus-canvas">
                    <div className="h-full bg-bauhaus-blue" style={{ width: pct(row.estimated_annual_giving, maxGeoGiving) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
