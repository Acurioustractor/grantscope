import Link from 'next/link';
import type { Entity, MvEntityStats, CharityEnrichment, SocialEnterpriseEnrichment } from '../_lib/types';
import { entityTypeLabel, entityTypeBadge, confidenceBadge, formatMoney } from '../_lib/formatters';
import { DueDiligenceButton } from './due-diligence-button';

function Sparkline({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);
  if (entries.length < 2) return null;

  const maxCount = Math.max(...entries.map((e) => e.count));
  const width = 120;
  const height = 28;
  const padding = 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = entries.map((e, i) => {
    const x = padding + (i / (entries.length - 1)) * usableWidth;
    const y = padding + usableHeight - (e.count / maxCount) * usableHeight;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="inline-block" aria-label="Activity sparkline">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface EntityHeaderProps {
  entity: Entity;
  stats: MvEntityStats | null;
  charity: CharityEnrichment | undefined;
  socialEnterprise: SocialEnterpriseEnrichment | undefined;
  returnHref: string;
  returnLabel: string;
}

export function EntityHeader({ entity: e, stats, charity, socialEnterprise, returnHref, returnLabel }: EntityHeaderProps) {
  const badge = confidenceBadge(e.confidence);
  const isDonorContractor =
    stats?.type_breakdown['donation:outbound'] && stats?.type_breakdown['contract:inbound'];
  const concentrationRisk = stats && stats.top_counterparty_share >= 0.6;

  // Compute display values from MV stats or fallback to entity fields
  const totalRelationships = stats?.total_relationships ?? 0;
  const totalOutbound = stats?.total_outbound_amount ?? 0;
  const totalInbound = stats?.total_inbound_amount ?? 0;

  // Pick which money stats to show
  const donationBreakdown =
    stats?.type_breakdown['donation:outbound'] || stats?.type_breakdown['donation:inbound'];
  const contractBreakdown =
    stats?.type_breakdown['contract:outbound'] || stats?.type_breakdown['contract:inbound'];
  const donationTotal = donationBreakdown ? donationBreakdown.amount : 0;
  const contractTotal = contractBreakdown ? contractBreakdown.amount : 0;

  return (
    <>
      <Link href={returnHref} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to {returnLabel}
      </Link>

      <div className="mt-4 mb-6">
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{e.canonical_name}</h1>
          {isDonorContractor && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-red bg-error-light text-bauhaus-red uppercase tracking-widest whitespace-nowrap">
              Donor-Contractor
            </span>
          )}
          {concentrationRisk && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-red bg-error-light text-bauhaus-red uppercase tracking-widest whitespace-nowrap">
              Concentration Risk
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${entityTypeBadge(e.entity_type)}`}>
            {entityTypeLabel(e.entity_type)}
          </span>
          <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${badge.cls}`}>
            {badge.label}
          </span>
          {charity?.pbi && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-money bg-money-light text-money uppercase tracking-widest">
              PBI
            </span>
          )}
          {charity?.hpc && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue uppercase tracking-widest">
              HPC
            </span>
          )}
          {socialEnterprise && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-money bg-money-light text-money uppercase tracking-widest">
              Social Enterprise
            </span>
          )}
          {e.abn && (
            <span className="text-xs font-bold text-bauhaus-muted">ABN {e.abn}</span>
          )}
          {e.state && (
            <span className="text-xs font-bold text-bauhaus-muted">{e.state}</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Relationships</div>
          <div className="text-2xl font-black text-bauhaus-black">{totalRelationships.toLocaleString()}</div>
          {stats?.year_distribution && Object.keys(stats.year_distribution).length >= 2 && (
            <div className="mt-1 text-bauhaus-blue">
              <Sparkline data={stats.year_distribution} />
            </div>
          )}
        </div>
        <div className="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Data Sources</div>
          <div className="text-2xl font-black text-bauhaus-black">{e.source_count}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {donationTotal > 0 ? 'Political Donations' : 'Revenue'}
          </div>
          <div className="text-2xl font-black text-bauhaus-black">
            {donationTotal > 0 ? formatMoney(donationTotal) : formatMoney(e.latest_revenue)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {contractTotal > 0 ? 'Contract Value' : totalOutbound > 0 ? 'Total Outbound' : 'Tax Payable'}
          </div>
          <div className="text-2xl font-black text-bauhaus-black">
            {contractTotal > 0
              ? formatMoney(contractTotal)
              : totalOutbound > 0
                ? formatMoney(totalOutbound)
                : formatMoney(e.latest_tax_payable)}
          </div>
        </div>
      </div>

      {/* Due Diligence + Data freshness */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <DueDiligenceButton gsId={e.gs_id} />
        {e.updated_at && (
          <div className="text-[10px] font-medium text-bauhaus-muted">
            Data as of: {new Date(e.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
      </div>
    </>
  );
}
