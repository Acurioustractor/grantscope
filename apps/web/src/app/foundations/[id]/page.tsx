import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { GivingHistoryChart } from './giving-chart';

export const dynamic = 'force-dynamic';

interface FoundationDetail {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  description: string | null;
  acnc_abn: string;
  total_giving_annual: number | null;
  giving_history: Array<{ year: number; amount: number }> | null;
  avg_grant_size: number | null;
  grant_range_min: number | null;
  grant_range_max: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  target_recipients: string[];
  endowment_size: number | null;
  investment_returns: number | null;
  giving_ratio: number | null;
  revenue_sources: string[];
  parent_company: string | null;
  asx_code: string | null;
  open_programs: Array<{ name: string; url?: string; amount?: number; deadline?: string; description?: string }> | null;
  profile_confidence: string;
  giving_philosophy: string | null;
  wealth_source: string | null;
  application_tips: string | null;
  notable_grants: string[] | null;
  board_members: string[] | null;
  enriched_at: string | null;
  scraped_urls: string[] | null;
  created_at: string;
}

interface ProgramRow {
  id: string;
  name: string;
  url: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  status: string;
  categories: string[];
}

interface SimilarFoundation {
  id: string;
  name: string;
  total_giving_annual: number | null;
  profile_confidence: string;
  thematic_focus: string[];
  type: string | null;
}

