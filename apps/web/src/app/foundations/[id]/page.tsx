import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GivingHistoryChart } from './giving-chart';
import { GrantActionsProvider, GrantCardActions } from '@/app/components/grant-card-actions';
import { FoundationActionsProvider, FoundationCardActions } from '@/app/components/foundation-card-actions';
import { FoundationDetailActions } from './foundation-detail-actions';

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
  program_type: string | null;
  eligibility: string | null;
  application_process: string | null;
}

interface LinkedGrant {
  id: string;
  name: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  program_type: string | null;
  source: string | null;
  description: string | null;
}

interface AcncFinancials {
  abn: string;
  charity_name: string;
  ais_year: number;
  total_revenue: string | null;
  total_expenses: string | null;
  total_assets: string | null;
  grants_donations_au: string | null;
  grants_donations_intl: string | null;
  net_surplus_deficit: string | null;
  donations_and_bequests: string | null;
  revenue_from_investments: string | null;
  employee_expenses: string | null;
  net_assets_liabilities: string | null;
  charity_size: string | null;
  fin_report_from: string | null;
  fin_report_to: string | null;
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
    grantmaker: 'Grantmaker',
  };
  return type ? labels[type] || type : 'Foundation';
}

function confidenceBadge(c: string) {
  if (c === 'high') return { cls: 'border-money bg-money-light text-money', label: 'High' };
  if (c === 'medium') return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Medium' };
  return { cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted', label: 'Low' };
}

function programTypeBadge(type: string | null) {
  switch (type) {
    case 'fellowship': return { cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue', label: 'Fellowship' };
    case 'scholarship': return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Scholarship' };
    case 'award': return { cls: 'border-bauhaus-red bg-error-light text-bauhaus-red', label: 'Award' };
    case 'program': return { cls: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black', label: 'Program' };
    default: return { cls: 'border-money bg-money-light text-money', label: 'Grant' };
  }
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

  const [{ data: foundation }, { data: programs }, { data: linkedGrants }] = await Promise.all([
    supabase.from('foundations').select('*').eq('id', id).single(),
    supabase.from('foundation_programs').select('*').eq('foundation_id', id).in('status', ['open', 'closed']).order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('grant_opportunities').select('id, name, amount_min, amount_max, closes_at, program_type, source, description').eq('foundation_id', id).order('closes_at', { ascending: true, nullsFirst: false }),
  ]);

  if (!foundation) notFound();
  const f = foundation as FoundationDetail;

  // Fetch ACNC financials, similar foundations, and matching grants in parallel
  interface MatchingGrant {
    id: string;
    name: string;
    provider: string;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
  }

  const [{ data: acncData }, { data: similarData }, { data: matchingData }] = await Promise.all([
    supabase.from('acnc_ais')
      .select('abn, charity_name, ais_year, total_revenue, total_expenses, total_assets, grants_donations_au, grants_donations_intl, net_surplus_deficit, donations_and_bequests, revenue_from_investments, employee_expenses, net_assets_liabilities, charity_size, fin_report_from, fin_report_to')
      .eq('abn', f.acnc_abn)
      .order('ais_year', { ascending: false }),
    f.thematic_focus?.length > 0
      ? supabase.from('foundations')
          .select('id, name, total_giving_annual, profile_confidence, thematic_focus, type')
          .neq('id', f.id)
          .not('enriched_at', 'is', null)
          .overlaps('thematic_focus', f.thematic_focus)
          .order('total_giving_annual', { ascending: false, nullsFirst: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    f.thematic_focus?.length > 0
      ? supabase.from('grant_opportunities')
          .select('id, name, provider, amount_max, closes_at, categories')
          .overlaps('categories', f.thematic_focus)
          .gt('closes_at', new Date().toISOString())
          .order('closes_at', { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  const allAcnc: AcncFinancials[] = (acncData || []) as AcncFinancials[];
  const acncByYear = new Map<number, AcncFinancials>();
  for (const row of allAcnc) {
    const existing = acncByYear.get(row.ais_year);
    const rowAssets = Number(row.total_assets) || 0;
    const existingAssets = existing ? Number(existing.total_assets) || 0 : 0;
    if (!existing || rowAssets > existingAssets) {
      acncByYear.set(row.ais_year, row);
    }
  }
  const acncFinancials = Array.from(acncByYear.values())
    .filter(r => Number(r.total_assets) > 0)
    .sort((a, b) => b.ais_year - a.ais_year);

  const similarFoundations = (similarData || []) as SimilarFoundation[];
  const matchingGrants = (matchingData || []) as MatchingGrant[];

  // Optional: check if logged-in user's org has pipeline items with this foundation
  interface PipelineContext {
    orgName: string;
    orgSlug: string | null;
    items: Array<{ name: string; status: string; amount_display: string | null; deadline: string | null }>;
  }
  let pipelineContext: PipelineContext | null = null;
  try {
    const authSupabase = await createSupabaseServer();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (user) {
      const ctx = await getCurrentOrgProfileContext(supabase, user.id);
      if (ctx.orgProfileId && ctx.profile) {
        // Find pipeline items where funder_entity_id matches this foundation's entity
        const { data: pipelineItems } = await supabase.rpc('exec_sql', {
          query: `SELECT op.name, op.status, op.amount_display, op.deadline
             FROM org_pipeline op
             JOIN gs_entities ge ON ge.id = op.funder_entity_id
             WHERE op.org_profile_id = '${ctx.orgProfileId}'
               AND ge.abn = '${f.acnc_abn}'
             ORDER BY op.created_at DESC`,
        });
        if (pipelineItems && (pipelineItems as unknown[]).length > 0) {
          const { data: orgProfile } = await supabase
            .from('org_profiles')
            .select('slug')
            .eq('id', ctx.orgProfileId)
            .maybeSingle();
          pipelineContext = {
            orgName: ctx.profile.name,
            orgSlug: orgProfile?.slug ?? null,
            items: pipelineItems as PipelineContext['items'],
          };
        }
      }
    }
  } catch {
    // Auth check is optional — don't break the page
  }

  const badge = confidenceBadge(f.profile_confidence);
  const allPrograms = programs as ProgramRow[] || [];
  const allLinkedGrants = (linkedGrants || []) as LinkedGrant[];
  const hasFinancials = f.parent_company || f.asx_code || f.endowment_size || f.revenue_sources?.length > 0 || f.giving_ratio;

  // Group programs by type
  const programsByType = allPrograms.reduce((acc, p) => {
    const type = p.program_type || 'grant';
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {} as Record<string, ProgramRow[]>);

  return (
    <FoundationActionsProvider>
    <div className="max-w-4xl">
      <a href="/foundations" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Foundations
      </a>

      {/* Header */}
      <div className="mt-4 mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{f.name}</h1>
          <div className="flex items-center gap-3 flex-shrink-0">
            <FoundationCardActions foundationId={f.id} />
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
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

      {/* Pipeline Context Banner — shown when logged-in org has items with this foundation */}
      {pipelineContext && (
        <div className="mb-6 border-4 border-green-600 bg-green-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-green-800 mb-2">
                Your Pipeline with {f.name}
              </h3>
              <div className="space-y-1.5">
                {pipelineContext.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className={`text-[10px] px-2 py-0.5 font-bold border rounded-sm uppercase ${
                      item.status === 'awarded' ? 'bg-green-100 text-green-800 border-green-300' :
                      item.status === 'submitted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      item.status === 'drafting' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                      {item.status}
                    </span>
                    <span className="font-medium text-gray-800">{item.name}</span>
                    {item.amount_display && <span className="font-mono text-green-700 text-xs">{item.amount_display}</span>}
                    {item.deadline && <span className="text-gray-400 text-xs">Due {item.deadline}</span>}
                  </div>
                ))}
              </div>
            </div>
            {pipelineContext.orgSlug && (
              <Link
                href={`/org/${pipelineContext.orgSlug}`}
                className="text-xs px-3 py-2 bg-green-700 text-white font-bold uppercase tracking-wider hover:bg-green-800 transition-colors rounded-sm shrink-0"
              >
                {pipelineContext.orgName} Dashboard &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Key stats — adaptive, only show fields with data */}
      {(() => {
        const stats: Array<{ label: string; value: string; cls?: string; large?: boolean }> = [];
        stats.push({ label: 'Annual Giving', value: formatMoney(f.total_giving_annual), cls: 'text-money', large: true });
        if (f.grant_range_min || f.grant_range_max) {
          stats.push({ label: 'Grant Range', value: `${formatMoney(f.grant_range_min)} – ${formatMoney(f.grant_range_max)}` });
        }
        if (f.avg_grant_size) {
          stats.push({ label: 'Avg Grant', value: formatMoney(f.avg_grant_size) });
        }
        if (f.endowment_size) {
          stats.push({ label: 'Endowment', value: formatMoney(f.endowment_size) });
        }
        if (f.giving_ratio) {
          stats.push({ label: 'Giving Ratio', value: `${f.giving_ratio}%`, cls: 'text-bauhaus-blue' });
        }
        if (allPrograms.length > 0) {
          const openCount = allPrograms.filter(p => p.status === 'open').length;
          stats.push({ label: 'Programs', value: `${allPrograms.length}${openCount > 0 ? ` (${openCount} open)` : ''}` });
        }
        const cols = Math.min(stats.length, 5);
        return (
          <div className={`grid grid-cols-2 sm:grid-cols-${cols} gap-0 mb-8 border-4 border-bauhaus-black`}>
            {stats.map((s, i) => (
              <div key={s.label} className={`bg-white p-4 ${i < stats.length - 1 ? 'border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black' : ''}`}>
                <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">{s.label}</div>
                <div className={`${s.large ? 'text-2xl' : 'text-lg'} font-black tabular-nums ${s.cls || 'text-bauhaus-black'}`}>{s.value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {f.description && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{f.description}</p>
            </Section>
          )}

          {f.application_tips && (
            <Section title="Tips for Applicants">
              <div className="bg-money-light border-4 border-money p-4 bauhaus-shadow-sm">
                <p className="text-bauhaus-black leading-relaxed font-medium">{f.application_tips}</p>
              </div>
            </Section>
          )}

          {f.giving_philosophy && (
            <Section title="Giving Philosophy">
              <div className="bg-bauhaus-yellow border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
                <p className="text-bauhaus-black leading-relaxed italic font-medium">{f.giving_philosophy}</p>
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

          {acncFinancials.length > 0 && (
            <Section title="ACNC Financial History">
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th className="text-left text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Year</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Grants Given</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Revenue</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Total Assets</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Net Assets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acncFinancials.map((row, i) => {
                      const grantsAu = Number(row.grants_donations_au) || 0;
                      const grantsIntl = Number(row.grants_donations_intl) || 0;
                      const totalGrants = grantsAu + grantsIntl;
                      const maxGrants = Math.max(...acncFinancials.map(r => (Number(r.grants_donations_au) || 0) + (Number(r.grants_donations_intl) || 0)));
                      const barWidth = maxGrants > 0 ? (totalGrants / maxGrants) * 100 : 0;
                      return (
                        <tr key={row.ais_year} className={`border-b-2 border-bauhaus-black/10 ${i === 0 ? 'bg-money-light/30' : ''}`}>
                          <td className="py-2.5 px-2 font-black text-bauhaus-black">
                            FY{row.ais_year}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-bauhaus-black/5 hidden sm:block">
                                <div className="h-full bg-money" style={{ width: `${barWidth}%` }} />
                              </div>
                              <span className="font-black text-money tabular-nums whitespace-nowrap">
                                {totalGrants > 0 ? formatMoney(totalGrants) : '\u2014'}
                              </span>
                            </div>
                            {grantsIntl > 0 && (
                              <div className="text-[10px] text-bauhaus-muted mt-0.5">
                                {formatMoney(grantsAu)} AU + {formatMoney(grantsIntl)} intl
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-medium text-bauhaus-black tabular-nums whitespace-nowrap">
                            {Number(row.total_revenue) ? formatMoney(Number(row.total_revenue)) : '\u2014'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-medium text-bauhaus-black tabular-nums whitespace-nowrap">
                            {Number(row.total_assets) ? formatMoney(Number(row.total_assets)) : '\u2014'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-medium text-bauhaus-black tabular-nums whitespace-nowrap">
                            {Number(row.net_assets_liabilities) ? formatMoney(Number(row.net_assets_liabilities)) : '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-4 border-bauhaus-black">
                      <td className="py-2.5 px-2 font-black text-bauhaus-black text-xs uppercase tracking-wider">
                        {acncFinancials.length}yr total
                      </td>
                      <td className="py-2.5 px-2 text-right font-black text-money tabular-nums">
                        {formatMoney(acncFinancials.reduce((sum, r) => sum + (Number(r.grants_donations_au) || 0) + (Number(r.grants_donations_intl) || 0), 0))}
                      </td>
                      <td colSpan={3} className="py-2.5 px-2 text-right text-[10px] text-bauhaus-muted font-bold uppercase tracking-wider">
                        Source: ACNC Annual Information Statements
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          )}

          {allPrograms.length > 0 && (
            <Section title={`Programs & Opportunities (${allPrograms.length})`}>
              {/* Program type summary */}
              {Object.keys(programsByType).length > 1 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {Object.entries(programsByType).map(([type, progs]) => {
                    const tb = programTypeBadge(type);
                    return (
                      <span key={type} className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${tb.cls}`}>
                        {progs.length} {tb.label}{progs.length !== 1 ? 's' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="space-y-3">
                {allPrograms.map(p => {
                  const tb = programTypeBadge(p.program_type);
                  return (
                    <div key={p.id} className="bg-white border-4 border-bauhaus-black p-4 hover:-translate-y-1 bauhaus-shadow-sm transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-black text-bauhaus-black">{p.name}</h3>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <span className={`text-[11px] font-black px-2 py-0.5 uppercase tracking-wider border-2 ${tb.cls}`}>{tb.label}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 uppercase tracking-wider border-2 ${p.status === 'open' ? 'border-money bg-money-light text-money' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'}`}>{p.status}</span>
                        </div>
                      </div>
                      {p.description && <p className="text-sm text-bauhaus-muted mt-1.5 leading-relaxed font-medium">{p.description}</p>}
                      {p.eligibility && (
                        <div className="mt-2 text-sm">
                          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-wider">Eligibility: </span>
                          <span className="text-bauhaus-black font-medium">{p.eligibility}</span>
                        </div>
                      )}
                      {p.application_process && (
                        <div className="mt-1 text-sm">
                          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-wider">How to apply: </span>
                          <span className="text-bauhaus-black font-medium">{p.application_process}</span>
                        </div>
                      )}
                      <div className="text-xs text-bauhaus-muted mt-2 flex gap-4 flex-wrap font-bold">
                        {(p.amount_min || p.amount_max) && (
                          <span>{p.amount_min && p.amount_max ? `${formatMoney(p.amount_min)} – ${formatMoney(p.amount_max)}` : p.amount_max ? `Up to ${formatMoney(p.amount_max)}` : formatMoney(p.amount_min)}</span>
                        )}
                        {p.deadline && <span>Closes {new Date(p.deadline).toLocaleDateString('en-AU')}</span>}
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Apply &rarr;</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {allLinkedGrants.length > 0 && (
            <Section title={`Grants in Database (${allLinkedGrants.length})`}>
              <GrantActionsProvider>
              <div className="space-y-2">
                {allLinkedGrants.map(g => {
                  const tb = programTypeBadge(g.program_type);
                  const isExpired = g.closes_at && new Date(g.closes_at) < new Date();
                  return (
                    <a key={g.id} href={`/grants/${g.id}`} className="block bg-white border-4 border-bauhaus-black p-3 hover:-translate-y-0.5 bauhaus-shadow-sm transition-all group">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-black text-bauhaus-black text-sm group-hover:text-bauhaus-blue">{g.name}</h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-wider border-2 flex-shrink-0 ${tb.cls}`}>{tb.label}</span>
                      </div>
                      <div className="text-xs text-bauhaus-muted mt-1 flex gap-3 flex-wrap font-bold items-center">
                        {(g.amount_min || g.amount_max) && (
                          <span className="tabular-nums">{g.amount_min && g.amount_max ? `${formatMoney(g.amount_min)} – ${formatMoney(g.amount_max)}` : g.amount_max ? `Up to ${formatMoney(g.amount_max)}` : formatMoney(g.amount_min)}</span>
                        )}
                        {g.closes_at && (
                          <span className={isExpired ? 'text-bauhaus-muted line-through' : 'text-bauhaus-red'}>
                            {isExpired ? 'Closed' : `Closes ${new Date(g.closes_at).toLocaleDateString('en-AU')}`}
                          </span>
                        )}
                        {g.source && <span className="text-bauhaus-muted/50">{g.source}</span>}
                        <span className="ml-auto"><GrantCardActions grantId={g.id} /></span>
                      </div>
                    </a>
                  );
                })}
              </div>
              </GrantActionsProvider>
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
          <FoundationDetailActions foundationId={f.id} />

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
    </FoundationActionsProvider>
  );
}
