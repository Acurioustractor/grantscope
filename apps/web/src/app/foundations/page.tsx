import { getServiceSupabase } from '@/lib/supabase';

interface FoundationRow {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  profile_confidence: string;
  enriched_at: string | null;
}

function formatGiving(amount: number | null): string {
  if (!amount) return 'Unknown';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function typeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    private_ancillary_fund: 'Private Ancillary Fund',
    public_ancillary_fund: 'Public Ancillary Fund',
    trust: 'Trust',
    corporate_foundation: 'Corporate Foundation',
  };
  return type ? labels[type] || type : 'Foundation';
}

export default async function FoundationsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; focus?: string; profiled?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q || '';
  const typeFilter = params.type || '';
  const focusFilter = params.focus || '';
  const profiledOnly = params.profiled === '1';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  let dbQuery = supabase
    .from('foundations')
    .select('id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, enriched_at', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }
  if (typeFilter) {
    dbQuery = dbQuery.eq('type', typeFilter);
  }
  if (focusFilter) {
    dbQuery = dbQuery.contains('thematic_focus', [focusFilter]);
  }
  if (profiledOnly) {
    dbQuery = dbQuery.not('enriched_at', 'is', null);
  }

  dbQuery = dbQuery
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  const { data: foundations, count } = await dbQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  const types = ['private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation'];
  const focuses = ['arts', 'indigenous', 'health', 'education', 'community', 'environment', 'research'];

  return (
    <div>
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Australian Foundations</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>{(count || 0).toLocaleString()} foundations, trusts, and ancillary funds from the ACNC register</p>

      <form method="get" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search foundations..."
          style={{ flex: 1, minWidth: '200px', padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
        <select name="type" defaultValue={typeFilter} style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="">All types</option>
          {types.map(t => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select name="focus" defaultValue={focusFilter} style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="">All focus areas</option>
          {focuses.map(f => (
            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#555', cursor: 'pointer' }}>
          <input type="checkbox" name="profiled" value="1" defaultChecked={profiledOnly} />
          Profiled only
        </label>
        <button type="submit" style={{ padding: '10px 20px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Filter
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(foundations as FoundationRow[] || []).map((f) => (
          <a key={f.id} href={`/foundations/${f.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>{f.name}</h3>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {typeLabel(f.type)}
                    {f.enriched_at && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', padding: '1px 6px', background: f.profile_confidence === 'high' ? '#ecfdf5' : f.profile_confidence === 'medium' ? '#fffbeb' : '#f5f5f5', borderRadius: '4px', color: f.profile_confidence === 'high' ? '#059669' : f.profile_confidence === 'medium' ? '#d97706' : '#999' }}>
                        {f.profile_confidence} profile
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {f.description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', minWidth: '100px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>
                    {formatGiving(f.total_giving_annual)}/yr
                  </div>
                </div>
              </div>
              {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0) && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {f.thematic_focus?.map(t => (
                    <span key={t} style={{ fontSize: '11px', padding: '2px 8px', background: '#ecfdf5', borderRadius: '4px', color: '#059669' }}>{t}</span>
                  ))}
                  {f.geographic_focus?.map(g => (
                    <span key={g} style={{ fontSize: '11px', padding: '2px 8px', background: '#f0f0f0', borderRadius: '4px', color: '#555' }}>{g}</span>
                  ))}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          {page > 1 && (
            <a href={`/foundations?q=${query}&type=${typeFilter}&focus=${focusFilter}${profiledOnly ? '&profiled=1' : ''}&page=${page - 1}`} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', textDecoration: 'none', color: '#555' }}>Previous</a>
          )}
          <span style={{ padding: '8px 16px', color: '#666' }}>Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/foundations?q=${query}&type=${typeFilter}&focus=${focusFilter}${profiledOnly ? '&profiled=1' : ''}&page=${page + 1}`} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', textDecoration: 'none', color: '#555' }}>Next</a>
          )}
        </div>
      )}
    </div>
  );
}
