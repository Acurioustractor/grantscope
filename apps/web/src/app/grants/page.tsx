import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Government Grants</h1>
        <p className="text-navy-500">{(count || 0).toLocaleString()} grants from GrantConnect, data.gov.au, QLD, and more</p>
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search grants..."
          className="flex-1 px-4 py-2.5 border border-navy-200 rounded-lg text-sm focus:border-link focus:outline-none bg-white"
        />
        <select name="category" defaultValue={category} className="px-4 py-2.5 border border-navy-200 rounded-lg text-sm bg-white focus:border-link focus:outline-none">
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <button type="submit" className="px-5 py-2.5 bg-navy-900 text-white text-sm font-medium rounded-lg hover:bg-navy-800 transition-colors cursor-pointer">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {(grants as Grant[] || []).map((grant) => (
          <a
            key={grant.id}
            href={`/grants/${grant.id}`}
            className="block group"
          >
            <div className="bg-white border border-navy-200 rounded-lg p-4 sm:px-5 transition-all group-hover:border-navy-300 group-hover:shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-navy-900 text-[15px] group-hover:text-link transition-colors">{grant.name}</h3>
                  <div className="text-sm text-navy-500 mt-0.5">{grant.provider}</div>
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0">
                  <div className="text-sm font-semibold text-link tabular-nums">
                    {formatAmount(grant.amount_min, grant.amount_max)}
                  </div>
                  <div className={`text-xs mt-0.5 ${grant.closes_at ? 'text-warning' : 'text-navy-400'}`}>
                    {grant.closes_at ? `Closes ${formatDate(grant.closes_at)}` : 'Ongoing'}
                  </div>
                </div>
              </div>
              {grant.categories?.length > 0 && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {grant.categories.map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 bg-navy-100 text-navy-600 rounded">
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
        <div className="flex justify-center items-center gap-2 mt-8">
          {page > 1 && (
            <a href={`/grants?q=${query}&category=${category}&page=${page - 1}`} className="px-4 py-2 text-sm border border-navy-200 rounded-lg text-navy-600 hover:bg-navy-100 transition-colors">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-sm text-navy-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/grants?q=${query}&category=${category}&page=${page + 1}`} className="px-4 py-2 text-sm border border-navy-200 rounded-lg text-navy-600 hover:bg-navy-100 transition-colors">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
