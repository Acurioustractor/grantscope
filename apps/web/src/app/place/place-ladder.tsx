import { money } from '@/lib/format';
import type { PlaceContractLadder } from '@/lib/place-contract-ladder';

/**
 * Who already buys from organisations here.
 *
 * #308 found there is no honest bankability score to render — reserves invert, board counts are an
 * artefact, and the financial layer is a stale one-in-six subsample. What survives is the contract
 * ladder, and the question it answers is ENTRY: which agencies already buy from organisations in
 * this council, and from how many of them.
 *
 * CONTRACTS AND BUYERS ALWAYS RENDER TOGETHER. Buyer diversity is the rung — #308 measured it
 * rising 1.0 → 1.6 → 3.3 → 12.8 across the contract-count bands. Ten contracts with one buyer is
 * the bottom of the ladder, not the top, and a count shown alone reads as the opposite.
 */
export function PlaceLadder({
  ladder,
  lgaName,
}: {
  ladder: PlaceContractLadder | null;
  lgaName: string;
}) {
  if (!ladder) return null;

  return (
    <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
      <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
        Who already buys from organisations here
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed">
        <strong>
          {ladder.orgsWithContracts} organisation{ladder.orgsWithContracts === 1 ? '' : 's'} based in{' '}
          {lgaName}
        </strong>{' '}
        hold {ladder.totalContracts} federal contract{ladder.totalContracts === 1 ? '' : 's'} between
        them. These are the agencies already buying from this place.
      </p>

      <ul className="mt-6 divide-y-2 divide-bauhaus-black/10 border-y-4 border-bauhaus-black">
        {ladder.buyers.map(b => (
          <li
            key={b.buyer}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
          >
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{b.buyer}</span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
              {b.localSuppliers} local supplier{b.localSuppliers === 1 ? '' : 's'}
            </span>
            <span className="font-mono text-sm font-black tabular-nums">
              {b.contracts} contract{b.contracts === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>

      {/* The rung, said plainly. A contract count on its own reads as success; with the buyer
          count beside it, the picture is an organisation that got in one door and stayed. */}
      {ladder.allSingleBuyer && (
        <p className="mt-5 max-w-2xl border-l-4 border-bauhaus-yellow pl-4 text-sm leading-relaxed">
          Every organisation here that holds contracts holds them with{' '}
          <strong>one buyer only</strong>. Repeat work from a single agency is the first rung, not
          the top of the ladder — across the whole register, organisations winning more contracts
          are winning them from steadily more buyers.
        </p>
      )}

      <h3 className="mt-8 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-black/60">
        Organisations here holding contracts
      </h3>
      <ul className="mt-3 divide-y divide-bauhaus-black/10 border-y-2 border-bauhaus-black/20">
        {ladder.holders.map(h => (
          <li
            key={h.name}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2"
          >
            <span className="min-w-0 flex-1 text-sm leading-snug">
              {h.name}
              {h.communityControlled && (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-bauhaus-blue">
                  community-controlled
                </span>
              )}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
              {h.contracts} contract{h.contracts === 1 ? '' : 's'} · {h.buyers} buyer
              {h.buyers === 1 ? '' : 's'}
            </span>
            <span className="font-mono text-sm tabular-nums">{money(h.dollars)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed uppercase tracking-widest text-bauhaus-black/60">
        Suppliers are matched on the ABN at their registered address, so this is who supplies{' '}
        <em>from</em> here — not what is spent here. Federal contract notices record no delivery
        location at all, so no version of this figure can say where the work happened.
      </p>
    </section>
  );
}
