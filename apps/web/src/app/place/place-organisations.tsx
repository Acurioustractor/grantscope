import Link from 'next/link';
import { money } from '@/lib/format';
import { entityTypeLabel, type PlaceOrganisation } from '@/lib/place-organisations';

/**
 * The organisations this council holds, named.
 *
 * The page counted them and never named them: Hope Vale said "Placed here: 15" and then itemised
 * 127 organisations it could NOT place, each with a name and a correction control. The uncertainty
 * was fully rendered and the certainty was a number, so a community could not find itself on its
 * own page. This is that fix.
 *
 * NO MONEY RECORDED IS NOT UNFUNDED, and it is the most likely thing on this page to be misread.
 * Eleven of Hope Vale's fifteen hold no federal money in our records. State programs, ILSC and
 * NIAA funding, land-council intermediation and anything delivered through another organisation
 * are all invisible to the two federal registers behind these columns. The words beside the zero
 * do that work; a blank cell would not.
 */
export function PlaceOrganisations({
  organisations,
  total,
  lgaName,
}: {
  organisations: PlaceOrganisation[];
  /** Every organisation placed here. Never the array length — see the note on the type. */
  total: number;
  lgaName: string;
}) {
  if (organisations.length === 0) return null;

  const withMoney = organisations.filter(o => o.grants > 0 || o.contracts > 0).length;
  const oricOnly = organisations.filter(o => !o.hasAbn).length;

  return (
    <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
      <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
        Who is here
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed">
        {total === organisations.length ? (
          <>
            The {total} organisation{total === 1 ? '' : 's'} our records place in {lgaName}, by name.
          </>
        ) : (
          <>
            Our records place {total} organisations in {lgaName}. These are the{' '}
            {organisations.length} holding the most recorded federal money.
          </>
        )}{' '}
        {withMoney > 0 ? `${withMoney} of those shown hold` : 'None of those shown hold'} federal
        grants or contracts we can see.
      </p>

      <ul className="mt-6 divide-y-2 divide-bauhaus-black/10 border-y-4 border-bauhaus-black">
        {organisations.map(o => (
          <li key={o.gsId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <span className="min-w-0 flex-1">
              <Link
                href={`/entity/${o.gsId}`}
                className="text-sm font-bold leading-snug underline decoration-2 underline-offset-2 hover:text-bauhaus-blue"
              >
                {o.name}
              </Link>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-widest text-bauhaus-black/55">
                {entityTypeLabel(o.entityType)}
                {o.communityControlled ? ' · community-controlled' : ''}
                {o.onAcncRegister ? ' · on the ACNC register' : ''}
              </span>
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
              {o.grants > 0 ? `${o.grants} grant${o.grants === 1 ? '' : 's'}` : 'no grants recorded'}
              {o.contracts > 0 ? ` · ${o.contracts} contract${o.contracts === 1 ? '' : 's'}` : ''}
              {!o.hasAbn ? ' · contracts not checkable' : ''}
            </span>
            <span className="font-mono text-sm font-black tabular-nums">
              {o.grantDollars > 0 ? money(o.grantDollars) : '—'}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 max-w-2xl border-l-4 border-bauhaus-blue pl-4 text-sm leading-relaxed">
        <strong>No money recorded does not mean unfunded.</strong> These columns see two federal
        registers and nothing else. State and territory programs, ILSC and NIAA funding, money
        delivered through a land council or another organisation, and every philanthropic dollar
        are all invisible here.
      </p>

      {oricOnly > 0 && (
        <p className="mt-4 max-w-2xl font-mono text-[11px] leading-relaxed uppercase tracking-widest text-bauhaus-black/60">
          {oricOnly} of these are registered with ORIC and carry no ABN in our records, so contracts
          cannot be checked for them at all. That is a limit of the join, not a finding about the
          organisation.
        </p>
      )}
    </section>
  );
}
