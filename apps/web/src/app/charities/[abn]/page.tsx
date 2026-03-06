import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface CharityDetail {
  abn: string;
  name: string;
  other_names: string | null;
  charity_size: string | null;
  pbi: boolean;
  hpc: boolean;
  registration_date: string | null;
  date_established: string | null;
  town_city: string | null;
  state: string | null;
  postcode: string | null;
  website: string | null;
  purposes: string[];
  beneficiaries: string[];
  operating_states: string[];
  is_foundation: boolean;
  total_revenue: number | null;
  total_expenses: number | null;
  total_assets: number | null;
  net_assets_liabilities: number | null;
  staff_fte: number | null;
  staff_volunteers: number | null;
  grants_donations_au: number | null;
  grants_donations_intl: number | null;
  total_grants_given: number | null;
  latest_financial_year: number | null;
  community_org_id: string | null;
  is_social_enterprise: boolean;
  enriched_description: string | null;
  enriched_domains: string[] | null;
  enriched_programs: Array<{ name: string; description?: string; outcomes?: string }> | null;
  enriched_outcomes: Array<{ metric: string; value: string; evidence_url?: string }> | null;
  admin_burden_hours: number | null;
  admin_burden_cost: number | null;
  annual_funding_received: number | null;
  enrichment_confidence: string | null;
  enriched_at: string | null;
}

