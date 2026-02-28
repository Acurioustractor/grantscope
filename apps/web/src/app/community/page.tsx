import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface CommunityOrg {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  domain: string[];
  geographic_focus: string[];
  annual_revenue: number | null;
  annual_funding_received: number | null;
  admin_burden_cost: number | null;
  profile_confidence: string;
}

async function getCommunityOrgs(search?: string): Promise<{ orgs: CommunityOrg[]; total: number }> {
  try {
    const supabase = getServiceSupabase();
    let query = supabase
      .from('community_orgs')
      .select('id, name, website, description, domain, geographic_focus, annual_revenue, annual_funding_received, admin_burden_cost, profile_confidence', { count: 'exact' })
      .order('annual_revenue', { ascending: false, nullsFirst: false })
      .limit(50);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count } = await query;
    return { orgs: data || [], total: count || 0 };
  } catch {
    return { orgs: [], total: 0 };
  }
}

function formatDollars(value: number | null): string {
  if (!value) return '\u2014';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const { orgs, total } = await getCommunityOrgs(params.q);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Community Organizations</h1>
        <p className="text-navy-500">
          {total.toLocaleString()} grassroots and community organizations tracked.
          See how much they spend on admin vs programs.
        </p>
      </div>

      <form action="/community" method="get" className="flex gap-2 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search organizations..."
          className="flex-1 px-4 py-2.5 text-sm border border-navy-200 rounded-lg focus:border-link focus:outline-none bg-white"
        />
        <button type="submit" className="px-5 py-2.5 bg-navy-900 text-white text-sm font-semibold rounded-lg hover:bg-navy-800 transition-colors cursor-pointer">
          Search
        </button>
      </form>

      <div className="space-y-2">
        {orgs.map(org => (
          <div key={org.id} className="bg-white border border-navy-200 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 hover:border-navy-300 hover:shadow-sm transition-all">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px]">
                {org.website ? (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                    {org.name}
                  </a>
                ) : (
                  <span className="text-navy-900">{org.name}</span>
                )}
              </div>
              {org.description && (
                <div className="text-sm text-navy-500 mt-1 line-clamp-2 max-w-xl">
                  {org.description}
                </div>
              )}
              {org.domain?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {org.domain.map(d => (
                    <span key={d} className="text-[11px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-600 capitalize">
                      {d.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:text-right flex-shrink-0">
              <div className="text-base font-bold text-navy-900 tabular-nums">{formatDollars(org.annual_revenue)}</div>
              <div className="text-[11px] text-navy-500">annual revenue</div>
              {org.admin_burden_cost && org.annual_revenue && (
                <div className="text-xs text-danger font-medium mt-0.5 tabular-nums">
                  {Math.round((org.admin_burden_cost / org.annual_revenue) * 100)}% admin
                </div>
              )}
            </div>
          </div>
        ))}

        {orgs.length === 0 && (
          <div className="text-center py-16 text-navy-400">
            No community organizations found. Run the profiling script first.
          </div>
        )}
      </div>
    </div>
  );
}
