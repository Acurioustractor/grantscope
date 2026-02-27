import { getServiceSupabase } from '@/lib/supabase';

interface Grant {
  id: string;
  name: string;
  provider: string;
  program: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  categories: string[];
  status: string;
  sources: unknown;
}

function formatAmount(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return 'Amount not specified';
}

function formatDate(date: string | null): string {
  if (!date) return 'Ongoing';
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function GrantsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q || '';
  const category = params.category || '';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  let dbQuery = supabase
    .from('grant_opportunities')
    .select('*', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,provider.ilike.%${query}%`);
  }

  if (category) {
    dbQuery = dbQuery.contains('categories', [category]);
  }

  dbQuery = dbQuery
    .order('closes_at', { ascending: true, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  const { data: grants, count } = await dbQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  const categories = ['indigenous', 'arts', 'community', 'health', 'education', 'enterprise', 'regenerative', 'technology', 'justice'];

  return (
    <div>
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Government Grants</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>{(count || 0).toLocaleString()} grants from GrantConnect, data.gov.au, QLD, and more</p>

      <form method="get" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search grants..."
          style={{ flex: 1, padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
        <select name="category" defaultValue={category} style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: '10px 20px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Filter
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(grants as Grant[] || []).map((grant) => (
          <a
            key={grant.id}
            href={`/grants/${grant.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>{grant.name}</h3>
                  <div style={{ fontSize: '13px', color: '#666' }}>{grant.provider}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '150px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb' }}>
                    {formatAmount(grant.amount_min, grant.amount_max)}
                  </div>
                  <div style={{ fontSize: '12px', color: grant.closes_at ? '#d97706' : '#666', marginTop: '2px' }}>
                    {grant.closes_at ? `Closes ${formatDate(grant.closes_at)}` : 'Ongoing'}
                  </div>
                </div>
              </div>
              {grant.categories?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {grant.categories.map(c => (
                    <span key={c} style={{ fontSize: '11px', padding: '2px 8px', background: '#f0f0f0', borderRadius: '4px', color: '#555' }}>
                      {c}
                    </span>
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
            <a href={`/grants?q=${query}&category=${category}&page=${page - 1}`} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', textDecoration: 'none', color: '#555' }}>Previous</a>
          )}
          <span style={{ padding: '8px 16px', color: '#666' }}>Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/grants?q=${query}&category=${category}&page=${page + 1}`} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', textDecoration: 'none', color: '#555' }}>Next</a>
          )}
        </div>
      )}
    </div>
  );
}
