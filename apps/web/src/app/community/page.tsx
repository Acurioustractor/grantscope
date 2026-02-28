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
  if (!value) return '—';
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
      <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Community Organizations</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        {total.toLocaleString()} grassroots and community organizations tracked.
        See how much they spend on admin vs programs.
      </p>

      <form action="/community" method="get" style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search organizations..."
          style={{
            flex: 1, padding: '10px 16px', fontSize: '14px',
            border: '1px solid #e0e0e0', borderRadius: '8px',
          }}
        />
        <button type="submit" style={{
          padding: '10px 20px', background: '#1a1a2e', color: '#fff',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
        }}>
          Search
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {orgs.map(org => (
          <div key={org.id} style={{
            background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px',
            padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>
                {org.website ? (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                    {org.name}
                  </a>
                ) : org.name}
              </div>
              {org.description && (
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px', maxWidth: '600px' }}>
                  {org.description.slice(0, 150)}{org.description.length > 150 ? '...' : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {org.domain?.map(d => (
                  <span key={d} style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
                    background: '#f3f4f6', color: '#555', textTransform: 'capitalize',
                  }}>
                    {d.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: '120px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatDollars(org.annual_revenue)}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>annual revenue</div>
              {org.admin_burden_cost && org.annual_revenue && (
                <div style={{
                  fontSize: '12px', color: '#dc2626', marginTop: '4px',
                }}>
                  {Math.round((org.admin_burden_cost / org.annual_revenue) * 100)}% admin
                </div>
              )}
            </div>
          </div>
        ))}

        {orgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            No community organizations found. Run the profiling script first.
          </div>
        )}
      </div>
    </div>
  );
}
