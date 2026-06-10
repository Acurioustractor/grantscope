import type { ClaimLabel } from '@/lib/services/goods-canonical-numbers';
import { CLAIM_LABEL_MEANINGS } from '@/lib/services/goods-canonical-numbers';

/**
 * Tiny server-safe claim-label chip, mirroring the QBE claim taxonomy.
 *  - verified : white on bauhaus-blue
 *  - modelled : bauhaus-black on bauhaus-yellow
 *  - target   : bauhaus-black on white with a black border
 *  - future   : muted
 * The title attribute carries the one-phrase meaning for hover context.
 */
const CHIP_STYLE: Record<ClaimLabel, string> = {
  verified: 'bg-bauhaus-blue text-white border-2 border-bauhaus-blue',
  modelled: 'bg-bauhaus-yellow text-bauhaus-black border-2 border-bauhaus-black',
  target: 'bg-white text-bauhaus-black border-2 border-bauhaus-black',
  future: 'bg-white text-bauhaus-muted border-2 border-bauhaus-black/30',
};

export function ClaimChip({ label }: { label: ClaimLabel }) {
  return (
    <span
      title={CLAIM_LABEL_MEANINGS[label]}
      className={`inline-block px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${CHIP_STYLE[label]}`}
    >
      {label}
    </span>
  );
}