interface AcncFinancials {
  abn: string;
  ais_year: number;
  total_revenue: string | null;
  total_expenses: string | null;
  total_assets: string | null;
  net_assets_liabilities: string | null;
  grants_donations_au: string | null;
  grants_donations_intl: string | null;
  staff_fte: string | null;
  staff_volunteers: string | null;
  donations_and_bequests: string | null;
  employee_expenses: string | null;
  charity_size: string | null;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function sizeBadgeClass(size: string | null): string {
  switch (size) {
    case 'Large': return 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red';
    case 'Medium': return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'Small': return 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted';
    default: return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
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

interface OrgProfile {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  mission: string | null;
  abn: string | null;
  website: string | null;
  domains: string[] | null;
  geographic_focus: string[] | null;
  org_type: string | null;
  annual_revenue: number | null;
  team_size: number | null;
  projects: Array<{ name: string; description?: string }> | null;
}

function orgTypeBadgeClass(orgType: string | null): string {
  switch (orgType) {
    case 'charity': return 'border-money bg-money-light text-money';
    case 'social_enterprise': return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'nfp': return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    case 'business': return 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-muted';
    default: return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

function formatOrgType(orgType: string | null): string {
  switch (orgType) {
    case 'charity': return 'Charity';
    case 'social_enterprise': return 'Social Enterprise';
    case 'nfp': return 'Not-for-Profit';
    case 'business': return 'Business';
    case 'government': return 'Government';
    default: return 'Organisation';
  }
}

function OrgProfileView({ profile, claimData, isClaimOwner }: { profile: OrgProfile; claimData: Record<string, unknown> | null; isClaimOwner: boolean }) {
  return (
    <div className="max-w-4xl">
      <a href="/charities" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Organisations
      </a>

      {/* Header */}
      <div className="mt-4 mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{profile.name}</h1>
          <div className="flex gap-1.5 flex-shrink-0">
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${orgTypeBadgeClass(profile.org_type)}`}>
              {formatOrgType(profile.org_type)}
            </span>
            {claimData && (
              <span className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-money bg-money-light text-money">Verified</span>
            )}
          </div>
        </div>
        <div className="text-sm text-bauhaus-muted flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
          {profile.abn && <span className="font-bold text-bauhaus-black">ABN {profile.abn}</span>}
          {profile.website && (
            <>
              {profile.abn && <span className="text-bauhaus-muted/30">|</span>}
              <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                {profile.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {(() => {
        const stats: Array<{ label: string; value: string }> = [];
        if (profile.team_size) stats.push({ label: 'Team Size', value: String(profile.team_size) });
        if (profile.annual_revenue) stats.push({ label: 'Annual Revenue', value: formatMoney(profile.annual_revenue) });
        if (stats.length === 0) return null;
        return (
          <div className={`grid grid-cols-${stats.length} gap-0 mb-8 border-4 border-bauhaus-black`}>
            {stats.map((s, i) => (
              <div key={s.label} className={`bg-white p-4 ${i < stats.length - 1 ? 'border-r-4 border-bauhaus-black' : ''}`}>
                <div className="text-[11px] text-bauhaus-muted mb-1 uppercase tracking-widest font-black">{s.label}</div>
                <div className="text-lg font-black tabular-nums text-bauhaus-black">{s.value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {(profile.description || profile.mission) && (
            <Section title="About">
              {profile.description && <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{profile.description}</p>}
              {profile.mission && (
                <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium mt-3">
                  <span className="font-black text-bauhaus-black">Mission:</span> {profile.mission}
                </p>
              )}
            </Section>
          )}

          {profile.projects && Array.isArray(profile.projects) && profile.projects.length > 0 && (
            <Section title={`Projects (${profile.projects.length})`}>
              <div className="space-y-3">
                {profile.projects.map((p, i) => (
                  <div key={i} className="bg-white border-4 border-bauhaus-black p-4">
                    <h3 className="font-black text-bauhaus-black">{p.name}</h3>
                    {p.description && <p className="text-sm text-bauhaus-muted mt-1.5 leading-relaxed font-medium">{p.description}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Focus Areas */}
          {((profile.domains && profile.domains.length > 0) || (profile.geographic_focus && profile.geographic_focus.length > 0)) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Focus Areas</h3>
              {profile.domains && profile.domains.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {profile.domains.map(d => (
                    <span key={d} className="text-xs px-2.5 py-1 bg-money-light text-money font-black border-2 border-money/20 capitalize">{d.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
              {profile.geographic_focus && profile.geographic_focus.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs text-bauhaus-muted mb-1.5 font-black uppercase tracking-wider">Geographic Focus</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {profile.geographic_focus.map(g => (
                      <span key={g} className="text-xs px-2.5 py-1 bg-link-light text-bauhaus-blue font-black border-2 border-bauhaus-blue/20">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Claim CTA / Edit Link */}
          {isClaimOwner ? (
            <div className="bg-green-50 border-4 border-money p-4">
              <h3 className="text-xs font-black text-money mb-2 uppercase tracking-widest">Your Profile</h3>
              <p className="text-sm text-bauhaus-black/70 font-medium mb-3">
                You manage this organisation&apos;s profile on GrantScope.
              </p>
              <a
                href="/profile"
                className="block text-center px-4 py-2.5 bg-money text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
              >
                Edit Profile
              </a>
            </div>
          ) : (
            <div className="bg-bauhaus-yellow border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Is this your organisation?</h3>
              <p className="text-sm text-bauhaus-black/70 font-medium mb-3">
                Claim this profile to update your information, share your story, and get featured.
              </p>
              <a
                href={`/charities/claim?abn=${profile.abn}`}
                className="block text-center px-4 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
              >
                Claim This Profile
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function CharityDetailPage({ params }: { params: Promise<{ abn: string }> }) {
  const { abn } = await params;
  const supabase = getServiceSupabase();

  const { data: charity } = await supabase
    .from('v_charity_detail')
    .select('*')
    .eq('abn', abn)
    .single();

  // If not in ACNC, check org_profiles for this ABN
  // org_profiles may store ABN with spaces (e.g. "21 591 780 066") while URL uses no spaces
  if (!charity) {
    const abnWithSpaces = abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
    const { data: orgProfile } = await supabase
      .from('org_profiles')
      .select('*')
      .or(`abn.eq.${abn},abn.eq.${abnWithSpaces}`)
      .limit(1)
      .maybeSingle();

    if (!orgProfile) notFound();
    const profile = orgProfile as OrgProfile;

    // Fetch verified claim for this ABN
    const { data: claimData } = await supabase
      .from('charity_claims')
      .select('*')
      .eq('abn', abn)
      .eq('status', 'verified')
      .maybeSingle();

    let isClaimOwner = false;
    try {
      const userSupabase = await createSupabaseServer();
      const { data: { user } } = await userSupabase.auth.getUser();
      if (user && claimData && claimData.user_id === user.id) {
        isClaimOwner = true;
      }
    } catch {
      // Not logged in
    }

    return <OrgProfileView profile={profile} claimData={claimData} isClaimOwner={isClaimOwner} />;
  }

  const c = charity as CharityDetail;

  const isEnriched = !!c.community_org_id;

  // Fetch ACNC financial history
  const { data: acncData } = await supabase
    .from('acnc_ais')
    .select('abn, ais_year, total_revenue, total_expenses, total_assets, net_assets_liabilities, grants_donations_au, grants_donations_intl, staff_fte, staff_volunteers, donations_and_bequests, employee_expenses, charity_size')
    .eq('abn', abn)
    .order('ais_year', { ascending: false });

  const allAcnc = (acncData || []) as AcncFinancials[];
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
    .filter(r => Number(r.total_revenue) > 0 || Number(r.total_assets) > 0)
    .sort((a, b) => b.ais_year - a.ais_year);

  // Fetch verified claim for this ABN
  const { data: claimData } = await supabase
    .from('charity_claims')
    .select('*')
    .eq('abn', abn)
    .eq('status', 'verified')
    .maybeSingle();

  // Check if current user owns the claim
  let isClaimOwner = false;
  try {
    const userSupabase = await createSupabaseServer();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (user && claimData && claimData.user_id === user.id) {
      isClaimOwner = true;
    }
  } catch {
    // Not logged in — fine
  }

  // Use claimed description if available, then enriched, then generated
  const aboutText = claimData?.profile_description || c.enriched_description || generateAbout(c);

  return (
    <div className="max-w-4xl">
      <a href="/charities" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to Charities
      </a>

      {/* Header */}
      <div className="mt-4 mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{c.name}</h1>
          <div className="flex gap-1.5 flex-shrink-0">
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${sizeBadgeClass(c.charity_size)}`}>
              {c.charity_size || 'Unknown'}
            </span>
            {c.pbi && (
              <span className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-money bg-money-light text-money">PBI</span>
            )}
            {c.hpc && (
              <span className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">HPC</span>
            )}
            {c.is_social_enterprise && (
              <a href="/social-enterprises" className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors">Social Enterprise</a>
            )}
            {isEnriched && (
              <span className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-bauhaus-yellow bg-warning-light text-bauhaus-black">Enriched</span>
            )}
            {claimData?.featured && (
              <span className="text-[11px] px-2 py-1 font-black uppercase tracking-widest border-2 border-bauhaus-red bg-bauhaus-red text-white">Featured</span>
            )}
          </div>
        </div>
        <div className="text-sm text-bauhaus-muted flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
          <span className="font-bold text-bauhaus-black">ABN {c.abn}</span>
          {c.town_city && c.state && (
            <>
              <span className="text-bauhaus-muted/30">|</span>
              <span>{c.town_city}, {c.state} {c.postcode}</span>
            </>
          )}
          {c.website && (
            <>
              <span className="text-bauhaus-muted/30">|</span>
              <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">
                {c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </>
          )}
          <a href={`https://www.acnc.gov.au/charity/charities?search=${encodeURIComponent(c.abn)}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red text-xs font-black uppercase tracking-wider">
            ACNC Register &rarr;
          </a>
        </div>
      </div>

      {/* Stats grid */}
      {(() => {
        const stats: Array<{ label: string; value: string; cls?: string; large?: boolean }> = [];
        if (c.total_revenue) stats.push({ label: 'Revenue', value: formatMoney(Number(c.total_revenue)), cls: 'text-money', large: true });
        if (c.total_assets) stats.push({ label: 'Total Assets', value: formatMoney(Number(c.total_assets)) });
        if (c.staff_fte) stats.push({ label: 'Staff FTE', value: String(Math.round(Number(c.staff_fte))) });
        if (c.staff_volunteers) stats.push({ label: 'Volunteers', value: Number(c.staff_volunteers).toLocaleString() });
        if (isEnriched && c.admin_burden_cost) {
          stats.push({ label: 'Admin Burden', value: formatMoney(c.admin_burden_cost), cls: 'text-bauhaus-red' });
          if (c.total_revenue && Number(c.total_revenue) > 0) {
            const pct = Math.round((c.admin_burden_cost / Number(c.total_revenue)) * 100);
            stats.push({ label: 'Admin % Revenue', value: `${pct}%`, cls: 'text-bauhaus-red' });
          }
        }
        if (stats.length === 0) return null;
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
          {aboutText && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{aboutText}</p>
            </Section>
          )}

          {/* Their Story (claimed) */}
          {claimData?.profile_story && (
            <Section title="Their Story">
              <p className="text-bauhaus-muted leading-relaxed text-[15px] font-medium">{claimData.profile_story}</p>
            </Section>
          )}

          {/* Programs (enriched) */}
          {isEnriched && c.enriched_programs && Array.isArray(c.enriched_programs) && c.enriched_programs.length > 0 && (
            <Section title={`Programs (${c.enriched_programs.length})`}>
              <div className="space-y-3">
                {c.enriched_programs.map((p, i) => (
                  <div key={i} className="bg-white border-4 border-bauhaus-black p-4">
                    <h3 className="font-black text-bauhaus-black">{p.name}</h3>
                    {p.description && <p className="text-sm text-bauhaus-muted mt-1.5 leading-relaxed font-medium">{p.description}</p>}
                    {p.outcomes && <p className="text-xs text-money mt-1 font-bold">Outcomes: {p.outcomes}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Outcomes (enriched) */}
          {isEnriched && c.enriched_outcomes && Array.isArray(c.enriched_outcomes) && c.enriched_outcomes.length > 0 && (
            <Section title="Outcomes">
              <div className="space-y-2">
                {c.enriched_outcomes.map((o, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white border-4 border-bauhaus-black px-4 py-2.5">
                    <span className="text-money font-black mt-0.5">&#9632;</span>
                    <div>
                      <span className="text-bauhaus-black text-sm font-bold">{o.metric}: </span>
                      <span className="text-bauhaus-muted text-sm font-medium">{o.value}</span>
                      {o.evidence_url && (
                        <a href={o.evidence_url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue text-xs ml-2 hover:text-bauhaus-red font-black uppercase tracking-wider">Source &rarr;</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ACNC Financial History */}
          {acncFinancials.length > 0 && (
            <Section title="ACNC Financial History">
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th className="text-left text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Year</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Revenue</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Expenses</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Assets</th>
                      <th className="text-right text-[11px] font-black uppercase tracking-widest text-bauhaus-muted py-2 px-2">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acncFinancials.map((row, i) => (
                      <tr key={row.ais_year} className={`border-b-2 border-bauhaus-black/10 ${i === 0 ? 'bg-money-light/30' : ''}`}>
                        <td className="py-2.5 px-2 font-black text-bauhaus-black">FY{row.ais_year}</td>
                        <td className="py-2.5 px-2 text-right font-medium text-bauhaus-black tabular-nums whitespace-nowrap">
                          {Number(row.total_revenue) ? formatMoney(Number(row.total_revenue)) : '\u2014'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-bauhaus-black tabular-nums whitespace-nowrap">
                          {Number(row.total_expenses) ? formatMoney(Number(row.total_expenses)) : '\u2014'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-bauhaus-black tabular-nums whitespace-nowrap">
                          {Number(row.total_assets) ? formatMoney(Number(row.total_assets)) : '\u2014'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-bauhaus-muted tabular-nums whitespace-nowrap">
                          {Number(row.staff_fte) ? `${Math.round(Number(row.staff_fte))} FTE` : ''}
                          {Number(row.staff_fte) && Number(row.staff_volunteers) ? ' + ' : ''}
                          {Number(row.staff_volunteers) ? `${Number(row.staff_volunteers).toLocaleString()} vol` : ''}
                          {!Number(row.staff_fte) && !Number(row.staff_volunteers) ? '\u2014' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-4 border-bauhaus-black">
                      <td className="py-2.5 px-2 font-black text-bauhaus-black text-xs uppercase tracking-wider">
                        {acncFinancials.length}yr history
                      </td>
                      <td colSpan={4} className="py-2.5 px-2 text-right text-[10px] text-bauhaus-muted font-bold uppercase tracking-wider">
                        Source: ACNC Annual Information Statements
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Focus Areas */}
          {(c.purposes?.length > 0 || c.beneficiaries?.length > 0) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Focus Areas</h3>
              {c.purposes?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {c.purposes.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 bg-money-light text-money font-black border-2 border-money/20">{t}</span>
                  ))}
                </div>
              )}
              {c.beneficiaries?.length > 0 && (
                <div>
                  <div className="text-xs text-bauhaus-muted mb-1.5 font-black uppercase tracking-wider">Beneficiaries</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {c.beneficiaries.map(b => (
                      <span key={b} className="text-xs px-2.5 py-1 bg-bauhaus-canvas text-bauhaus-muted font-bold border border-bauhaus-black/10">{b}</span>
                    ))}
                  </div>
                </div>
              )}
              {c.operating_states?.length > 0 && (
                <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20">
                  <div className="text-xs text-bauhaus-muted mb-1.5 font-black uppercase tracking-wider">
                    {c.operating_states.length >= 8 ? 'Operates Nationally' : 'Operates In'}
                  </div>
                  {c.operating_states.length < 8 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {c.operating_states.map(s => (
                        <span key={s} className="text-xs px-2.5 py-1 bg-link-light text-bauhaus-blue font-black border-2 border-bauhaus-blue/20">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Admin Burden (enriched) */}
          {isEnriched && c.admin_burden_cost && (
            <div className="bg-bauhaus-red text-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black mb-3 uppercase tracking-widest">Admin Burden</h3>
              <div className="text-2xl font-black tabular-nums">{formatMoney(c.admin_burden_cost)}</div>
              <div className="text-xs font-bold text-white/70 mt-1">estimated annual admin cost</div>
              {c.admin_burden_hours && (
                <div className="mt-2 text-sm font-bold">{Math.round(c.admin_burden_hours)} hours/year on compliance</div>
              )}
              {c.total_revenue && Number(c.total_revenue) > 0 && (
                <div className="mt-2 pt-2 border-t border-white/20 text-sm font-black">
                  {Math.round((c.admin_burden_cost / Number(c.total_revenue)) * 100)}% of revenue goes to admin
                </div>
              )}
            </div>
          )}

          {/* Enriched Domains */}
          {isEnriched && c.enriched_domains && c.enriched_domains.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-3 uppercase tracking-widest">Domains</h3>
              <div className="flex gap-1.5 flex-wrap">
                {c.enriched_domains.map(d => (
                  <span key={d} className="text-xs px-2.5 py-1 bg-bauhaus-canvas text-bauhaus-black font-black uppercase tracking-wider border-2 border-bauhaus-black/20 capitalize">
                    {d.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Claim CTA / Edit Link */}
          {isClaimOwner ? (
            <div className="bg-green-50 border-4 border-money p-4">
              <h3 className="text-xs font-black text-money mb-2 uppercase tracking-widest">Your Profile</h3>
              <p className="text-sm text-bauhaus-black/70 font-medium mb-3">
                You manage this charity&apos;s profile on GrantScope.
              </p>
              <a
                href={`/charities/${c.abn}/edit`}
                className="block text-center px-4 py-2.5 bg-money text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
              >
                Edit Profile
              </a>
            </div>
          ) : (
            <div className="bg-bauhaus-yellow border-4 border-bauhaus-black p-4">
              <h3 className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Is this your organisation?</h3>
              <p className="text-sm text-bauhaus-black/70 font-medium mb-3">
                Claim this profile to update your information, share your story, and get featured.
              </p>
              <a
                href={`/charities/claim?abn=${c.abn}`}
                className="block text-center px-4 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
              >
                Claim This Profile
              </a>
            </div>
          )}

          {/* Data Sources */}
          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4 text-xs text-bauhaus-muted space-y-1.5 font-medium">
            <h3 className="text-xs font-black text-bauhaus-black mb-2 uppercase tracking-widest">Data Sources</h3>
            {isEnriched && (
              <div>Enrichment: <span className="font-black text-money">{c.enrichment_confidence}</span></div>
            )}
            {c.enriched_at && <div>Last enriched: {new Date(c.enriched_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</div>}
            {c.registration_date && <div>Registered: {new Date(c.registration_date).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</div>}
            {c.latest_financial_year && <div>Latest financials: FY{c.latest_financial_year}</div>}
            <a href={`https://www.acnc.gov.au/charity/charities?search=${encodeURIComponent(c.abn)}`} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:text-bauhaus-red block mt-2 font-black uppercase tracking-wider">
              View on ACNC Register &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateAbout(c: CharityDetail): string | null {
  const parts: string[] = [];
  if (c.purposes?.length > 0) {
    parts.push(`${c.name} is a ${(c.charity_size || '').toLowerCase()} charity focused on ${c.purposes.join(', ').toLowerCase()}.`);
  }
  if (c.beneficiaries?.length > 0) {
    parts.push(`It serves ${c.beneficiaries.join(', ').toLowerCase()}.`);
  }
  if (c.operating_states?.length > 0) {
    if (c.operating_states.length >= 8) {
      parts.push('It operates nationally across all states and territories.');
    } else {
      parts.push(`It operates in ${c.operating_states.join(', ')}.`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
