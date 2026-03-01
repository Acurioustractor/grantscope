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
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Directory</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Community Organizations</h1>
        <p className="text-bauhaus-muted font-medium">
          {total.toLocaleString()} grassroots and community organizations tracked.
          See how much they spend on admin vs programs.
        </p>
      </div>

      <form action="/community" method="get" className="flex gap-0 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search organizations..."
          className="flex-1 px-4 py-2.5 text-sm font-bold border-4 border-bauhaus-black bg-white focus:bg-bauhaus-yellow focus:outline-none"
        />
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black">
          Search
        </button>
      </form>

      <div className="space-y-3">
        {orgs.map(org => (
          <div key={org.id} className="bg-white border-4 border-bauhaus-black p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 hover:-translate-y-1 bauhaus-shadow-sm transition-all">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px]">
                {org.website ? (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red">
                    {org.name}
                  </a>
                ) : (
                  <span className="text-bauhaus-black">{org.name}</span>
                )}
              </div>
              {org.description && (
                <div className="text-sm text-bauhaus-muted mt-1 line-clamp-2 max-w-xl">
                  {org.description}
                </div>
              )}
              {org.domain?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {org.domain.map(d => (
                    <span key={d} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-black uppercase tracking-wider border-2 border-bauhaus-black/20 capitalize">
                      {d.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:text-right flex-shrink-0">
              <div className="text-base font-black text-bauhaus-black tabular-nums">{formatDollars(org.annual_revenue)}</div>
              <div className="text-[11px] text-bauhaus-muted font-bold uppercase tracking-wider">annual revenue</div>
              {org.admin_burden_cost && org.annual_revenue && (
                <div className="text-xs text-bauhaus-red font-black mt-0.5 tabular-nums">
                  {Math.round((org.admin_burden_cost / org.annual_revenue) * 100)}% admin
                </div>
              )}
            </div>
          </div>
        ))}

        {orgs.length === 0 && (
          <div className="text-center py-16 text-bauhaus-muted border-4 border-bauhaus-black bg-white">
            <p className="font-black uppercase">No community organizations found.</p>
            <p className="text-sm mt-1">Run the profiling script first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
