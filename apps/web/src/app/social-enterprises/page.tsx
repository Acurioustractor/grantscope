import { getServiceSupabase } from '@/lib/supabase';
import { SEClient } from './se-client';
import type { SEMapPoint } from './se-map';

export const dynamic = 'force-dynamic';

interface SocialEnterprise {
  id: string;
  name: string;
  abn: string | null;
  org_type: string;
  legal_structure: string | null;
  description: string | null;
  website: string | null;
  state: string | null;
  city: string | null;
  postcode: string | null;
  sector: string[];
  certifications: Array<{ body: string; status?: string; score?: number }>;
  source_primary: string | null;
  target_beneficiaries: string[] | null;
  logo_url: string | null;
  business_model: string | null;
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

const SOURCES = [
  { value: 'supply-nation', label: 'Supply Nation' },
  { value: 'oric', label: 'ORIC' },
  { value: 'social-traders', label: 'Social Traders' },
  { value: 'buyability', label: 'BuyAbility' },
  { value: 'b-corp', label: 'B Corp' },
];

interface SearchParams {
  q?: string;
  org_type?: string;
  state?: string;
  sector?: string;
  source?: string;
  indigenous?: string;
  sort?: string;
  page?: string;
}

export default async function SocialEnterprisesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const orgTypeFilter = params.org_type || '';
  const stateFilter = params.state || '';
  const sectorFilter = params.sector || '';
  const sourceFilter = params.source || '';
  const indigenousFilter = params.indigenous || '';
  const sortBy = params.sort || 'name';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  let dbQuery = supabase
    .from('social_enterprises')
    .select('id, name, abn, org_type, legal_structure, description, website, state, city, postcode, sector, certifications, source_primary, target_beneficiaries, logo_url, business_model, profile_confidence, enriched_at, created_at', { count: 'exact' });

  if (query) dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  if (orgTypeFilter) dbQuery = dbQuery.eq('org_type', orgTypeFilter);
  if (stateFilter) dbQuery = dbQuery.eq('state', stateFilter);
  if (sectorFilter) dbQuery = dbQuery.contains('sector', [sectorFilter]);
  if (sourceFilter) dbQuery = dbQuery.eq('source_primary', sourceFilter);
  if (indigenousFilter === 'true') dbQuery = dbQuery.or('source_primary.eq.oric,source_primary.eq.supply-nation,source_primary.eq.kinaway');

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
  if (sourceFilter) filterParams.set('source', sourceFilter);
  if (indigenousFilter) filterParams.set('indigenous', indigenousFilter);
  if (sortBy !== 'name') filterParams.set('sort', sortBy);
  const filterQS = filterParams.toString();

  // Fetch map aggregation data — group by postcode with lat/lng
  const { data: mapRaw } = await supabase
    .from('social_enterprises')
    .select('id, name, org_type, postcode')
    .not('postcode', 'is', null)
    .limit(5000);

  type SEEntry = { id: string; name: string; org_type: string };
  const byPostcode = new Map<string, { count: number; types: Map<string, number>; enterprises: SEEntry[] }>();
  for (const se of mapRaw || []) {
    const existing = byPostcode.get(se.postcode) || { count: 0, types: new Map<string, number>(), enterprises: [] as SEEntry[] };
    existing.count++;
    existing.types.set(se.org_type, (existing.types.get(se.org_type) || 0) + 1);
    existing.enterprises.push({ id: se.id, name: se.name, org_type: se.org_type });
    byPostcode.set(se.postcode, existing);
  }

  // Get lat/lng for postcodes
  const mapPostcodes = Array.from(byPostcode.keys());
  const geoLookup = new Map<string, { lat: number; lng: number; locality: string }>();
  for (let i = 0; i < mapPostcodes.length; i += 100) {
    const chunk = mapPostcodes.slice(i, i + 100);
    const { data: geoData } = await supabase
      .from('postcode_geo')
      .select('postcode, latitude, longitude, locality')
      .in('postcode', chunk)
      .not('latitude', 'is', null);
    for (const g of geoData || []) {
      geoLookup.set(g.postcode, { lat: g.latitude, lng: g.longitude, locality: g.locality || '' });
    }
  }

  const mapData: SEMapPoint[] = Array.from(byPostcode.entries())
    .filter(([pc]) => geoLookup.has(pc))
    .map(([pc, d]) => {
      const geo = geoLookup.get(pc)!;
      let dominantType = 'social_enterprise';
      let maxCount = 0;
      d.types.forEach((cnt, type) => {
        if (cnt > maxCount) { maxCount = cnt; dominantType = type; }
      });
      return {
        postcode: pc,
        locality: geo.locality,
        lat: geo.lat,
        lng: geo.lng,
        count: d.count,
        dominant_type: dominantType,
        enterprises: d.enterprises,
      };
    });

