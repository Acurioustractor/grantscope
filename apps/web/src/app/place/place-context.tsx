import type { PlaceContext } from '@/lib/services/council-place-report';
import {
  getOvercrowdingForRemoteness,
  overcrowdedPct,
  overcrowdingRateRatio,
} from '@/lib/services/overcrowding-signal';

/**
 * The rest of the picture, and the parts of it we do not hold.
 *
 * Built signal by signal rather than by joining everything available. Every
 * figure here has a stated basis, and the things that cannot be placed honestly
 * are shown as gaps rather than as zeroes or as plausible wrong numbers.
 */
export function PlaceContextPanel({
  context,
  remoteness,
  placeLabel,
}: {
  context: PlaceContext;
  remoteness: string | null;
  placeLabel: string;
}) {
  const crowding = getOvercrowdingForRemoteness(remoteness);

  return (
    <section aria-labelledby="context-title" className="border-4 border-bauhaus-black bg-white p-6">
      <h2 id="context-title" className="text-2xl font-black uppercase tracking-widest">
        The rest of the picture
      </h2>
      <p className="mt-3 max-w-3xl text-base leading-7">
        What else we can say about {placeLabel}, and what we cannot. Each figure names the basis it
        rests on, because they are not all equally solid.
      </p>

      {crowding ? (
        <div className="mt-6 border-4 border-bauhaus-red p-5">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Overcrowding · {crowding.label} Australia
          </p>
          <div className="mt-3 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-black text-bauhaus-red">
                {overcrowdedPct(crowding, 'firstNations')}%
              </p>
              <p className="font-mono text-[11px]">of First Nations households overcrowded</p>
            </div>
            <div>
              <p className="text-3xl font-black">{overcrowdedPct(crowding, 'other')}%</p>
              <p className="font-mono text-[11px]">of other households</p>
            </div>
            <div>
              <p className="text-3xl font-black text-bauhaus-red">
                {overcrowdingRateRatio(crowding)}×
              </p>
              <p className="font-mono text-[11px]">
                the rate · {crowding.firstNationsSevere.toLocaleString('en-AU')} need 4+ extra
                bedrooms
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6">
            Crowding is what drives rheumatic fever, and this is the measure a bed responds to. It
            is a {crowding.label.toLowerCase()} Australia figure, not a figure for this council —
            the Census is not published finely enough to say more. Overcrowding here means a
            household needing at least one more bedroom under the Canadian National Occupancy
            Standard, which does not account for extended family obligations, so treat it as a
            floor.
          </p>
          <p className="mt-3 font-mono text-xs">
            Based on Australian Institute of Health and Welfare material: Health Performance
            Framework measure 2.01, table D2.01.10, 2021 Census. CC BY 4.0.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {context.seifa ? (
          <div className="border-l-4 border-bauhaus-black pl-4">
            <p className="font-mono text-[10px] font-black uppercase tracking-widest">
              Disadvantage, employment and income
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <dt className="font-mono text-[10px]">Disadvantage</dt>
                <dd className="text-2xl font-black">{context.seifa.irsd ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px]">Education &amp; occupation</dt>
                <dd className="text-2xl font-black">{context.seifa.ieo ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px]">Economic resources</dt>
                <dd className="text-2xl font-black">{context.seifa.ier ?? '—'}</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm leading-6">
              SEIFA deciles, where 1 is the most disadvantaged tenth of Australia. Averaged across{' '}
              {context.seifa.postcodes} {context.seifa.postcodes === 1 ? 'postcode' : 'postcodes'}.
              SEIFA measures the whole population, so where most people here are First Nations it
              describes them, and where they are a minority it does not.
            </p>
          </div>
        ) : null}

        <div className="border-l-4 border-bauhaus-black pl-4">
          <p className="font-mono text-[10px] font-black uppercase tracking-widest">
            Who is here
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <dt className="font-mono text-[10px]">Indigenous corporations</dt>
              <dd className="text-2xl font-black">{context.indigenousCorporations}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px]">Community-controlled</dt>
              <dd className="text-2xl font-black">{context.communityControlled}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px]">Social enterprises</dt>
              <dd className="text-2xl font-black">{context.socialEnterprisesInPostcodes}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm leading-6">
            Organisations the register places under this council. Social enterprises are matched by
            ABN, not postcode — matching by postcode credited one council with 150 of them, all
            sitting in a postcode spanning eight councils.
          </p>
        </div>
      </div>

      <div className="mt-6 border-4 border-dashed border-bauhaus-black/40 p-5">
        <p className="font-mono text-[11px] font-black uppercase tracking-widest">
          What we cannot tell you about {placeLabel}
        </p>
        <ul className="mt-3 grid gap-2 text-sm leading-6">
          {context.crimeRows === 0 ? (
            <li>
              <strong>Crime.</strong> We hold no records for this council. Coverage is uneven by
              state — New South Wales has 99 councils in our data, the Northern Territory six. An
              empty figure here means we hold nothing, not that nothing happens.
            </li>
          ) : null}
          <li>
            <strong>Overcrowding for this council specifically.</strong> Only published by
            remoteness class, so the figure above describes every place of this type in Australia.
          </li>
          <li>
            <strong>Rheumatic heart disease for this council.</strong> The registers publish by
            region at finest, because case numbers in small communities would identify people.
          </li>
          <li>
            <strong>Employment and income directly.</strong> The figures above are ABS composite
            indexes, not rates. We hold no employment or income data of our own.
          </li>
        </ul>
      </div>
    </section>
  );
}
