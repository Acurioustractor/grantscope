import Link from 'next/link';
import type { Entity, MvEntityStats, CharityEnrichment, SocialEnterpriseEnrichment, DonationsMeta, TaxYear } from '../_lib/types';
import { entityTypeLabel, entityTypeBadge, confidenceBadge, formatMoney, datasetLabel } from '../_lib/formatters';
import { StatRow, Stat } from '@/components/data';
import { money } from '@/lib/format';
import { DueDiligenceButton } from './due-diligence-button';
import { WatchButton } from './watch-button';

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
  /** Donations made, from the page's own filtered query. Keeps the header and the donations section on one number. */
  donationsTotal?: number;
  /** What donationsTotal is made of: count, recipients, year span. */
  donationsMeta?: DonationsMeta | null;
  /** Other names the organisation is recorded under (gs_entity_aliases). */
  aliases?: string[];
  /** The newest ATO tax transparency year, when the page loaded any. */
  latestTax?: TaxYear | null;
}

const ALIASES_SHOWN = 4;

export function EntityHeader({
  entity: e, stats, donationsTotal, donationsMeta, aliases = [], latestTax = null, charity, socialEnterprise, returnHref, returnLabel,
}: EntityHeaderProps) {
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
  // A donor's header used the graph's donation edges while the section used political_donations
  // filtered to 'donation received'; on 2026-09-23 Qantas read $600K above and $24K below. For a
  // donor, use the section's figure. A party (inbound only) keeps the graph's received total.
  const isDonor = !!stats?.type_breakdown['donation:outbound'] || (donationsTotal ?? 0) > 0;
  const donationTotal = donationsTotal !== undefined && isDonor
    ? donationsTotal
    : donationBreakdown ? donationBreakdown.amount : 0;
  const contractTotal = contractBreakdown ? contractBreakdown.amount : 0;

  // Each headline says what it is made of, as OpenSecrets and USAspending do ("from 104 transactions").
  const years = Object.keys(stats?.year_distribution ?? {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const relationshipSpan = years.length >= 2 ? `${years[0]}–${years[years.length - 1]}` : years.length === 1 ? String(years[0]) : null;
  const sourceNames = (e.source_datasets ?? []).map(datasetLabel);
  const donationsLine = donationTotal > 0 && donationsMeta
    ? `${donationsMeta.count.toLocaleString()} ${donationsMeta.count === 1 ? 'donation' : 'donations'} to ${donationsMeta.recipients}${donationsMeta.recipientsCapped ? '+' : ''} ${donationsMeta.recipients === 1 ? 'recipient' : 'recipients'}${donationsMeta.fromYear ? `, ${donationsMeta.fromYear === donationsMeta.toYear ? donationsMeta.fromYear : `${donationsMeta.fromYear}–${donationsMeta.toYear}`}` : ''}`
    : null;
  const contractLine = contractTotal > 0 && contractBreakdown
    ? `from ${contractBreakdown.count.toLocaleString()} ${contractBreakdown.count === 1 ? 'contract' : 'contracts'}`
    : null;

  // A party has no donations of its own, only donations to it. The graph builds those edges only
  // where the donor resolves to an organisation by ABN, so the figure is a floor and says so.
  const isRecipient = !isDonor && donationTotal > 0;
  const receivedLine = isRecipient && donationBreakdown
    ? `from ${donationBreakdown.count.toLocaleString()} ${donationBreakdown.count === 1 ? 'donation' : 'donations'} by donors matched on ABN`
    : null;

  // gs_entities.latest_revenue and latest_tax_payable hold the EARLIEST ATO year for most companies
  // (4,453 of 5,901 with ATO records on 2026-09-24: CBA read $3.1B of tax for 2014-15 beside
  // $3.4B for 2023-24). The page loads the ATO years itself, so the header reads the newest one.
  // The ATO leaves tax payable blank for some companies: that is "not published", not $0.
  const revenue = latestTax?.total_income != null ? Number(latestTax.total_income) : e.latest_revenue;
  const revenueLine = latestTax?.total_income != null
    ? `ATO total income, ${latestTax.report_year}`
    : e.latest_revenue && e.financial_year ? `latest reported, ${e.financial_year}` : null;
  const taxPayable = latestTax ? (latestTax.tax_payable == null ? null : Number(latestTax.tax_payable)) : e.latest_tax_payable;
  const taxLine = latestTax
    ? latestTax.tax_payable == null ? `not published by the ATO for ${latestTax.report_year}` : `ATO tax transparency, ${latestTax.report_year}`
    : e.latest_tax_payable == null ? 'no ATO tax transparency record' : null;

  // Total Outbound adds every kind of outbound link that carries money, so it names those kinds.
  // Shared-director links are outbound too but carry no amount; counting them put "1,739 links"
  // under the Ian Potter Foundation's grant total.
  const outbound = Object.entries(stats?.type_breakdown ?? {}).filter(([k, v]) => k.endsWith(':outbound') && v.count > 0 && v.amount > 0);
  const outboundCount = outbound.reduce((n, [, v]) => n + v.count, 0);
  const outboundLine = outbound.length > 0
    ? `${outboundCount.toLocaleString()} outbound ${outboundCount === 1 ? 'link' : 'links'}: ${outbound
        .sort(([, a], [, b]) => b.amount - a.amount)
        .map(([k]) => k.split(':')[0].replace(/_/g, ' '))
        .join(', ')}`
    : null;

  return (
    <>
      <Link href={returnHref} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Back to {returnLabel}
      </Link>

      <div className="mt-4 mb-6">
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{e.canonical_name}</h1>
          {isDonorContractor && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-red bg-danger-light text-bauhaus-red uppercase tracking-widest whitespace-nowrap">
              Donor-Contractor
            </span>
          )}
          {concentrationRisk && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-red bg-danger-light text-bauhaus-red uppercase tracking-widest whitespace-nowrap">
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
        {aliases.length > 0 && (
          <p className="mt-2 text-sm text-bauhaus-muted">
            <span className="font-black uppercase tracking-widest text-[11px] text-bauhaus-black">Also recorded as</span>{' '}
            {aliases.slice(0, ALIASES_SHOWN).join(' · ')}
            {aliases.length > ALIASES_SHOWN && (
              <details className="inline">
                <summary className="inline cursor-pointer font-bold text-bauhaus-blue"> +{aliases.length - ALIASES_SHOWN} more</summary>
                <span> · {aliases.slice(ALIASES_SHOWN).join(' · ')}</span>
              </details>
            )}
          </p>
        )}
      </div>

      {/* Headline figures, each saying what it counts */}
      <div className="mb-8">
        <StatRow cols={4}>
          <Stat
            label="Relationships"
            value={totalRelationships.toLocaleString()}
            sub={relationshipSpan ? `links in the graph, ${relationshipSpan}` : undefined}
          >
            {stats?.year_distribution && Object.keys(stats.year_distribution).length >= 2 && (
              <div className="mt-1 text-bauhaus-blue">
                <Sparkline data={stats.year_distribution} />
              </div>
            )}
          </Stat>
          <Stat
            label="Data Sources"
            value={e.source_count}
            sub={sourceNames.length > 0
              ? `${sourceNames.slice(0, 3).join(', ')}${sourceNames.length > 3 ? ` +${sourceNames.length - 3}` : ''}`
              : undefined}
          />
          <Stat
            label={isRecipient ? 'Donations Received' : donationTotal > 0 ? 'Political Donations' : 'Revenue'}
            value={donationTotal > 0 ? formatMoney(donationTotal) : formatMoney(revenue)}
            tone={donationTotal > 0 ? 'red' : 'ink'}
            sub={(isRecipient ? receivedLine : donationTotal > 0 ? donationsLine : revenueLine) ?? undefined}
          />
          <Stat
            label={contractTotal > 0 ? 'Contract Value' : totalOutbound > 0 ? 'Total Outbound' : 'Tax Payable'}
            value={contractTotal > 0
              ? formatMoney(contractTotal)
              : totalOutbound > 0
                ? formatMoney(totalOutbound)
                : taxPayable === 0 ? money(0) : formatMoney(taxPayable)}
            sub={(contractTotal > 0 ? contractLine : totalOutbound > 0 ? outboundLine : taxLine) ?? undefined}
          />
        </StatRow>
      </div>

      {/* Due Diligence + Data freshness */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DueDiligenceButton gsId={e.gs_id} />
          <WatchButton gsId={e.gs_id} entityName={e.canonical_name} />
        </div>
        {e.updated_at && (
          <div className="text-[10px] font-medium text-bauhaus-muted">
            Data as of: {new Date(e.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
      </div>
    </>
  );
}
