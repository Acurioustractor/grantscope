import { getServiceSupabase } from '@/lib/supabase';
import { FeedbackForm } from './feedback-form';

export const dynamic = 'force-dynamic';

const GITHUB_REPO = 'https://github.com/Acurioustractor/grantscope';

// Internal/non-public sources to hide from the public process page
const HIDDEN_SOURCES = new Set(['ghl_sync', 'alta_agent', 'manual-research', 'manual', 'grant-funding']);

const SOURCE_LABELS: Record<string, string> = {
  'arc-grants': 'Australian Research Council',
  'brisbane-grants': 'Brisbane City Council',
  'qld-arts-data': 'QLD Arts & Culture',
  'foundation_program': 'Foundation Programs',
  'qld-grants': 'QLD Grants Finder',
  'grantconnect': 'GrantConnect (Federal)',
  'tas-grants': 'Tasmanian Government',
  'ghl_sync': 'GoHighLevel CRM',
  'act-grants': 'ACT Government',
  'data-gov-au': 'data.gov.au',
  'nhmrc': 'National Health & Medical Research Council',
  'alta_agent': 'ALTA Agent',
  'nsw-grants': 'NSW Government',
  'manual-research': 'Manual Research',
  'vic-grants': 'Victorian Government',
  'dss': 'Dept. of Social Services',
  'nab-foundation': 'NAB Foundation',
  'regional-arts-australia': 'Regional Arts Australia',
  'iba': 'Indigenous Business Australia',
  'industry.gov.au': 'Dept. of Industry',
  'ian-potter': 'Ian Potter Foundation',
  'manual': 'Manual Entry',
  'ato.gov.au': 'Australian Tax Office',
  'paul-ramsay': 'Paul Ramsay Foundation',
  'minderoo': 'Minderoo Foundation',
  'qbe': 'QBE Foundation',
  'flying-arts': 'Flying Arts Alliance',
  'grants.gov.au': 'grants.gov.au',
  'grant-funding': 'Grant Funding',
  'snow-foundation': 'Snow Foundation',
  'ilsc': 'Indigenous Land & Sea Corporation',
  'indigenous_programs': 'Indigenous Programs',
  'niaa': 'National Indigenous Australians Agency',
  'dusseldorf-forum': 'Dusseldorp Forum',
};

interface PipelineStats {
  grants: { total: number; embedded: number; described: number; expired: number; noCloseDate: number };
  foundations: { total: number; enriched: number; unenriched: number; high: number; medium: number; low: number; recent7: number; recent30: number };
  socialEnterprises: { total: number; enriched: number; indigenous: number };
  communityOrgs: number;
  foundationPrograms: number;
  acncRecords: number;
  sources: { source: string; count: number }[];
}

