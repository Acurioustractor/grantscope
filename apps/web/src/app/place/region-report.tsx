import type { ReactNode } from 'react';
import Link from 'next/link';
import { getRegionSchoolNeedSignal } from '@/lib/services/school-need-signal';
import { getRhdSignalForRegion, ratePerHundred } from '@/lib/services/rhd-signal';
import { SchoolNeed } from './school-need';
import {
  getCrossBorderPicture,
  getHubAdministrationPicture,
  getPlaceIntelligence,
  getRegionFundingPicture,
  PLACE_REGIONS,
} from '@/lib/services/place-intelligence';

/**
 * The public report for one region.
 *
 * Everything here is driven by the region registry, so adding a region is an
 * entry plus a page that names it — not another 250 lines of prose that can
 * drift from the data behind it. The Far West Coast entry spent a day
 * describing the opposite of what the register said, which is the argument for
 * this being one component rather than three copies.
 */
export interface RegionReportProps {
  regionKey: string;
  title: string;
  /** What the region covers, in the names people there use. */
  intro: ReactNode;
  /** Optional map or other region-specific block, placed after the councils. */
  children?: ReactNode;
}

function money(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString('en-AU', { maximumFractionDigits: 1 })}M`;
  }
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

export async function RegionReport({ regionKey, title, intro, children }: RegionReportProps) {
  const [
    { areas, unplacedOrgs, unplacedTotal, gapNote, deregisteredExcluded, deliveryCoverage },
    hub,
    funding,
    crossBorder,
    schools,
  ] = await Promise.all([
    getPlaceIntelligence(regionKey),
    getHubAdministrationPicture(regionKey),
    getRegionFundingPicture(regionKey),
    getCrossBorderPicture(regionKey),
    getRegionSchoolNeedSignal(PLACE_REGIONS[regionKey]?.lgaNames ?? []),
  ]);
  const computedAt = areas[0]?.computedAt;
  const region = PLACE_REGIONS[regionKey];
  const rhd = getRhdSignalForRegion(regionKey);
  const gazetteerGaps = region.gazetteerGaps;
  const communities = region.communities;
  const unplacedPostcodes = region.unplaced?.postcodes ?? [];

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <header className="border-b-4 border-bauhaus-black bg-white px-5 py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Where the money goes
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight lg:text-5xl">{title}</h1>
          <div className="mt-4 max-w-3xl text-base leading-7">{intro}</div>
          {hub ? (
            <p className="mt-3 max-w-3xl text-base leading-7">
              {hub.hubIsOutsideRegion
                ? `The largest thing it cannot tell you: many organisations serving this region are registered in ${hub.hubLga}, which is not part of it. Their money appears in none of the figures below. That is set out rather than left for you to find.`
                : `The largest thing it cannot tell you: remote organisations are administered from town, so money earned in the communities is recorded as money reaching ${hub.hubLga}. That is set out below rather than left for you to find.`}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:px-10">
        {deliveryCoverage && deliveryCoverage.pct < 50 ? (
          <section aria-labelledby="coverage-title" className="border-4 border-bauhaus-red bg-white p-6">
            <h2 id="coverage-title" className="text-xl font-black uppercase tracking-widest text-bauhaus-red">
              Read the grant figures carefully
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              Only <strong>{deliveryCoverage.pct}%</strong> of the grant money reaching organisations
              here publishes a delivery location: <strong>${deliveryCoverage.knownM.toLocaleString('en-AU')}M</strong>{' '}
              carries one while <strong>${deliveryCoverage.unknownM.toLocaleString('en-AU')}M</strong> does not.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              The gap is not random. The National Indigenous Australians Agency publishes a delivery
              location on 2% of its awards, and the Department of Social Services on none — so the
              funding streams that matter most to these communities are the ones least visible by
              place. Each council below is therefore shown two ways: what organisations based there
              hold, and the much smaller slice that names the place as a delivery location.
            </p>
          </section>
        ) : null}

        {funding && funding.activeValue > 0 ? (
          <section aria-labelledby="committed-title" className="border-4 border-bauhaus-black bg-white p-6">
            <h2 id="committed-title" className="text-2xl font-black uppercase tracking-widest">
              What is committed, and what runs out
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">
              Federal grants held by organisations across this region, counted by where the
              recipient is registered. An agreement ending is not the same as funding stopping, but
              it is the moment a decision gets made somewhere else.
            </p>

            <dl className="mt-6 grid gap-5 sm:grid-cols-3">
              <div className="border-l-4 border-bauhaus-black pl-4">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Committed now</dt>
                <dd className="mt-1 text-3xl font-black">{money(funding.activeValue)}</dd>
                <dd className="font-mono text-[11px]">
                  {funding.activeAwards.toLocaleString('en-AU')} live agreements
                </dd>
              </div>
              <div className="border-l-4 border-bauhaus-red pl-4">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                  Ends within 24 months
                </dt>
                <dd className="mt-1 text-3xl font-black text-bauhaus-red">
                  {money(funding.endingWithin24mValue)}
                </dd>
                <dd className="font-mono text-[11px]">
                  {funding.activeValue > 0
                    ? `${Math.round((100 * funding.endingWithin24mValue) / funding.activeValue)}% of what is committed`
                    : ''}
                </dd>
              </div>
              <div className="border-l-4 border-bauhaus-black pl-4">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">All time</dt>
                <dd className="mt-1 text-3xl font-black">{money(funding.lifetimeValue)}</dd>
                <dd className="font-mono text-[11px]">
                  {funding.awards.toLocaleString('en-AU')} awards to{' '}
                  {funding.recipients.toLocaleString('en-AU')} recipients
                </dd>
              </div>
            </dl>

            {funding.endingSoon.length > 0 ? (
              <div className="mt-8">
                <h3 className="font-mono text-[11px] font-black uppercase tracking-widest">
                  The largest agreements ending soonest
                </h3>
                <table className="mt-3 w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">Recipient</th>
                      <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">Program</th>
                      <th scope="col" className="pb-2 text-right font-mono text-[10px] font-black uppercase tracking-widest">Value</th>
                      <th scope="col" className="pb-2 text-right font-mono text-[10px] font-black uppercase tracking-widest">Ends</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funding.endingSoon.map(award => (
                      <tr key={`${award.recipient}-${award.program}-${award.endDate}`} className="border-b border-bauhaus-black/15 align-top">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">{award.recipient}</th>
                        <td className="py-2 pr-3">
                          {award.program}
                          {award.agency ? <span className="font-mono text-[11px]"> · {award.agency}</span> : null}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(award.value)}</td>
                        <td className="py-2 text-right font-mono text-xs tabular-nums">
                          {new Date(award.endDate).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        {schools ? <SchoolNeed signal={schools} placeLabel={title} /> : null}

        {rhd ? (
          <section aria-labelledby="rhd-title" className="border-4 border-bauhaus-red bg-white p-6">
            <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
              A disease of housing
            </p>
            <h2 id="rhd-title" className="mt-2 text-2xl font-black uppercase tracking-widest">
              Rheumatic heart disease in {rhd.region}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">
              Rheumatic heart disease begins with a strep infection and is driven by crowded housing.
              It is close to absent in wealthy Australia and endemic here. Like the school figures
              above, this does not depend on us placing an organisation correctly — it comes from a
              register of notified cases.
            </p>

            <dl className="mt-6 grid gap-5 sm:grid-cols-3">
              <div className="border-l-4 border-bauhaus-red pl-4">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                  First Nations people living with RHD
                </dt>
                <dd className="mt-1 text-3xl font-black text-bauhaus-red">
                  {rhd.firstNationsCases.toLocaleString('en-AU')}
                </dd>
                <dd className="font-mono text-[11px]">
                  {ratePerHundred(rhd.firstNationsRatePer100k)} in every 100 people
                </dd>
              </div>
              <div className="border-l-4 border-bauhaus-black pl-4">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">
                  Non-Indigenous
                </dt>
                <dd className="mt-1 text-3xl font-black">
                  {rhd.nonIndigenousCases.toLocaleString('en-AU')}
                </dd>
                <dd className="font-mono text-[11px]">
                  {ratePerHundred(rhd.nonIndigenousRatePer100k)} in every 100 people
                </dd>
              </div>
              <div className="border-l-4 border-bauhaus-red pl-4">
                <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">
                  Rate ratio
                </dt>
                <dd className="mt-1 text-3xl font-black text-bauhaus-red">{rhd.rateRatio}×</dd>
                <dd className="font-mono text-[11px]">the non-Indigenous rate</dd>
              </div>
            </dl>

            <p className="mt-5 max-w-3xl border-l-4 border-bauhaus-red bg-bauhaus-canvas p-3 text-sm leading-6">
              {rhd.boundaryNote} It is a regional figure, not a figure for any one community, and
              the register does not publish below this level — case numbers in small communities
              would identify people.
            </p>

            <p className="mt-4 font-mono text-xs leading-5">
              Prevalence as at {rhd.asAt}. Based on Australian Institute of Health and Welfare
              material: Aboriginal and Torres Strait Islander Health Performance Framework measure
              1.06, table {rhd.sourceTable}, from the National Rheumatic Heart Disease Data
              Collection. Licensed CC BY 4.0.
            </p>
          </section>
        ) : null}

        <section aria-labelledby="areas-title">
          <h2 id="areas-title" className="text-2xl font-black uppercase tracking-widest">
            By place
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {areas.map(area => (
              <article
                key={area.areaKey}
                className={`border-4 bg-white p-6 ${area.hasRecord ? 'border-bauhaus-black' : 'border-dashed border-bauhaus-black/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-black uppercase">{area.areaLabel}</h3>
                  {area.irsdDecile > 0 ? (
                    <span className="shrink-0 bg-bauhaus-yellow px-2 py-1 font-mono text-[10px] font-black uppercase">
                      SEIFA {area.irsdDecile}
                      {area.remoteness ? ` · ${area.remoteness.replace(' Australia', '')}` : ''}
                    </span>
                  ) : null}
                </div>

                {/* A row of zeros would read as "nothing happens here". What we
                    actually know is narrower: we hold nothing, which is a fact
                    about our records. */}
                {!area.hasRecord ? (
                  <>
                    <p className="mt-5 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                      Nothing in our records
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      We hold no organisations under this council. That is a statement about our
                      records, not about the place. Organisations working here are most likely
                      registered to an address somewhere else, which is what the rest of this page
                      is about.
                    </p>
                    {area.areaNote ? (
                      <p className="mt-4 border-l-4 border-bauhaus-red bg-bauhaus-canvas p-3 text-sm leading-6">
                        {area.areaNote}
                      </p>
                    ) : null}
                  </>
                ) : (
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Organisations</dt>
                    <dd className="mt-1 text-2xl font-black">{area.orgCount.toLocaleString('en-AU')}</dd>
                    <dd className="font-mono text-[11px]">
                      {area.communityControlledCount.toLocaleString('en-AU')} community-controlled
                      {area.caringForCountry > 0 ? ` · ${area.caringForCountry} caring for Country` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Government contracts</dt>
                    <dd className="mt-1 text-2xl font-black">{money(area.contractValue)}</dd>
                    <dd className="font-mono text-[11px]">
                      {area.contractCount.toLocaleString('en-AU')} contracts · {money(area.contractValue24m)} in 24 months
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">
                      Grants held by orgs based here
                    </dt>
                    <dd className="mt-1 text-2xl font-black">{money(area.grantsHeldValue)}</dd>
                    <dd className="font-mono text-[11px]">
                      {area.grantsHeldCount.toLocaleString('en-AU')} grants, all time
                    </dd>
                    <dd className="mt-2 font-mono text-[11px] leading-5">
                      Of which {money(area.govtGrantValue)} across{' '}
                      {area.govtGrantCount.toLocaleString('en-AU')} awards names this place as the
                      delivery location
                      {area.localRetentionPct !== null ? `, ${area.localRetentionPct}% of it held locally` : ''}.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Philanthropy traced</dt>
                    <dd className="mt-1 text-2xl font-black">{area.philanthropicGrantCount.toLocaleString('en-AU')}</dd>
                    <dd className="font-mono text-[11px]">
                      from {area.philanthropicFunderCount.toLocaleString('en-AU')} funders
                    </dd>
                  </div>
                </dl>
                )}

                {area.hasRecord && area.areaNote ? (
                  <p className="mt-5 border-l-4 border-bauhaus-yellow bg-bauhaus-canvas p-3 text-sm leading-6">
                    {area.areaNote}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {hub && hub.orgs.length > 0 ? (
          <section aria-labelledby="hub-title" className="border-4 border-bauhaus-red bg-white p-6">
            <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
              Read the {hub.hubLga} figure carefully
            </p>
            <h2 id="hub-title" className="mt-2 text-2xl font-black uppercase tracking-widest">
              What the {hub.hubLga} number contains
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">{hub.note}</p>
            <p className="mt-3 max-w-3xl text-base leading-7">
              At least <strong>{money(hub.creditedValue)}</strong>{' '}
              {hub.hubIsOutsideRegion
                ? `is counted against ${hub.hubLga} rather than anywhere on this page, and it is money for work in `
                : `of the money shown against ${hub.hubLga} above was earned by organisations working in `}
              {hub.administeredCommunities.slice(0, -1).join(', ')} and{' '}
              {hub.administeredCommunities[hub.administeredCommunities.length - 1]}.{' '}
              {hub.hubIsOutsideRegion
                ? `Adding ${hub.hubLga} to this page would not fix that: it is a city with thousands of organisations of its own, and folding it in would bury the region rather than describe it.`
                : `It is not that the figure is wrong. It is that “money reaching ${hub.hubLga}” and “money reaching the people of ${hub.hubLga}” are different things, and the register only records the first.`}
            </p>

            <table className="mt-6 w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Organisations working in the communities and the council area they are counted under
              </caption>
              <thead>
                <tr className="border-b-4 border-bauhaus-black">
                  <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">Organisation</th>
                  <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">Counted under</th>
                  <th scope="col" className="pb-2 text-right font-mono text-[10px] font-black uppercase tracking-widest">Grants</th>
                  <th scope="col" className="pb-2 text-right font-mono text-[10px] font-black uppercase tracking-widest">Contracts</th>
                </tr>
              </thead>
              <tbody>
                {hub.orgs.map(org => (
                  <tr key={org.name} className="border-b border-bauhaus-black/15">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">{org.name}</th>
                    <td className="py-2 pr-3">
                      {org.lgaName ? (
                        <span className={org.lgaName === hub.hubLga ? 'font-black' : ''}>{org.lgaName}</span>
                      ) : (
                        <span className="font-mono text-xs">no council area</span>
                      )}
                      {org.postcode ? <span className="font-mono text-xs"> · {org.postcode}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {org.grantValue > 0 ? money(org.grantValue) : '—'}
                      {org.grants > 0 ? <span className="font-mono text-[11px]"> · {org.grants}</span> : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {org.contractValue > 0 ? money(org.contractValue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 max-w-3xl text-sm leading-6">
              {hub.orgs.every(org => org.lgaName === hub.hubLga)
                ? `Every organisation on this list is counted under ${hub.hubLga}. None of them is based there.`
                : `Only the rows counted under ${hub.hubLga} are included in the ${money(hub.creditedValue)} above. The others show what the same list looks like when the register places an organisation correctly, or cannot place it at all.`}
            </p>
            {hub.missing.length > 0 ? (
              <p className="mt-3 max-w-3xl font-mono text-xs leading-5">
                {hub.missing.length} organisation{hub.missing.length === 1 ? '' : 's'} named in our
                records could not be found in the register: {hub.missing.join(', ')}.
              </p>
            ) : null}
          </section>
        ) : null}

        {crossBorder && crossBorder.orgs.length > 0 ? (
          <section aria-labelledby="crossborder-title" className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
            <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-yellow">
              A border in the wrong place
            </p>
            <h2 id="crossborder-title" className="mt-2 text-2xl font-black uppercase tracking-widest text-bauhaus-yellow">
              {crossBorder.orgs.length} organisations recorded in the wrong state
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">{crossBorder.note}</p>
            <p className="mt-3 max-w-3xl text-base leading-7">
              They work in {crossBorder.communities.slice(0, -1).join(', ')} and{' '}
              {crossBorder.communities[crossBorder.communities.length - 1]}, in{' '}
              {crossBorder.actualState}. The register places them in {crossBorder.recordedState},
              under {crossBorder.recordedLga}, and{' '}
              <strong className="text-bauhaus-yellow">{money(crossBorder.misattributedValue)}</strong>{' '}
              travels with them.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {crossBorder.orgs.map(org => (
                <li key={org.name} className="border-b border-white/20 pb-2 text-sm leading-6">
                  {org.name}
                  <span className="block font-mono text-[11px] text-white/70">
                    {org.lgaName ?? 'no council'}
                    {org.postcode ? ` · ${org.postcode}` : ''}
                    {org.grantValue > 0 ? ` · ${money(org.grantValue)}` : ''}
                    {org.records > 1 ? ` · ${org.records} records in the register` : ''}
                  </span>
                </li>
              ))}
            </ul>
            {crossBorder.missing.length > 0 ? (
              <p className="mt-4 font-mono text-xs leading-5 text-white/70">
                {crossBorder.missing.length} named in our records could not be found in the
                register: {crossBorder.missing.join(', ')}.
              </p>
            ) : null}
          </section>
        ) : null}

        {gazetteerGaps.length > 0 ? (
          <section aria-labelledby="gazetteer-title" className="border-4 border-bauhaus-black bg-white p-6">
            <h2 id="gazetteer-title" className="text-2xl font-black uppercase tracking-widest">
              Places the map has no name for
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">
              A council area can only be worked out for a place the national gazetteer lists. These
              are lived in, and it does not list them. That is a limit of the reference data, not a
              statement about the places.
            </p>
            <ul className="mt-5 grid gap-4">
              {gazetteerGaps.map(gap => (
                <li key={gap.place} className="border-l-4 border-bauhaus-red bg-bauhaus-canvas p-4">
                  <p className="font-black uppercase tracking-wide">{gap.place}</p>
                  <p className="mt-1 text-sm leading-6">{gap.note}</p>
                  {gap.straddles.length > 1 ? (
                    <p className="mt-1 font-mono text-xs">
                      {gap.containingLocality} spans {gap.straddles.join(' and ')}.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {communities.length > 0 ? (
          <section aria-labelledby="communities-title">
            <h2 id="communities-title" className="text-2xl font-black uppercase tracking-widest">
              The communities and the councils they are counted under
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6">
              A council area is an administrative unit. A community is a place people are from. This
              is where the two come apart.
            </p>
            <table className="mt-5 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-4 border-bauhaus-black">
                  <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">Community</th>
                  <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">Counted under</th>
                  <th scope="col" className="pb-2 font-mono text-[10px] font-black uppercase tracking-widest">What that means</th>
                </tr>
              </thead>
              <tbody>
                {communities.map(community => (
                  <tr key={community.name} className="border-b border-bauhaus-black/15 align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-black">{community.name}</th>
                    <td className="py-2 pr-3">
                      {community.council ?? (
                        <span className="bg-bauhaus-red px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-white">
                          No council
                        </span>
                      )}
                    </td>
                    <td className="py-2 leading-6">{community.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {children}

        {unplacedOrgs.length > 0 ? (
          <section aria-labelledby="unplaced-title" className="border-4 border-bauhaus-black bg-white p-6">
            <h2 id="unplaced-title" className="text-2xl font-black uppercase tracking-widest">
              The communities, by name
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              These organisations share {unplacedPostcodes.length === 1 ? 'postcode' : 'postcodes'}{' '}
              {unplacedPostcodes.join(', ')}, which cover vast remote areas and span several council
              areas each. We hold a locality reference, and it does not settle the question: a
              postcode this size tells you nothing about which council an organisation sits in, and
              for many of these communities the gazetteer holds no locality at all. Naming them is
              the honest alternative to leaving them out — which is what every previous version of
              this data did.
            </p>
            {gapNote ? (
              <p className="mt-3 max-w-3xl border-l-4 border-bauhaus-red bg-bauhaus-canvas p-3 font-mono text-xs leading-5">
                {gapNote}
              </p>
            ) : null}
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {unplacedOrgs.map((org, index) => (
                // Index included: some organisations share a name in the
                // register — Kalka Community Aboriginal Corporation appears
                // twice — and a name-only key makes React drop one of them.
                <li key={`${org.name}-${index}`} className="flex items-start gap-2 border-b border-bauhaus-black/15 pb-2 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 bg-bauhaus-red" aria-hidden="true" />
                  <span>{org.name}</span>
                </li>
              ))}
            </ul>
            {unplacedTotal > unplacedOrgs.length ? (
              <p className="mt-4 font-mono text-xs">
                Showing {unplacedOrgs.length} currently registered organisations of {unplacedTotal} in
                these postcodes.
              </p>
            ) : null}
            {deregisteredExcluded > 0 ? (
              <p className="mt-2 font-mono text-xs">
                A further {deregisteredExcluded} corporations here are deregistered with ORIC and are
                not listed as current organisations.
              </p>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="reading-title" className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-white">
          <h2 id="reading-title" className="text-2xl font-black uppercase tracking-widest text-bauhaus-yellow">
            How to read this
          </h2>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <div>
              <h3 className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-yellow">
                Contracts follow the office, not the work
              </h3>
              <p className="mt-2 text-sm leading-6">
                Contract value is matched to the supplier&apos;s registered address, because
                procurement records publish no delivery location at all.
              </p>
            </div>
            <div>
              <h3 className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-yellow">
                Philanthropy figures are floors
              </h3>
              <p className="mt-2 text-sm leading-6">
                We can only count grants we can trace to a funder by ABN. A low number here means
                our records are thin, not that a place receives little philanthropy. Treat it as a
                minimum.
              </p>
            </div>
            <div>
              <h3 className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-yellow">
                A town&apos;s total is not a town&apos;s money
              </h3>
              <p className="mt-2 text-sm leading-6">
                Remote organisations are administered from the regional centre, so their registered
                address is in town and their money is counted there. Organisations in the remote
                postcodes above sit outside every council total here. They are listed by name
                rather than dropped.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="sources-title">
          <h2 id="sources-title" className="text-2xl font-black uppercase tracking-widest">Sources</h2>
          <ul className="mt-4 grid gap-2 text-sm">
            <li>Government contracts: AusTender, matched by supplier ABN.</li>
            <li>Grants: GrantConnect awarded grants. Shown both by the recipient&apos;s registered
              address and by the delivery location the award publishes, because most awards publish
              no delivery location. Two agencies cap their export at 50,000 records, so grant totals
              are floors.</li>
            <li>Philanthropic grants: ACNC-registered funders, matched to grantees by ABN only.</li>
            <li>Council areas: ABS ASGS Ed3 SAL_2021 with LGA_2025. Organisations whose locality is
              absent from it, or whose locality spans more than one council, are left unplaced
              rather than guessed.</li>
            <li>Organisation details and community-controlled status: Australian Charities and
              Not-for-profits Commission register.</li>
          </ul>
          {computedAt ? (
            <p className="mt-4 font-mono text-xs">
              Figures computed {new Date(computedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          ) : null}
          <p className="mt-6">
            <Link href="/foundations" className="border-4 border-bauhaus-black bg-bauhaus-yellow px-5 py-3 text-xs font-black uppercase tracking-widest">
              Explore funders
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
