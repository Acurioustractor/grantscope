import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SocialEnterprise {
  id: string;
  name: string;
  org_type: string;
  legal_structure: string | null;
  description: string | null;
  website: string | null;
  state: string | null;
  city: string | null;
  sector: string[];
  certifications: Array<{ body: string; status?: string; score?: number }>;
  source_primary: string | null;
  profile_confidence: string;
  enriched_at: string | null;
  created_at: string;
}

function orgTypeBadge(type: string): { label: string; cls: string } {
  const badges: Record<string, { label: string; cls: string }> = {
    social_enterprise: { label: 'Social Enterprise', cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue' },
    b_corp: { label: 'B Corp', cls: 'border-money bg-money-light text-money' },
    indigenous_business: { label: 'Indigenous Business', cls: 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' },
    disability_enterprise: { label: 'Disability Enterprise', cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black' },
    cooperative: { label: 'Cooperative', cls: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted' },
  };
  return badges[type] || { label: type.replace(/_/g, ' '), cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted' };
}

function certBadge(body: string): string {
  const labels: Record<string, string> = {
    'social-traders': 'Social Traders',
    'b-corp': 'B Corp',
    'buyability': 'BuyAbility',
    'supply-nation': 'Supply Nation',
  };
  return labels[body] || body;
}

const ORG_TYPES = [
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'b_corp', label: 'B Corp' },
  { value: 'indigenous_business', label: 'Indigenous Business' },
  { value: 'disability_enterprise', label: 'Disability Enterprise' },
  { value: 'cooperative', label: 'Cooperative' },
];

const STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'ACT' },
];

const SECTORS = [
  'food', 'employment', 'housing', 'environment', 'arts', 'health',
  'education', 'technology', 'consulting', 'manufacturing', 'facilities',
  'indigenous', 'tourism', 'retail', 'community',
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'newest', label: 'Newest Added' },
  { value: 'state', label: 'By State' },
];

interface SearchParams {
  q?: string;
  org_type?: string;
  state?: string;
  sector?: string;
  sort?: string;
  page?: string;
}

export default async function SocialEnterprisesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const orgTypeFilter = params.org_type || '';
  const stateFilter = params.state || '';
  const sectorFilter = params.sector || '';
  const sortBy = params.sort || 'name';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  let dbQuery = supabase
    .from('social_enterprises')
    .select('id, name, org_type, legal_structure, description, website, state, city, sector, certifications, source_primary, profile_confidence, enriched_at, created_at', { count: 'exact' });

  if (query) dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  if (orgTypeFilter) dbQuery = dbQuery.eq('org_type', orgTypeFilter);
  if (stateFilter) dbQuery = dbQuery.eq('state', stateFilter);
  if (sectorFilter) dbQuery = dbQuery.contains('sector', [sectorFilter]);

  if (sortBy === 'newest') {
    dbQuery = dbQuery.order('created_at', { ascending: false });
  } else if (sortBy === 'state') {
    dbQuery = dbQuery.order('state', { ascending: true, nullsFirst: false });
  } else {
    dbQuery = dbQuery.order('name', { ascending: true });
  }

  dbQuery = dbQuery.range(offset, offset + pageSize - 1);

  const { data: enterprises, count } = await dbQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  // Build filter query string for pagination
  const filterParams = new URLSearchParams();
  if (query) filterParams.set('q', query);
  if (orgTypeFilter) filterParams.set('org_type', orgTypeFilter);
  if (stateFilter) filterParams.set('state', stateFilter);
  if (sectorFilter) filterParams.set('sector', sectorFilter);
  if (sortBy !== 'name') filterParams.set('sort', sortBy);
  const filterQS = filterParams.toString();

  return (
    <div>
      {/* Hero intro */}
      <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8 mb-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
        <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-[0.3em] mb-3">Directory</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
          Australian Social Enterprises
        </h1>
        <p className="text-white/80 font-medium max-w-2xl leading-relaxed mb-4">
          Australia has ~20,000 social enterprises generating $21 billion in revenue and 300,000 jobs.
          No single directory lists them all. GrantScope aggregates ORIC, Social Traders, BuyAbility,
          B Corp, and government procurement lists into one searchable directory &mdash; open and free.
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-white/30 text-white/80">
            {(count || 0).toLocaleString()} Records
          </span>
          <span className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-red bg-bauhaus-red text-white">
            Indigenous Businesses
          </span>
          <span className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black">
            Disability Enterprises
          </span>
          <span className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-money bg-money text-white">
            B Corps
          </span>
          <span className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-blue bg-bauhaus-blue text-white">
            Social Enterprises
          </span>
        </div>
        <div className="flex gap-4 flex-wrap mt-5">
          <a href="/reports/social-enterprise" className="px-5 py-2.5 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-2 border-bauhaus-red hover:bg-white hover:text-bauhaus-black transition-colors">
            Read the Report
          </a>
          <a href="/reports/community-power" className="px-5 py-2.5 bg-transparent text-white/80 font-black text-xs uppercase tracking-widest border-2 border-white/30 hover:border-white hover:text-white transition-colors">
            Community Power Playbook
          </a>
        </div>
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-0 mb-4 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search social enterprises..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none"
        />
        <select name="org_type" defaultValue={orgTypeFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All types</option>
          {ORG_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select name="state" defaultValue={stateFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All states</option>
          {STATES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select name="sector" defaultValue={sectorFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All sectors</option>
          {SECTORS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sortBy} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          {SORT_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {(enterprises as SocialEnterprise[] || []).map((se) => {
          const badge = orgTypeBadge(se.org_type);
          return (
            <a key={se.id} href={`/social-enterprises/${se.id}`} className="block group">
              <div className="bg-white border-4 border-bauhaus-black p-4 sm:px-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-bauhaus-black text-[15px] group-hover:text-bauhaus-blue">{se.name}</h3>
                    <div className="text-sm text-bauhaus-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {se.state && (
                        <span className="font-bold">{se.state}</span>
                      )}
                      {se.city && (
                        <span className="text-bauhaus-muted">{se.city}</span>
                      )}
                      {se.enriched_at && (
                        <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${
                          se.profile_confidence === 'high' ? 'border-money bg-money-light text-money' :
                          se.profile_confidence === 'medium' ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black' :
                          'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                        }`}>
                          {se.profile_confidence}
                        </span>
                      )}
                      {se.website && (
                        <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-blue/20 bg-link-light text-bauhaus-blue">Web</span>
                      )}
                    </div>
                    {se.description && (
                      <div className="text-sm text-bauhaus-muted mt-1 line-clamp-2">
                        {se.description}
                      </div>
                    )}
                  </div>
                  <div className="sm:text-right sm:ml-4 flex-shrink-0">
                    {se.certifications && se.certifications.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {se.certifications.map((cert, i) => (
                          <span key={i} className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-money bg-money-light text-money">
                            {certBadge(cert.body)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {se.sector?.length > 0 && (
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {se.sector.map(s => (
                      <span key={s} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border-2 border-bauhaus-black/20 capitalize">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {(enterprises || []).length === 0 && (
        <div className="text-center py-16 text-bauhaus-muted">
          <div className="text-lg font-black mb-2">No social enterprises found</div>
          <p className="text-sm font-medium">Try adjusting your filters or search terms.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-0 mt-8">
          {page > 1 && (
            <a href={`/social-enterprises?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black bg-bauhaus-canvas">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/social-enterprises?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