function formatMoney(amount: number | null): string {
  if (!amount) return 'Unknown';
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
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

function confidenceBadge(c: string) {
  if (c === 'high') return { cls: 'border-money bg-money-light text-money', label: 'High' };
  if (c === 'medium') return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Medium' };
  return { cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted', label: 'Low' };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function FoundationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const [{ data: foundation }, { data: programs }] = await Promise.all([
    supabase.from('foundations').select('*').eq('id', id).single(),
    supabase.from('foundation_programs').select('*').eq('foundation_id', id).order('deadline', { ascending: true, nullsFirst: false }),
  ]);

  if (!foundation) notFound();
  const f = foundation as FoundationDetail;

  let similarFoundations: SimilarFoundation[] = [];
  if (f.thematic_focus?.length > 0) {
    const { data: similar } = await supabase
      .from('foundations')
      .select('id, name, total_giving_annual, profile_confidence, thematic_focus, type')
      .neq('id', f.id)
      .not('enriched_at', 'is', null)
      .overlaps('thematic_focus', f.thematic_focus)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(6);
    similarFoundations = (similar || []) as SimilarFoundation[];
  }

  // Matching grants — grants whose categories overlap with this foundation's thematic focus
  interface MatchingGrant {
    id: string;
    name: string;
    provider: string;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
  }
  let matchingGrants: MatchingGrant[] = [];
  if (f.thematic_focus?.length > 0) {
    const { data: grants } = await supabase
      .from('grant_opportunities')
      .select('id, name, provider, amount_max, closes_at, categories')
      .overlaps('categories', f.thematic_focus)
      .gt('closes_at', new Date().toISOString())
      .order('closes_at', { ascending: true })
      .limit(8);
    matchingGrants = (grants || []) as MatchingGrant[];
  }

  const badge = confidenceBadge(f.profile_confidence);
  const allPrograms = programs as ProgramRow[] || [];
  const hasFinancials = f.parent_company || f.asx_code || f.endowment_size || f.revenue_sources?.length > 0 || f.giving_ratio;

  return (
    <div className="max-w-4xl">
      <a href="/foundations" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Foundations
      </a>

      {/* Header */}
      <div className="mt-4 mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{f.name}</h1>
          <span className={`text-[11px] font-black px-2.5 py-1 flex-shrink-0 border-2 uppercase tracking-widest ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="text-sm text-bauhaus-muted flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
          <span className="font-bold text-bauhaus-black">{typeLabel(f.type)}</span>
          <span className="text-bauhaus-muted/30">|</span>
          <span>ABN {f.acnc_abn}</span>
          {f.website && (
            <>
              <span className="text-bauhaus-muted/30">|</span>
              <a href={f.website.startsWith('http') ? f.website : `https://${f.website}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                {f.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </>
          )}
          <a href={`https://www.acnc.gov.au/charity/charities?search=${encodeURIComponent(f.acnc_abn)}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red text-xs font-black uppercase tracking-wider">
            ACNC Register &rarr;
          </a>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black sm:col-span-1">
          <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">Annual Giving</div>
          <div className="text-2xl font-black text-money tabular-nums">{formatMoney(f.total_giving_annual)}</div>
        </div>
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">Avg Grant</div>
          <div className="text-lg font-black text-bauhaus-black tabular-nums">{formatMoney(f.avg_grant_size)}</div>
        </div>
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">Grant Range</div>
          <div className="text-sm font-black text-bauhaus-black tabular-nums">
            {f.grant_range_min || f.grant_range_max
              ? `${formatMoney(f.grant_range_min)} – ${formatMoney(f.grant_range_max)}`
              : '\u2014'}
          </div>
        </div>
        <div className="bg-white p-4 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
          <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">Giving Ratio</div>
          <div className={`text-lg font-black tabular-nums ${f.giving_ratio ? 'text-bauhaus-blue' : 'text-bauhaus-muted/30'}`}>
            {f.giving_ratio ? `${f.giving_ratio}%` : '\u2014'}
          </div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">Endowment</div>
          <div className="text-lg font-black text-bauhaus-black tabular-nums">{f.endowment_size ? formatMoney(f.endowment_size) : '\u2014'}</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {f.description && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{f.description}</p>
            </Section>
          )}

          {f.giving_philosophy && (
            <Section title="Giving Philosophy">
              <div className="bg-bauhaus-yellow border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
                <p className="text-bauhaus-black leading-relaxed italic font-medium">{f.giving_philosophy}</p>
              </div>
            </Section>
          )}

          {f.application_tips && (
            <Section title="Tips for Applicants">
              <div className="bg-money-light border-4 border-money p-4 bauhaus-shadow-sm">
                <p className="text-bauhaus-black leading-relaxed font-medium">{f.application_tips}</p>
              </div>
            </Section>
          )}

          {f.notable_grants && f.notable_grants.length > 0 && (
            <Section title="Notable Grants">
              <div className="space-y-2">
                {f.notable_grants.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white border-4 border-bauhaus-black px-4 py-2.5">
                    <span className="text-bauhaus-red font-black mt-0.5">&#9632;</span>
                    <span className="text-bauhaus-black text-sm font-medium">{g}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {f.giving_history && f.giving_history.length > 1 && (
            <Section title="Giving History">
              <GivingHistoryChart history={f.giving_history} />
            </Section>
          )}

          {f.giving_history && f.giving_history.length === 1 && (
            <Section title="Giving History">
              <div className="flex gap-3 flex-wrap">
                {f.giving_history.map(entry => (
                  <div key={entry.year} className="bg-white border-4 border-bauhaus-black px-4 py-3 text-center">
                    <div className="text-xs text-bauhaus-muted font-black">{entry.year}</div>
                    <div className="text-lg font-black text-bauhaus-black tabular-nums">{formatMoney(entry.amount)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {allPrograms.length > 0 && (
            <Section title={`Open Programs (${allPrograms.length})`}>
              <div className="space-y-3">
                {allPrograms.map(p => (
                  <div key={p.id} className="bg-white border-4 border-bauhaus-black p-4 hover:-translate-y-1 bauhaus-shadow-sm transition-all">
                    <div className="flex justify-between items-start">
                      <h3 className="font-black text-bauhaus-black">{p.name}</h3>
                      <span className={`text-[11px] font-black px-2 py-0.5 uppercase tracking-wider border-2 ${p.status === 'open' ? 'border-money bg-money-light text-money' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'}`}>{p.status}</span>
                    </div>
                    {p.description && <p className="text-sm text-bauhaus-muted mt-1.5 leading-relaxed font-medium">{p.description}</p>}
                    <div className="text-xs text-bauhaus-muted mt-2 flex gap-4 flex-wrap font-bold">
                      {p.amount_max && <span>Up to {formatMoney(p.amount_max)}</span>}
                      {p.deadline && <span>Closes {new Date(p.deadline).toLocaleDateString('en-AU')}</span>}
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Apply &rarr;</a>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {f.open_programs && f.open_programs.length > 0 && !allPrograms.length && (
            <Section title="Programs (from website)">
              <div className="space-y-3">
                {f.open_programs.map((p, i) => (
                  <div key={i} className="bg-white border-4 border-bauhaus-black p-4">
                    <h3 className="font-black text-bauhaus-black">{p.name}</h3>
                    {p.description && <p className="text-sm text-bauhaus-muted mt-1.5 leading-relaxed font-medium">{p.description}</p>}
                    <div className="text-xs text-bauhaus-muted mt-2 flex gap-4 flex-wrap font-bold">
                      {p.amount && <span>Up to {formatMoney(p.amount)}</span>}
                      {p.deadline && <span>Deadline: {p.deadline}</span>}
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red">More info &rarr;</a>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Focus Areas</h3>
              <div className="flex gap-1.5 flex-wrap">
                {f.thematic_focus?.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 bg-money-light text-money font-black border-2 border-money/20">
                    {t.replace('_', ' ')}
                  </span>
                ))}
              </div>
              {f.geographic_focus?.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs text-bauhaus-muted mb-1.5 font-black uppercase tracking-wider">Geographic</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {f.geographic_focus.map(g => (
                      <span key={g} className="text-xs px-2.5 py-1 bg-link-light text-bauhaus-blue font-black border-2 border-bauhaus-blue/20">{g}</span>
                    ))}
                  </div>
                </div>
              )}
              {f.target_recipients?.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs text-bauhaus-muted mb-1.5 font-black uppercase tracking-wider">Recipients</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {f.target_recipients.map(r => (
                      <span key={r} className="text-xs px-2.5 py-1 bg-warning-light text-bauhaus-black font-black border-2 border-bauhaus-yellow/30">{r.replace('_', ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(f.wealth_source || hasFinancials) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Financial Details</h3>
              <div className="space-y-2.5 text-sm">
                {f.wealth_source && (
                  <div>
                    <div className="text-xs text-bauhaus-muted font-black uppercase tracking-wider">Source of Wealth</div>
                    <div className="text-bauhaus-black font-medium">{f.wealth_source}</div>
                  </div>
                )}
                {f.parent_company && (
                  <div>
                    <div className="text-xs text-bauhaus-muted font-black uppercase tracking-wider">Parent Company</div>
                    <div className="text-bauhaus-black font-black">{f.parent_company}{f.asx_code ? ` (ASX: ${f.asx_code})` : ''}</div>
                  </div>
                )}
                {f.revenue_sources?.length > 0 && (
                  <div>
                    <div className="text-xs text-bauhaus-muted font-black uppercase tracking-wider">Revenue Sources</div>
                    <div className="text-bauhaus-black font-medium">{f.revenue_sources.join(', ')}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {f.board_members && f.board_members.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Board &amp; Leadership</h3>
              <div className="space-y-1.5">
                {f.board_members.map((m, i) => (
                  <div key={i} className="text-sm text-bauhaus-muted flex items-center gap-2 font-medium">
                    <span className="w-2 h-2 bg-bauhaus-red flex-shrink-0"></span>
                    {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingGrants.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Matching Grants</h3>
              <div className="space-y-2">
                {matchingGrants.map(mg => (
                  <a key={mg.id} href={`/grants/${mg.id}`} className="block hover:bg-bauhaus-blue hover:text-white p-2 -mx-2 transition-colors border-b-2 border-bauhaus-black/10 last:border-0 group">
                    <div className="text-sm font-bold text-bauhaus-black leading-tight group-hover:text-white">{mg.name.length > 50 ? mg.name.slice(0, 50) + '\u2026' : mg.name}</div>
                    <div className="text-xs text-bauhaus-muted mt-0.5 font-medium group-hover:text-white/70 flex justify-between">
                      <span>{mg.provider}</span>
                      {mg.amount_max && <span className="font-black tabular-nums">{formatMoney(mg.amount_max)}</span>}
                    </div>
                    {mg.closes_at && (
                      <div className="text-[10px] text-bauhaus-red font-black mt-0.5 group-hover:text-bauhaus-yellow">
                        Closes {new Date(mg.closes_at).toLocaleDateString('en-AU')}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {similarFoundations.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Similar Foundations</h3>
              <div className="space-y-2">
                {similarFoundations.map(sf => (
                  <a key={sf.id} href={`/foundations/${sf.id}`} className="block hover:bg-bauhaus-canvas p-2 -mx-2 transition-colors border-b-2 border-bauhaus-black/10 last:border-0">
                    <div className="text-sm font-bold text-bauhaus-black leading-tight">{sf.name.length > 45 ? sf.name.slice(0, 45) + '\u2026' : sf.name}</div>
                    <div className="text-xs text-bauhaus-muted mt-0.5 font-medium">
                      {sf.total_giving_annual ? formatMoney(sf.total_giving_annual) + '/yr' : typeLabel(sf.type)}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4 text-xs text-bauhaus-muted space-y-1.5 font-medium">
            <h3 className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Data Sources</h3>
            <div>Profile quality: <span className={`font-black ${f.profile_confidence === 'high' ? 'text-money' : f.profile_confidence === 'medium' ? 'text-bauhaus-yellow' : 'text-bauhaus-muted'}`}>{f.profile_confidence}</span></div>
            {f.enriched_at && <div>Last profiled: {new Date(f.enriched_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</div>}
            {f.scraped_urls && f.scraped_urls.length > 0 && <div>Website pages scraped: {f.scraped_urls.length}</div>}
            <div>Added: {new Date(f.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <a href={`https://www.acnc.gov.au/charity/charities?search=${encodeURIComponent(f.acnc_abn)}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red block mt-2 font-black uppercase tracking-wider">
              View on ACNC Register &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
