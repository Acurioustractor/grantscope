import { moneyShort } from '@/lib/services/goods-engagement-shared';
import {
  fundingDirection,
  fundingHeadline,
  type RelationshipFunding,
} from '@/lib/services/goods-relationship-funding';

/**
 * Funding-history chip — what a counterpart actually funds (foundation giving +
 * political) vs what they've received (justice + procurement), from the data we
 * already hold. Grantmakers read as a yellow "Funds $X/yr" (someone we ask);
 * pure recipients read muted (a peer we might co-apply with). Full breakdown on
 * hover. Renders nothing when the relationship carries no funding signal — so it
 * degrades silently for the name-only registry rows that have no entity match.
 */
export function FundingChip({ funding }: { funding: RelationshipFunding | null }) {
  if (!funding) return null;
  const headline = fundingHeadline(funding);
  if (!headline) return null;

  const dir = fundingDirection(funding);
  const tone =
    funding.foundationGivingAnnual > 0
      ? 'bg-bauhaus-yellow text-bauhaus-black' // registered grantmaker — the asks
      : dir === 'grantmaker'
        ? 'bg-bauhaus-blue text-white' // gives (political only)
        : 'bg-bauhaus-canvas text-bauhaus-muted'; // recipient only

  const label =
    headline.label === 'funds'
      ? `Funds ${moneyShort(headline.amount)}/yr`
      : `${headline.label} ${moneyShort(headline.amount)}`;

  // Detail breakdown — every direction we actually matched, in plain language.
  const parts: string[] = [];
  if (funding.foundationGivingAnnual > 0) {
    let f = `Grantmaker: ${moneyShort(funding.foundationGivingAnnual)}/yr`;
    if (funding.foundationAvgGrant > 0) f += `, avg grant ${moneyShort(funding.foundationAvgGrant)}`;
    if (funding.foundationThemes.length > 0) f += ` · ${funding.foundationThemes.slice(0, 3).join(', ')}`;
    parts.push(f);
  }
  if (funding.politicalTotal > 0) {
    parts.push(`Political giving: ${moneyShort(funding.politicalTotal)} (${funding.politicalCount})`);
  }
  if (funding.justiceTotal > 0) {
    parts.push(`Justice funding received: ${moneyShort(funding.justiceTotal)} (${funding.justiceProgramCount} programs)`);
  }
  if (funding.austenderTotal > 0) {
    parts.push(`Procurement won: ${moneyShort(funding.austenderTotal)} (${funding.austenderContractCount} contracts)`);
  }

  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${tone}`}
      title={parts.join('  ·  ') || 'Funding footprint'}
    >
      {label}
    </span>
  );
}