async function getPipelineStats(): Promise<PipelineStats> {
  const supabase = getServiceSupabase();

  // Use raw SQL for accurate counts — PostgREST head+count returns nulls on vector/complex filters
  const [statsResult, sourcesResult] = await Promise.all([
    supabase.rpc('get_pipeline_stats' as never).then(
      r => r,
      () => ({ data: null }),
    ),
    supabase.rpc('dashboard_source_coverage' as never).then(
      r => r,
      () => ({ data: null }),
    ),
  ]);

  // Fallback: if get_pipeline_stats RPC doesn't exist, query inline via PostgREST
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((statsResult as any)?.data?.[0]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (statsResult as any).data[0];
    return {
      grants: { total: d.grants_total, embedded: d.grants_embedded, described: d.grants_described, expired: d.grants_expired, noCloseDate: d.grants_no_close },
      foundations: { total: d.foundations_total, enriched: d.foundations_enriched, unenriched: d.foundations_unenriched, high: d.foundations_high, medium: d.foundations_medium, low: d.foundations_low, recent7: d.foundations_recent_7d, recent30: d.foundations_recent_30d },
      socialEnterprises: { total: d.se_total ?? 0, enriched: d.se_enriched ?? 0, indigenous: d.se_indigenous ?? 0 },
      communityOrgs: d.community_orgs,
      foundationPrograms: d.foundation_programs,
      acncRecords: d.acnc_records,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sources: ((sourcesResult as any)?.data as { source: string; count: number }[]) || [],
    };
  }

  // Fallback: individual count queries (less accurate for vector columns but works without RPC)
  const [
    grantsTotal, grantsDescribed,
    foundationsTotal, foundationsEnriched, foundationsUnenriched,
    foundationsHigh, foundationsMedium, foundationsLow,
    foundationsRecent7, foundationsRecent30,
    communityOrgs, foundationPrograms, acncRecords,
    seTotal, seEnriched, seIndigenous,
  ] = await Promise.all([
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('description', 'is', null),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).not('website', 'is', null).is('enriched_at', null),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).eq('profile_confidence', 'high'),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).eq('profile_confidence', 'medium'),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).eq('profile_confidence', 'low'),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).gte('enriched_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('foundations').select('*', { count: 'exact', head: true }).gte('enriched_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('community_orgs').select('*', { count: 'exact', head: true }),
    supabase.from('foundation_programs').select('*', { count: 'exact', head: true }).in('status', ['open', 'closed']),
    supabase.from('acnc_ais').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }).eq('org_type', 'indigenous_business'),
  ]);

  return {
    grants: { total: grantsTotal.count || 0, embedded: 0, described: grantsDescribed.count || 0, expired: 0, noCloseDate: 0 },
    foundations: {
      total: foundationsTotal.count || 0, enriched: foundationsEnriched.count || 0, unenriched: foundationsUnenriched.count || 0,
      high: foundationsHigh.count || 0, medium: foundationsMedium.count || 0, low: foundationsLow.count || 0,
      recent7: foundationsRecent7.count || 0, recent30: foundationsRecent30.count || 0,
    },
    socialEnterprises: { total: seTotal.count || 0, enriched: seEnriched.count || 0, indigenous: seIndigenous.count || 0 },
    communityOrgs: communityOrgs.count || 0,
    foundationPrograms: foundationPrograms.count || 0,
    acncRecords: acncRecords.count || 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sources: ((sourcesResult as any)?.data as { source: string; count: number }[]) || [],
  };
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-black uppercase tracking-widest text-bauhaus-black">{label}</span>
        <span className="text-xs font-bold text-bauhaus-muted tabular-nums">
          {value.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-6 bg-bauhaus-canvas border-3 border-bauhaus-black relative overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white p-5">
      <div className="text-2xl font-black tabular-nums text-bauhaus-black">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">{label}</div>
      {sub && <div className="text-xs text-bauhaus-muted mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: 'live' | 'building' | 'planned' }) {
  const styles = {
    live: 'bg-money text-white',
    building: 'bg-bauhaus-yellow text-bauhaus-black',
    planned: 'bg-bauhaus-canvas text-bauhaus-muted border-2 border-bauhaus-muted',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
}

export default async function ProcessPage() {
  let stats: Awaited<ReturnType<typeof getPipelineStats>> | null = null;
  let error = false;

  try {
    stats = await getPipelineStats();
  } catch {
    error = true;
  }

  const s = stats;

  return (
    <div>
      {/* Hero */}
      <section className="py-12 sm:py-20">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-4">
          Build in Public
        </p>
        <h1 className="text-4xl sm:text-6xl font-black text-bauhaus-black mb-6 tracking-tight leading-[0.9]">
          The Open<br />Kitchen
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-2xl mb-4 leading-relaxed font-medium">
          We&apos;re building Australia&apos;s funding transparency infrastructure in the open.
          Here&apos;s exactly where we are &mdash; the good, the incomplete, and the broken.
        </p>
        <p className="text-sm text-bauhaus-muted max-w-2xl leading-relaxed">
          Every number on this page is live from our database. No vanity metrics, no rounding up.
          This is the workshop, not the showroom.
        </p>
      </section>

      {error && (
        <div className="border-4 border-bauhaus-red bg-danger-light p-6 mb-12">
          <p className="font-black text-bauhaus-red text-sm uppercase tracking-widest">
            Could not load pipeline stats. Database may be unavailable.
          </p>
        </div>
      )}

      {s && (
        <>
          {/* Pipeline Overview */}
          <section className="border-t-4 border-bauhaus-black pt-12 pb-12">
            <h2 className="text-2xl font-black text-bauhaus-black mb-8">Pipeline Overview</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-4 border-bauhaus-black mb-10">
              <div className="bg-white p-5 border-r-4 border-b-4 sm:border-b-0 border-bauhaus-black text-center">
                <div className="text-3xl font-black tabular-nums">{s.grants.total.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Grants</div>
              </div>
              <div className="bg-white p-5 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black text-center">
                <div className="text-3xl font-black tabular-nums">{s.foundations.total.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Foundations</div>
              </div>
              <div className="bg-white p-5 border-r-4 border-bauhaus-black text-center">
                <div className="text-3xl font-black tabular-nums">{s.foundationPrograms.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Programs</div>
              </div>
              <div className="bg-white p-5 text-center">
                <div className="text-3xl font-black tabular-nums">{s.acncRecords.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">ACNC Records</div>
              </div>
            </div>

            <div className="max-w-2xl">
              <ProgressBar label="Grants with Descriptions" value={s.grants.described} total={s.grants.total} color="bg-bauhaus-blue" />
              <ProgressBar label="Grants with AI Embeddings" value={s.grants.embedded} total={s.grants.total} color="bg-bauhaus-blue" />
              <ProgressBar label="Foundations Enriched" value={s.foundations.enriched} total={s.foundations.total} color="bg-bauhaus-red" />
              <p className="text-xs text-bauhaus-muted mt-2 font-medium">
                These percentages reflect coverage of <em>known</em> grants. There are many more grants across Australia we haven&apos;t ingested yet &mdash; state portals, local councils, corporate programs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mt-6 border-4 border-bauhaus-black">
              <div className="bg-white p-5 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
                <div className="text-2xl font-black tabular-nums text-bauhaus-black">{s.communityOrgs.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Community Orgs</div>
              </div>
              <a href="/social-enterprises" className="group bg-white p-5 transition-all hover:bg-bauhaus-red">
                <div className="text-2xl font-black tabular-nums text-bauhaus-black group-hover:text-white">{s.socialEnterprises.total.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1 group-hover:text-white/70">Social Enterprises</div>
                <div className="text-[10px] text-bauhaus-muted mt-1 font-medium group-hover:text-white/60">
                  {s.socialEnterprises.enriched.toLocaleString()} enriched &middot; {s.socialEnterprises.indigenous.toLocaleString()} Indigenous corps
                </div>
              </a>
            </div>

            <div className="max-w-2xl mt-6">
              <ProgressBar label="Social Enterprises Enriched" value={s.socialEnterprises.enriched} total={s.socialEnterprises.total} color="bg-bauhaus-red" />
            </div>
          </section>

          {/* Data Sources */}
          <section className="border-t-4 border-bauhaus-black pt-12 pb-12">
            <h2 className="text-2xl font-black text-bauhaus-black mb-8">Data Sources</h2>
            <div className="border-4 border-bauhaus-black bg-white">
              <div className="grid grid-cols-2 border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                <div className="px-5 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black">Source</div>
                <div className="px-5 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black text-right">Grants</div>
              </div>
              {s.sources.length > 0 ? (
                s.sources.filter((src: { source: string }) => !HIDDEN_SOURCES.has(src.source)).map((src: { source: string; count: number }, i: number) => (
                  <div key={src.source || i} className={`grid grid-cols-2 ${i < s.sources.length - 1 ? 'border-b-2 border-bauhaus-black/10' : ''}`}>
                    <div className="px-5 py-3 text-sm font-bold text-bauhaus-black">{SOURCE_LABELS[src.source] || src.source || 'Unknown'}</div>
                    <div className="px-5 py-3 text-sm font-bold text-bauhaus-black tabular-nums text-right">{(src.count || 0).toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-4 text-sm text-bauhaus-muted">
                  Source breakdown not available (requires database function).
                </div>
              )}
            </div>
          </section>

          {/* Enrichment Quality */}
          <section className="border-t-4 border-bauhaus-black pt-12 pb-12">
            <h2 className="text-2xl font-black text-bauhaus-black mb-8">Enrichment Quality</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-4 border-bauhaus-black mb-8">
              <div className="bg-white p-5 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
                <div className="text-2xl font-black tabular-nums text-money">{s.foundations.high.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">High Confidence</div>
              </div>
              <div className="bg-white p-5 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
                <div className="text-2xl font-black tabular-nums text-bauhaus-yellow">{s.foundations.medium.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Medium Confidence</div>
              </div>
              <div className="bg-white p-5">
                <div className="text-2xl font-black tabular-nums text-bauhaus-red">{s.foundations.low.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Low Confidence</div>
              </div>
            </div>

            {/* Stacked confidence bar */}
            {(s.foundations.high + s.foundations.medium + s.foundations.low) > 0 && (
              <div className="max-w-2xl mb-8">
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Profile Confidence Distribution</div>
                <div className="h-6 border-3 border-bauhaus-black flex overflow-hidden">
                  <div className="bg-money h-full" style={{ width: `${(s.foundations.high / (s.foundations.high + s.foundations.medium + s.foundations.low)) * 100}%` }} />
                  <div className="bg-bauhaus-yellow h-full" style={{ width: `${(s.foundations.medium / (s.foundations.high + s.foundations.medium + s.foundations.low)) * 100}%` }} />
                  <div className="bg-bauhaus-red h-full" style={{ width: `${(s.foundations.low / (s.foundations.high + s.foundations.medium + s.foundations.low)) * 100}%` }} />
                </div>
                <div className="flex gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-money inline-block border border-bauhaus-black" /> High</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-yellow inline-block border border-bauhaus-black" /> Medium</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-bauhaus-red inline-block border border-bauhaus-black" /> Low</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div className="border-4 border-bauhaus-black bg-white p-5">
                <div className="text-2xl font-black tabular-nums">{s.foundations.recent7.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Enriched Last 7 Days</div>
              </div>
              <div className="border-4 border-bauhaus-black bg-white p-5">
                <div className="text-2xl font-black tabular-nums">{s.foundations.recent30.toLocaleString()}</div>
                <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">Enriched Last 30 Days</div>
              </div>
            </div>
          </section>

          {/* Known Issues & Gaps */}
          <section className="border-t-4 border-bauhaus-black pt-12 pb-12">
            <h2 className="text-2xl font-black text-bauhaus-black mb-2">Known Issues &amp; Gaps</h2>
            <p className="text-sm text-bauhaus-muted mb-8 font-medium">
              Honesty over optics. Here&apos;s what&apos;s incomplete or broken.
            </p>
            <div className="space-y-3 max-w-2xl">
              {[
                { text: `${s.foundations.unenriched.toLocaleString()} foundations have websites but haven't been profiled yet`, live: true },
                { text: `${s.grants.expired.toLocaleString()} expired grants still in database (need archival strategy)`, live: true },
                { text: `${(s.grants.total - s.grants.described).toLocaleString()} grants without descriptions`, live: true },
                { text: `${s.grants.noCloseDate.toLocaleString()} grants without closing dates`, live: true },
                { text: 'No foundation embeddings yet — semantic search limited to grants only', live: false },
                { text: 'Corporate giving data is sparse (ASX200 only, limited detail)', live: false },
                { text: 'No eligibility matching — can\'t yet filter "grants I\'m eligible for"', live: false },
                { text: 'No automated grant expiry/archival pipeline', live: false },
              ].map((issue, i) => (
                <div key={i} className="border-l-4 border-bauhaus-red bg-white p-4 flex items-start gap-3">
                  <span className="text-bauhaus-red font-black text-sm mt-0.5">!</span>
                  <div>
                    <p className="text-sm font-medium text-bauhaus-black">{issue.text}</p>
                    {issue.live && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">Live count from database</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Roadmap */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-12">
        <h2 className="text-2xl font-black text-bauhaus-black mb-2">Roadmap</h2>
        <p className="text-sm text-bauhaus-muted mb-8 font-medium">
          What we&apos;re working on, in rough priority order.
        </p>
        <div className="space-y-3 max-w-2xl">
          {[
            { item: 'Social enterprise directory — aggregating ORIC, Social Traders, BuyAbility, B Corp', status: 'live' as const },
            { item: 'Social enterprise AI enrichment (3,500+ records)', status: 'building' as const },
            { item: 'Scale foundation enrichment (3,300+ with websites un-profiled)', status: 'building' as const },
            { item: 'Grant description enrichment via web scraping + AI', status: 'building' as const },
            { item: 'Foundation embeddings for semantic search', status: 'planned' as const },
            { item: 'State grant portal integration (NSW, VIC, WA, SA, TAS)', status: 'planned' as const },
            { item: 'Corporate giving deep-dive (beyond ASX200)', status: 'planned' as const },
            { item: 'Eligibility matcher — "grants I qualify for"', status: 'planned' as const },
            { item: 'Grant expiry detection and archival pipeline', status: 'planned' as const },
            { item: 'Public API for researchers and builders', status: 'planned' as const },
          ].map((r, i) => (
            <div key={i} className="border-4 border-bauhaus-black bg-white p-4 flex items-center justify-between gap-4">
              <span className="text-sm font-bold text-bauhaus-black">{r.item}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </section>

      {/* Get Involved */}
      <section className="border-t-4 border-bauhaus-black pt-12 pb-8">
        <h2 className="text-2xl font-black text-bauhaus-black mb-2">Get Involved</h2>
        <p className="text-sm text-bauhaus-muted mb-8 font-medium">
          Report issues, suggest data sources, or share ideas. No account needed.
        </p>

        <FeedbackForm />

        <div className="mt-10 pt-8 border-t-2 border-bauhaus-black/10 max-w-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">
            For developers
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`${GITHUB_REPO}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-black uppercase tracking-widest border-3 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-all"
            >
              GitHub Issues
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-black uppercase tracking-widest border-3 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-all"
            >
              View Source Code
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
