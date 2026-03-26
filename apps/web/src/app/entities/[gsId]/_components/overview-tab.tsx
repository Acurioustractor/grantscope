import Link from 'next/link';
import { CommunityEvidence } from '../impact-stories';
import { ProcurementWorkspaceCard } from '../procurement-workspace-card';
import { decisionTagBadgeClass, decisionTagLabel } from '@/lib/procurement-shortlist';
import { Section } from './section';
import { formatMoney, formatPercent, entityTypeLabel, entityTypeBadge, relTypeLabel, datasetLabel } from '../_lib/formatters';
import type {
  Entity, MvEntityStats, EntityEnrichment, WorkspaceContext,
} from '../_lib/types';

interface OverviewTabProps {
  entity: Entity;
  stats: MvEntityStats | null;
  enrichment: EntityEnrichment;
  workspace: WorkspaceContext;
  preferredShortlistId: string | null;
}

export function OverviewTab({ entity: e, stats, enrichment, workspace }: OverviewTabProps) {
  const {
    foundation, foundationPrograms, charity, socialEnterprise,
    financialYears, placeGeo, seifa, postcodeEntityCount,
    governedProofBundle, governedProofPack, governedProofStrengths,
    disabilityRelevant,
    ndisStateSupplyTotal, ndisStateDistricts, ndisStateHotspots,
    ndisThinDistrictCount, ndisVeryThinDistrictCount,
    localDisabilityEnterpriseCount, localCommunityControlledCount,
    ndisSourceLink,
    jhOrg, almaInterventionCount, almaEvidenceCount,
    personRoles,
  } = enrichment;

  const {
    isPremium, workspaceOrgName, canEditWorkspace,
    workspaceShortlists, workspaceMemberships, workspaceTasks,
  } = workspace;

  const leadWorkspaceMembership = (workspaceMemberships[0] as Record<string, unknown>) || null;
  const workspaceOpenTasks = workspaceTasks.filter((task: Record<string, unknown>) => task.status !== 'done');
  const workspaceUrgentTasks = workspaceOpenTasks.filter(
    (task: Record<string, unknown>) => task.priority === 'critical' || task.priority === 'high',
  );

  // Compute contract stats from MV for workspace card
  const contractBreakdown = stats?.type_breakdown['contract:inbound'] || stats?.type_breakdown['contract:outbound'];
  const contractCount = contractBreakdown?.count ?? 0;
  const totalContractValue = contractBreakdown?.amount ?? 0;

  const roleLabel = (r: string, props: Record<string, string> | null) => {
    if (props?.title) return props.title;
    if (r === 'ceo') return 'Chief Executive Officer';
    if (r === 'cfo') return 'Chief Financial Officer';
    if (r === 'chair') return 'Chair';
    return r.replace(/_/g, ' ');
  };

  return (
    <>
      {/* Person Roles — Board Seats & Positions */}
      {personRoles.length > 0 && (
        <Section title="Board Seats & Positions">
          <p className="text-sm text-bauhaus-muted mb-4">
            {e.canonical_name} holds {personRoles.length} role{personRoles.length !== 1 ? 's' : ''} across {new Set(personRoles.map((r) => r.company_name)).size} organisation{new Set(personRoles.map((r) => r.company_name)).size !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {personRoles.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-2 border-bauhaus-black p-3">
                <div>
                  <div className="font-black">
                    {r.entity_gs_id ? (
                      <Link href={`/entities/${r.entity_gs_id}`} className="hover:text-bauhaus-red">
                        {r.company_name}
                      </Link>
                    ) : (
                      r.company_name
                    )}
                  </div>
                  {r.company_abn && (
                    <span className="text-xs text-bauhaus-muted font-mono">ABN {r.company_abn}</span>
                  )}
                </div>
                <span className="text-xs font-black uppercase tracking-wider bg-gray-100 px-2 py-1">
                  {roleLabel(r.role_type, r.properties)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Governed Proof Banner */}
      {governedProofBundle && e.postcode && (
        <div className="mb-8 border-4 border-bauhaus-blue bg-white">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="p-5 border-b-4 lg:border-b-0 lg:border-r-4 border-bauhaus-blue">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-blue mb-2">
                Governed Proof
              </div>
              <h2 className="text-xl font-black text-bauhaus-black mb-2">
                This entity sits inside a promoted place proof bundle
              </h2>
              <p className="text-sm text-bauhaus-muted leading-relaxed mb-4">
                {governedProofPack && typeof governedProofPack.headline === 'string'
                  ? governedProofPack.headline
                  : `Postcode ${e.postcode} has a governed-proof layer joining capital, evidence, and community voice.`}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] font-black uppercase tracking-widest">
                <span className="px-2.5 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">
                  {governedProofBundle.promotion_status}
                </span>
                <span className="px-2.5 py-1 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black">
                  confidence {Number(governedProofBundle.overall_confidence ?? 0).toFixed(2)}
                </span>
              </div>
              {governedProofStrengths.length > 0 && (
                <div className="mt-4 space-y-1">
                  {governedProofStrengths.map((strength, idx) => (
                    <div key={idx} className="text-xs font-medium text-bauhaus-black">
                      {'\u25CF'} {String(strength)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 bg-link-light flex flex-col justify-between">
              <p className="text-sm text-bauhaus-black font-medium leading-relaxed">
                Use the entity dossier for relationship context, then open the place proof page for the full funder-facing summary.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  href={`/for/funders/proof/${e.postcode}`}
                  className="inline-block px-4 py-3 text-center font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white hover:bg-bauhaus-yellow transition-colors"
                >
                  Open Place Proof
                </Link>
                <Link
                  href={`/for/funders/proof/${e.postcode}/system`}
                  className="inline-block px-4 py-3 text-center font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white hover:bg-link-light transition-colors"
                >
                  Open System Map
                </Link>
                <Link
                  href={`/places/${e.postcode}`}
                  className="inline-block px-4 py-3 text-center font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white hover:bg-bauhaus-canvas transition-colors"
                >
                  Open Place Context
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Procurement Workspace Banner */}
      {workspaceOrgName && (leadWorkspaceMembership || workspaceOpenTasks.length > 0) && (
        <div className="mb-8 border-4 border-bauhaus-red bg-white">
          <div className="bg-bauhaus-red px-4 py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Procurement Status</p>
              <h2 className="text-lg font-black text-white">Current workspace decision context</h2>
            </div>
            <Link
              href={leadWorkspaceMembership ? `/tender-intelligence?shortlistId=${leadWorkspaceMembership.shortlist_id}#procurement-workspace` : '/tender-intelligence'}
              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-white text-white hover:bg-white hover:text-bauhaus-red transition-colors"
            >
              Open Workspace
            </Link>
          </div>
          <div className="grid gap-0 md:grid-cols-4">
            <div className="p-4 border-b-4 md:border-b-0 md:border-r-4 border-bauhaus-red">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Saved In</p>
              <p className="text-2xl font-black text-bauhaus-black mt-2">{workspaceMemberships.length}</p>
              <p className="text-xs font-medium text-bauhaus-muted mt-1">shortlist{workspaceMemberships.length === 1 ? '' : 's'}</p>
            </div>
            <div className="p-4 border-b-4 md:border-b-0 md:border-r-4 border-bauhaus-red">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Current Decision</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${decisionTagBadgeClass((leadWorkspaceMembership?.decision_tag as string) || null)}`}>
                  {decisionTagLabel((leadWorkspaceMembership?.decision_tag as string) || null)}
                </span>
                {leadWorkspaceMembership && (
                  <span className="text-xs font-medium text-bauhaus-muted">
                    {leadWorkspaceMembership.shortlist_name as string}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 border-b-4 md:border-b-0 md:border-r-4 border-bauhaus-red">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Owner / Due</p>
              <p className="text-sm font-black text-bauhaus-black mt-2">{(leadWorkspaceMembership?.shortlist_owner_name as string) || 'Unassigned'}</p>
              <p className="text-xs font-medium text-bauhaus-muted mt-1">
                {leadWorkspaceMembership?.shortlist_decision_due_at ? `Due ${new Date(leadWorkspaceMembership.shortlist_decision_due_at as string).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'No decision due date'}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Review Queue</p>
              <p className="text-2xl font-black text-bauhaus-black mt-2">{workspaceOpenTasks.length}</p>
              <p className="text-xs font-medium text-bauhaus-muted mt-1">
                {workspaceUrgentTasks.length > 0 ? `${workspaceUrgentTasks.length} urgent` : 'No urgent tasks'}
              </p>
            </div>
          </div>
          {(String(leadWorkspaceMembership?.note || '') || String(leadWorkspaceMembership?.shortlist_next_action || '')) && (
            <div className="border-t-4 border-bauhaus-red px-4 py-4 bg-bauhaus-canvas">
              {!!leadWorkspaceMembership?.shortlist_next_action && (
                <p className="text-sm font-black text-bauhaus-black">
                  Next action: <span className="font-medium">{String(leadWorkspaceMembership.shortlist_next_action)}</span>
                </p>
              )}
              {!!leadWorkspaceMembership?.note && (
                <p className="text-sm font-medium text-bauhaus-black mt-2">
                  Latest note: {String(leadWorkspaceMembership.note)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {e.description && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{e.description}</p>
            </Section>
          )}

          {foundation?.giving_philosophy && (
            <Section title="Giving Philosophy">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{foundation.giving_philosophy}</p>
              {foundation.wealth_source && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Wealth Source:</span>
                  <span className="text-sm font-bold text-bauhaus-black">{foundation.wealth_source}</span>
                </div>
              )}
              {foundation.parent_company && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Parent:</span>
                  <span className="text-sm font-bold text-bauhaus-black">{foundation.parent_company}</span>
                </div>
              )}
            </Section>
          )}

          {foundation?.application_tips && (
            <Section title="Tips for Applicants">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{foundation.application_tips}</p>
            </Section>
          )}

          {foundationPrograms.length > 0 && (
            <Section title={`Programs & Opportunities (${foundationPrograms.length})`}>
              <div className="space-y-0">
                {foundationPrograms.map((p) => (
                  <div key={p.id} className="py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-bold text-bauhaus-blue hover:underline truncate block">
                            {p.name}
                          </a>
                        ) : (
                          <div className="font-bold text-bauhaus-black truncate">{p.name}</div>
                        )}
                        <div className="text-[11px] text-bauhaus-muted font-medium mt-0.5">
                          {p.program_type && <span>{p.program_type} &middot; </span>}
                          {p.categories?.length > 0 && <span>{p.categories.join(', ')} &middot; </span>}
                          {p.deadline && <span>Closes {p.deadline}</span>}
                        </div>
                      </div>
                      {(p.amount_min || p.amount_max) && (
                        <div className="text-right ml-4 shrink-0">
                          <div className="font-black text-bauhaus-black">
                            {p.amount_min && p.amount_max
                              ? `${formatMoney(p.amount_min)}-${formatMoney(p.amount_max)}`
                              : formatMoney(p.amount_max || p.amount_min)}
                          </div>
                        </div>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-bauhaus-muted font-medium mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {foundation?.notable_grants && foundation.notable_grants.length > 0 && (
            <Section title="Notable Grants">
              <ul className="space-y-1">
                {foundation.notable_grants.map((g, i) => (
                  <li key={i} className="text-sm text-bauhaus-muted font-medium flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-bauhaus-blue mt-2 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {socialEnterprise && (socialEnterprise.target_beneficiaries || socialEnterprise.business_model || socialEnterprise.sector) && (
            <Section title="Social Enterprise">
              <div className="space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {socialEnterprise.logo_url && (
                  <img src={socialEnterprise.logo_url} alt={`${socialEnterprise.name} logo`} className="h-12 object-contain" />
                )}
                {socialEnterprise.business_model && (
                  <p className="text-bauhaus-muted leading-relaxed font-medium text-sm">{socialEnterprise.business_model}</p>
                )}
                {socialEnterprise.certifications && (
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(socialEnterprise.certifications) ? socialEnterprise.certifications : []).map((cert: string) => (
                      <span key={cert} className="text-[10px] font-black px-2 py-0.5 border-2 border-money bg-money-light text-money uppercase tracking-widest">
                        {cert}
                      </span>
                    ))}
                  </div>
                )}
                {socialEnterprise.target_beneficiaries && socialEnterprise.target_beneficiaries.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Beneficiaries</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set(socialEnterprise.target_beneficiaries)).map((b: string, index: number) => (
                        <span key={`${b}-${index}`} className="text-xs font-bold px-2 py-0.5 bg-bauhaus-black/5 text-bauhaus-black">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {socialEnterprise.sector && socialEnterprise.sector.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Services</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set(socialEnterprise.sector)).map((s: string, index: number) => (
                        <span key={`${s}-${index}`} className="text-xs font-bold px-2 py-0.5 bg-bauhaus-black/5 text-bauhaus-muted">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {socialEnterprise.source_primary && (
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest pt-2 border-t border-bauhaus-black/5">
                    Source: {socialEnterprise.source_primary === 'social-traders' ? 'Social Traders' : socialEnterprise.source_primary}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ACNC Financial History */}
          {financialYears.length > 0 && (
            <Section title={`Financial History (${financialYears.length} years)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th className="text-left py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Year</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Revenue</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Expenses</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Assets</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialYears.slice(0, 8).map((fy, i) => (
                      <tr key={i} className="border-b border-bauhaus-black/5">
                        <td className="py-2 font-black text-bauhaus-black">{fy.ais_year}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-black">{formatMoney(Number(fy.total_revenue))}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-muted">{formatMoney(Number(fy.total_expenses))}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-black">{formatMoney(Number(fy.total_assets))}</td>
                        <td className={`py-2 text-right font-black ${Number(fy.net_surplus_deficit) >= 0 ? 'text-money' : 'text-bauhaus-red'}`}>
                          {formatMoney(Number(fy.net_surplus_deficit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {financialYears[0] && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {financialYears[0].revenue_from_government && Number(financialYears[0].revenue_from_government) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Govt Revenue</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].revenue_from_government))}</div>
                    </div>
                  )}
                  {financialYears[0].grants_donations_au && Number(financialYears[0].grants_donations_au) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Grants Given (AU)</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].grants_donations_au))}</div>
                    </div>
                  )}
                  {financialYears[0].staff_fte && Number(financialYears[0].staff_fte) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Staff (FTE)</div>
                      <div className="text-lg font-black text-bauhaus-black">{Number(financialYears[0].staff_fte).toLocaleString()}</div>
                    </div>
                  )}
                  {financialYears[0].staff_volunteers && Number(financialYears[0].staff_volunteers) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Volunteers</div>
                      <div className="text-lg font-black text-bauhaus-black">{Number(financialYears[0].staff_volunteers).toLocaleString()}</div>
                    </div>
                  )}
                  {financialYears[0].donations_and_bequests && Number(financialYears[0].donations_and_bequests) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Donations Received</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].donations_and_bequests))}</div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Community Evidence */}
          <CommunityEvidence gsId={e.gs_id} isPremium={isPremium} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Identity */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Identity
            </h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">GS ID</dt>
                <dd className="text-sm font-mono font-bold text-bauhaus-black">{e.gs_id}</dd>
              </div>
              {e.abn && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.abn}</dd>
                </div>
              )}
              {e.acn && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">ACN</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.acn}</dd>
                </div>
              )}
              {e.sector && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Sector</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.sector}</dd>
                </div>
              )}
              {e.website && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Website</dt>
                  <dd>
                    <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold text-bauhaus-blue hover:underline truncate block">
                      {e.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
              {e.financial_year && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Financial Year</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.financial_year}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Procurement Workspace Card */}
          {workspaceOrgName && (
            <ProcurementWorkspaceCard
              orgName={workspaceOrgName}
              shortlists={workspaceShortlists}
              initialMemberships={workspaceMemberships as never}
              initialTasks={workspaceTasks as never}
              canEdit={canEditWorkspace}
              supplier={{
                gs_id: e.gs_id,
                canonical_name: e.canonical_name,
                abn: e.abn,
                entity_type: e.entity_type,
                state: e.state,
                postcode: e.postcode,
                remoteness: e.remoteness || null,
                lga_name: e.lga_name || null,
                seifa_irsd_decile: e.seifa_irsd_decile || null,
                latest_revenue: e.latest_revenue,
                is_community_controlled: !!e.is_community_controlled,
                contracts: {
                  count: contractCount,
                  total_value: totalContractValue,
                },
              }}
            />
          )}

          {/* Focus Areas */}
          {((foundation?.thematic_focus && foundation.thematic_focus.length > 0) ||
            (foundation?.geographic_focus && foundation.geographic_focus.length > 0) ||
            (foundation?.target_recipients && foundation.target_recipients.length > 0) ||
            (charity?.purposes && charity.purposes.length > 0) ||
            (charity?.beneficiaries && charity.beneficiaries.length > 0)) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Focus Areas
              </h3>
              {foundation?.thematic_focus && foundation.thematic_focus.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Themes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {foundation.thematic_focus.map((t, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-bauhaus-blue/20 bg-link-light text-bauhaus-blue">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {foundation?.geographic_focus && foundation.geographic_focus.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Geography</div>
                  <div className="flex flex-wrap gap-1.5">
                    {foundation.geographic_focus.map((g, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {foundation?.target_recipients && foundation.target_recipients.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Target Recipients</div>
                  <div className="flex flex-wrap gap-1.5">
                    {foundation.target_recipients.map((r, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-money/20 bg-money-light text-money">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {charity?.purposes && charity.purposes.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Purposes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {charity.purposes.map((p, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-bauhaus-blue/20 bg-link-light text-bauhaus-blue">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {charity?.beneficiaries && charity.beneficiaries.length > 0 && (
                <div>
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Beneficiaries</div>
                  <div className="flex flex-wrap gap-1.5">
                    {charity.beneficiaries.map((b, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-money/20 bg-money-light text-money">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Board & Leadership */}
          {foundation?.board_members && foundation.board_members.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Board &amp; Leadership
              </h3>
              <ul className="space-y-1.5">
                {foundation.board_members.map((m, i) => (
                  <li key={i} className="text-sm font-bold text-bauhaus-black flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-bauhaus-black shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Financials */}
          {(e.latest_revenue || e.latest_assets || e.latest_tax_payable) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Financials
              </h3>
              <dl className="space-y-2">
                {e.latest_revenue && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Revenue</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_revenue)}</dd>
                  </div>
                )}
                {e.latest_assets && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Assets</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_assets)}</dd>
                  </div>
                )}
                {e.latest_tax_payable && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Tax Payable</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_tax_payable)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Method & Confidence */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Method
            </h3>
            <dl className="space-y-2.5">
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Match Confidence</dt>
                <dd className={`text-xs font-black uppercase tracking-widest ${
                  e.confidence === 'exact' ? 'text-green-700' :
                  e.confidence === 'high' ? 'text-bauhaus-blue' :
                  e.confidence === 'inferred' ? 'text-orange-600' : 'text-bauhaus-muted'
                }`}>
                  {e.confidence || 'exact'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Cross-references</dt>
                <dd className="text-sm font-black text-bauhaus-black">{e.source_count} dataset{e.source_count !== 1 ? 's' : ''}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Match Key</dt>
                <dd className="text-xs font-mono text-bauhaus-muted">{e.gs_id.startsWith('AU-ABN-') ? 'ABN' : e.gs_id.startsWith('AU-ACN-') ? 'ACN' : e.gs_id.startsWith('AU-ORIC-') ? 'ICN' : 'Name hash'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Relationships</dt>
                <dd className="text-sm font-black text-bauhaus-black">{stats?.total_relationships?.toLocaleString() ?? '0'}</dd>
              </div>
            </dl>
            <div className="mt-3 pt-3 border-t border-bauhaus-black/10">
              <p className="text-[10px] text-bauhaus-muted leading-relaxed">
                {e.gs_id.startsWith('AU-ABN-')
                  ? 'Matched by Australian Business Number (ABN) — high confidence. This entity was found across multiple government datasets using the same ABN.'
                  : e.gs_id.startsWith('AU-NAME-')
                  ? 'Matched by normalised name — moderate confidence. No ABN was available, so this entity was matched by exact or fuzzy name comparison. Some matches may be incorrect.'
                  : 'Matched by registration number — high confidence.'}
              </p>
            </div>
          </div>

          {/* Data Sources */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Data Sources
            </h3>
            <div className="flex flex-wrap gap-2">
              {e.source_datasets.map((ds, i) => (
                <span key={i} className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black uppercase tracking-widest">
                  {datasetLabel(ds)}
                </span>
              ))}
            </div>
          </div>

          {/* JusticeHub Link */}
          {jhOrg && (
            <div className="bg-white border-4 border-bauhaus-blue p-4">
              <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b-4 border-bauhaus-blue">
                <h3 className="text-sm font-black text-bauhaus-blue uppercase tracking-widest">
                  JusticeHub
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 border border-bauhaus-blue/30 bg-link-light text-bauhaus-blue uppercase tracking-widest">
                  External Link
                </span>
              </div>
              <p className="text-xs font-medium text-bauhaus-black leading-relaxed mb-3">
                This entity is also tracked in JusticeHub with {almaInterventionCount} intervention{almaInterventionCount !== 1 ? 's' : ''} and {almaEvidenceCount} evidence record{almaEvidenceCount !== 1 ? 's' : ''}.
              </p>
              <p className="text-[10px] text-bauhaus-muted leading-relaxed mb-3">
                External ecosystem profile linked from GrantScope for additional context. JusticeHub content is maintained separately.
              </p>
              {jhOrg.slug ? (
                <a
                  href={`https://justicehub.org.au/organizations/${jhOrg.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
                >
                  View on JusticeHub
                </a>
              ) : (
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                  JusticeHub profile available on request
                </div>
              )}
            </div>
          )}

          {/* Place Context */}
          {(placeGeo || seifa) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Location Intelligence
              </h3>
              <dl className="space-y-2">
                {e.postcode && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Postcode</dt>
                    <dd className="text-sm font-black text-bauhaus-black">
                      <Link href={`/places/${e.postcode}`} className="hover:text-bauhaus-blue">
                        {e.postcode}
                      </Link>
                    </dd>
                  </div>
                )}
                {placeGeo?.locality && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Locality</dt>
                    <dd className="text-sm font-bold text-bauhaus-black">{placeGeo.locality}</dd>
                  </div>
                )}
                {placeGeo?.remoteness_2021 && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Remoteness</dt>
                    <dd className={`text-sm font-black ${
                      placeGeo.remoteness_2021.includes('Very Remote') ? 'text-bauhaus-red' :
                      placeGeo.remoteness_2021.includes('Remote') ? 'text-orange-600' :
                      placeGeo.remoteness_2021.includes('Outer') ? 'text-bauhaus-yellow' :
                      'text-bauhaus-black'
                    }`}>{placeGeo.remoteness_2021}</dd>
                  </div>
                )}
                {seifa && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">SEIFA Disadvantage</dt>
                    <dd className={`text-sm font-black ${
                      seifa.decile_national <= 2 ? 'text-bauhaus-red' :
                      seifa.decile_national <= 4 ? 'text-orange-600' :
                      'text-bauhaus-black'
                    }`}>
                      Decile {seifa.decile_national}/10
                    </dd>
                  </div>
                )}
                {placeGeo?.lga_name && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">LGA</dt>
                    <dd className="text-sm font-bold text-bauhaus-black">{placeGeo.lga_name}</dd>
                  </div>
                )}
                {placeGeo?.sa2_name && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">SA2 Region</dt>
                    <dd className="text-sm font-bold text-bauhaus-black">
                      <Link href={`/power?sa2=${placeGeo.sa2_code}`} className="hover:text-bauhaus-blue">
                        {placeGeo.sa2_name}
                      </Link>
                    </dd>
                  </div>
                )}
                {postcodeEntityCount > 1 && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Entities in Area</dt>
                    <dd className="text-sm font-black text-bauhaus-black">
                      <Link href={`/places/${e.postcode}`} className="hover:text-bauhaus-blue">
                        {postcodeEntityCount.toLocaleString()}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
              {seifa && seifa.decile_national <= 3 && (
                <div className="mt-3 pt-3 border-t border-bauhaus-black/10">
                  <p className="text-[10px] text-bauhaus-muted leading-relaxed">
                    This entity is in a postcode ranked in the most disadvantaged {seifa.decile_national * 10}% nationally (SEIFA Index of Relative Socio-economic Disadvantage, ABS 2021 Census).
                  </p>
                </div>
              )}
              {placeGeo?.sa2_code && (
                <Link
                  href={`/power?sa2=${placeGeo.sa2_code}`}
                  className="mt-3 block text-center px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-yellow transition-colors"
                >
                  View on Power Map
                </Link>
              )}
            </div>
          )}

          {/* NDIS Market Context */}
          {disabilityRelevant && e.state && (
            <div className="bg-white border-4 border-bauhaus-blue p-4">
              <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b-4 border-bauhaus-blue">
                <h3 className="text-sm font-black text-bauhaus-blue uppercase tracking-widest">
                  Disability Market Context
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 border border-bauhaus-blue/30 bg-link-light text-bauhaus-blue uppercase tracking-widest">
                  NDIS Layer
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">State Providers</div>
                  <div className="text-lg font-black text-bauhaus-black">{ndisStateSupplyTotal?.provider_count?.toLocaleString() || '\u2014'}</div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Thin Districts</div>
                  <div className="text-lg font-black text-bauhaus-blue">{ndisThinDistrictCount}</div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Very Thin</div>
                  <div className="text-lg font-black text-bauhaus-red">{ndisVeryThinDistrictCount}</div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Local Alternatives</div>
                  <div className="text-lg font-black text-bauhaus-black">{localDisabilityEnterpriseCount}</div>
                  <div className="text-[10px] text-bauhaus-muted font-medium mt-1">
                    {localCommunityControlledCount} community-controlled orgs in postcode
                  </div>
                </div>
              </div>
              <p className="text-xs text-bauhaus-muted leading-relaxed mb-4">
                This organisation shows disability-related delivery signals. The strategic question is whether it sits inside a resilient market, a thin market, or a captured market where large providers take most of the money and local alternatives are scarce.
              </p>
              {ndisStateDistricts.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Thinnest Districts In {e.state}</div>
                  <div className="space-y-2">
                    {ndisStateDistricts.slice(0, 3).map((district) => (
                      <div key={district.service_district_name} className="flex items-center justify-between text-sm">
                        <span className="font-bold text-bauhaus-black">{district.service_district_name}</span>
                        <span className="font-mono font-black text-bauhaus-blue">{district.provider_count.toLocaleString()} providers</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ndisStateHotspots.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Captured Markets</div>
                  <div className="space-y-2">
                    {ndisStateHotspots.map((district) => (
                      <div key={`${district.state_code}:${district.service_district_name}`} className="flex items-center justify-between text-sm">
                        <span className="font-bold text-bauhaus-black">{district.service_district_name}</span>
                        <span className="font-mono font-black text-bauhaus-red">{formatPercent(district.payment_share_top10_pct)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href="/reports/ndis-market" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-yellow transition-colors">
                  Open NDIS Market
                </Link>
                {e.postcode && (
                  <Link href={`/places/${e.postcode}`} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-link-light transition-colors">
                    Open Place Pressure
                  </Link>
                )}
                <Link href="/funding-workspace" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-money-light transition-colors">
                  Open Funding Workspace
                </Link>
                {ndisSourceLink && (
                  <a href={ndisSourceLink} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-link-light transition-colors">
                    Source Dataset
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Donor-Contractor Alert */}
          {stats?.type_breakdown['donation:outbound'] && stats?.type_breakdown['contract:inbound'] && (
            <div className="bg-error-light border-4 border-bauhaus-red p-4">
              <h3 className="text-sm font-black text-bauhaus-red mb-2 uppercase tracking-widest">
                Donor-Contractor
              </h3>
              <p className="text-xs font-medium text-bauhaus-black leading-relaxed">
                This entity has both donated to political parties ({stats.type_breakdown['donation:outbound'].count} donation{stats.type_breakdown['donation:outbound'].count !== 1 ? 's' : ''} totalling {formatMoney(stats.type_breakdown['donation:outbound'].amount)}) and holds government contracts ({stats.type_breakdown['contract:inbound'].count} contract{stats.type_breakdown['contract:inbound'].count !== 1 ? 's' : ''} worth {formatMoney(stats.type_breakdown['contract:inbound'].amount)}).
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