  return (
    <div>
      {/* Hero intro */}
      <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8 mb-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
        <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-[0.3em] mb-3">Directory</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
          Australian Social Enterprises
        </h1>
        <p className="text-white/80 font-medium max-w-2xl leading-relaxed mb-4">
          {(count || 0).toLocaleString()} social and Indigenous enterprises from 6 sources &mdash; Supply Nation, ORIC, Social Traders, BuyAbility, B Corp, and Kinaway &mdash; linked to $901B in government contracts, donations, and justice funding. Open. Free. Updated by 45 autonomous agents.
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-white/30 text-white/80">
            {(count || 0).toLocaleString()} Records
          </span>
          <a href="/social-enterprises?indigenous=true" className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-red bg-bauhaus-red text-white hover:bg-white hover:text-bauhaus-red transition-colors">
            Indigenous Businesses
          </a>
          <a href="/social-enterprises?org_type=disability_enterprise" className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black hover:bg-white transition-colors">
            Disability Enterprises
          </a>
          <a href="/social-enterprises?org_type=b_corp" className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-money bg-money text-white hover:bg-white hover:text-money transition-colors">
            B Corps
          </a>
          <a href="/social-enterprises?org_type=social_enterprise" className="px-2.5 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-blue bg-bauhaus-blue text-white hover:bg-white hover:text-bauhaus-blue transition-colors">
            Social Enterprises
          </a>
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
        <select name="source" defaultValue={sourceFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All sources</option>
          {SOURCES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
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

      <SEClient mapData={mapData} listContent={<>
      {/* Quick filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <a href="/social-enterprises?indigenous=true" className={`text-xs px-3 py-1.5 font-black uppercase tracking-wider border-2 transition-colors ${indigenousFilter === 'true' ? 'border-bauhaus-red bg-bauhaus-red text-white' : 'border-bauhaus-red/30 text-bauhaus-red hover:bg-bauhaus-red/10'}`}>
          Indigenous Enterprises ({'>'}9,500)
        </a>
        <a href="/social-enterprises?source=social-traders" className={`text-xs px-3 py-1.5 font-black uppercase tracking-wider border-2 transition-colors ${sourceFilter === 'social-traders' ? 'border-bauhaus-blue bg-bauhaus-blue text-white' : 'border-bauhaus-blue/30 text-bauhaus-blue hover:bg-bauhaus-blue/10'}`}>
          Certified Social Enterprises
        </a>
        <a href="/social-enterprises?source=buyability" className={`text-xs px-3 py-1.5 font-black uppercase tracking-wider border-2 transition-colors ${sourceFilter === 'buyability' ? 'border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black' : 'border-bauhaus-yellow/50 text-bauhaus-black hover:bg-bauhaus-yellow/10'}`}>
          Disability Enterprises
        </a>
        <a href="/social-enterprises" className="text-xs px-3 py-1.5 font-black uppercase tracking-wider border-2 border-bauhaus-black/20 text-bauhaus-muted hover:bg-bauhaus-canvas">
          Clear Filters
        </a>
      </div>

      <div className="space-y-3">
        {(enterprises as SocialEnterprise[] || []).map((se) => {
          const badge = orgTypeBadge(se.org_type);
          return (
            <div key={se.id} className="bg-white border-4 border-bauhaus-black p-4 sm:px-5 transition-all hover:-translate-y-1 bauhaus-shadow-sm group">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <a href={`/social-enterprises/${se.id}`} className="font-bold text-bauhaus-black text-[15px] hover:text-bauhaus-blue">
                      <h3>{se.name}</h3>
                    </a>
                    <div className="text-sm text-bauhaus-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <a href={`/social-enterprises?org_type=${se.org_type}`} className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 hover:opacity-80 transition-opacity ${badge.cls}`}>
                        {badge.label}
                      </a>
                      {se.state && (
                        <a href={`/social-enterprises?state=${se.state}`} className="font-bold hover:text-bauhaus-blue transition-colors">{se.state}</a>
                      )}
                      {se.city && (
                        <span className="text-bauhaus-muted">{se.city}</span>
                      )}
                      {se.source_primary && (
                        <a href={`/social-enterprises?source=${se.source_primary}`} className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 hover:opacity-80 transition-opacity ${
                          se.source_primary === 'supply-nation' ? 'border-bauhaus-red/40 bg-bauhaus-red/10 text-bauhaus-red' :
                          se.source_primary === 'oric' ? 'border-bauhaus-red/40 bg-bauhaus-red/10 text-bauhaus-red' :
                          'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                        }`}>
                          {SOURCES.find(s => s.value === se.source_primary)?.label || se.source_primary}
                        </a>
                      )}
                      {se.abn && (
                        <span className="text-[11px] px-1.5 py-0.5 font-bold border-2 border-money/30 bg-money-light text-money">ABN {se.abn}</span>
                      )}
                    </div>
                    {se.description && (
                      <div className="text-sm text-bauhaus-muted mt-1 line-clamp-2">
                        {se.description}
                      </div>
                    )}
                  </div>
                  <div className="sm:text-right sm:ml-4 flex-shrink-0 flex items-center gap-3">
                    {se.certifications && se.certifications.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {se.certifications.map((cert, i) => (
                          <a key={i} href={`/social-enterprises?source=${cert.body}`} className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-money bg-money-light text-money hover:opacity-80 transition-opacity">
                            {certBadge(cert.body)}
                          </a>
                        ))}
                      </div>
                    )}
                    <a href={`/social-enterprises/${se.id}`} className="text-bauhaus-muted hover:text-bauhaus-blue transition-colors flex-shrink-0" title="View details">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  </div>
                </div>
                {se.sector?.length > 0 && (
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {se.sector.map(s => (
                      <a key={s} href={`/social-enterprises?sector=${s}`} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border-2 border-bauhaus-black/20 capitalize hover:border-bauhaus-blue hover:text-bauhaus-blue transition-colors">{s}</a>
                    ))}
                  </div>
                )}
              </div>
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
      </>} />
    </div>
  );
}
