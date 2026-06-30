import { powerBand, type RelationshipPower } from '@/lib/services/goods-relationship-power';

/**
 * Cross-system power chip — how embedded a counterpart is across the 7 power
 * systems, and whether they sit in the revolving-door set. A high-reach yes
 * carries weight and opens doors; it is also a public profile worth knowing
 * before we attach the Goods name. Detail on hover. Renders nothing without
 * signal — so it degrades silently for registry rows with no entity match.
 *
 * Surfaces on EITHER axis: system reach OR revolving-door membership. The two
 * come from independently-refreshed MVs with no enforced subset invariant, so a
 * counterpart can sit in the revolving-door set with zero measured system reach
 * (systemCount 0); we still show the chip rather than silently drop the RD flag.
 */
export function PowerChip({ power }: { power: RelationshipPower | null }) {
  if (!power || (power.systemCount < 1 && !power.revolvingDoor)) return null;
  const band = powerBand(power);
  const tone =
    band === 'high' ? 'bg-bauhaus-black text-bauhaus-yellow'
    : band === 'notable' ? 'bg-bauhaus-blue text-white'
    : 'bg-bauhaus-canvas text-bauhaus-muted';
  const rd = power.revolvingDoor ? ` · revolving door (${power.vectors.join(', ')})` : '';
  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${tone}`}
      title={`Cross-system reach: ${power.systems.join(', ') || 'none'}${rd}`}
    >
      Power {power.systemCount}/7{power.revolvingDoor ? ' · RD' : ''}
    </span>
  );
}
