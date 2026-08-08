import Link from 'next/link';
import {
  getCentralAustraliaIntelligence,
  getHubAdministrationPicture,
  PLACE_REGIONS,
} from '@/lib/services/place-intelligence';
import { OrganisationsMap } from './organisations-map';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Where the money goes: Central Australia — CivicGraph',
  description:
    'Public money and philanthropic grants reaching organisations in Mparntwe (Alice Springs), Tennant Creek and the Utopia homelands — and what those figures leave out.',
};

function money(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString('en-AU', { maximumFractionDigits: 1 })}M`;
  }
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

export default async function CentralAustraliaPage() {
  const [{ areas, unplacedOrgs, unplacedTotal, gapNote, deregisteredExcluded, deliveryCoverage }, hub] =
    await Promise.all([
      getCentralAustraliaIntelligence(),
      getHubAdministrationPicture('central-australia'),
    ]);
  const computedAt = areas[0]?.computedAt;
  const gazetteerGaps = PLACE_REGIONS['central-australia'].gazetteerGaps;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <header className="border-b-4 border-bauhaus-black bg-white px-5 py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Where the money goes
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight lg:text-5xl">
            Central Australia
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7">
            Public contracts and grants reaching organisations based in Mparntwe (Alice Springs),
            Tennant Creek and the Utopia homelands. Every figure comes from a public register and
            can be checked. Where we cannot tell you something, the page says so instead of
            guessing.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7">
            The largest thing it cannot tell you: remote organisations are administered from town,
            so money earned in the homelands is recorded as money reaching Alice Springs. That is
            set out below rather than left for you to find.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:px-10">
        {deliveryCoverage && deliveryCoverage.pct < 50 ? (
          <section aria-labelledby="coverage-title" className="border-4 border-bauhaus-red bg-white p-6">
            <h2 id="coverage-title" className="text-xl font-black uppercase tracking-widest text-bauhaus-red">
              Read the grant figures carefully
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              Only <strong>{deliveryCoverage.pct}%</strong> of the grant money reaching organisations here can be
              placed. Grants are attributed to a place using the delivery location the award publishes, and most
              awards do not publish one: <strong>${deliveryCoverage.knownM.toLocaleString('en-AU')}M</strong> carries
              a delivery location while <strong>${deliveryCoverage.unknownM.toLocaleString('en-AU')}M</strong> does
              not.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              The gap is not random. The National Indigenous Australians Agency publishes a delivery location on 2%
              of its awards, and the Department of Social Services on none — so the funding streams that matter most
              to these communities are the ones least visible by place. NIAA alone granted $1.25 billion to
              organisations in this region. The per-place grant figures below therefore describe a small and
              unrepresentative slice, weighted towards infrastructure and education. They are a floor, not a total.
            </p>
          </section>
        ) : null}

        <section aria-labelledby="areas-title">
          <h2 id="areas-title" className="text-2xl font-black uppercase tracking-widest">
            By place
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {areas.map(area => (
              <article key={area.areaKey} className="border-4 border-bauhaus-black bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-black uppercase">{area.areaLabel}</h3>
                  {area.irsdDecile > 0 ? (
                    <span className="shrink-0 bg-bauhaus-yellow px-2 py-1 font-mono text-[10px] font-black uppercase">
                      SEIFA {area.irsdDecile}
                      {area.remoteness ? ` · ${area.remoteness.replace(' Australia', '')}` : ''}
                    </span>
                  ) : null}
                </div>

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

                {area.areaNote ? (
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
            <p className="mt-3 max-w-3xl text-base leading-7">
              {hub.note}
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7">
              At least <strong>{money(hub.creditedValue)}</strong> of the money shown against{' '}
              {hub.hubLga} above was earned by organisations working in{' '}
              {hub.administeredCommunities.slice(0, -1).join(', ')} and{' '}
              {hub.administeredCommunities[hub.administeredCommunities.length - 1]}. It is not that
              the figure is wrong. It is that &ldquo;money reaching {hub.hubLga}&rdquo; and
              &ldquo;money reaching the people of {hub.hubLga}&rdquo; are different things, and the
              register only records the first.
            </p>

            <table className="mt-6 w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Organisations working in the homelands and the council area they are counted under
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

        <section aria-labelledby="map-title">
          <h2 id="map-title" className="text-2xl font-black uppercase tracking-widest">Every organisation, every channel</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6">
            Filter by money channel, council or community control, search by name, and read the detail on any
            organisation. The channels are kept apart because they mean different things: contracts follow the
            office, grants held follow the recipient, and grants delivered here follow the work.
          </p>
          <div className="mt-5">
            <OrganisationsMap />
          </div>
        </section>

        {unplacedOrgs.length > 0 ? (
          <section aria-labelledby="unplaced-title" className="border-4 border-bauhaus-black bg-white p-6">
            <h2 id="unplaced-title" className="text-2xl font-black uppercase tracking-widest">
              The homelands, by name
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              These organisations share postcode 0872, which stretches across remote Northern
              Territory, South Australia and Western Australia and spans eight council areas. We
              now hold a locality reference for it, and it does not settle the question: a postcode
              this size tells you nothing about which council an organisation sits in, and for the
              homelands the gazetteer holds no locality at all. Naming them is the honest
              alternative to leaving them out — which is what every previous version of this data
              did.
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
                this postcode.
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
                procurement records publish no delivery location. Grants do, so grant figures show
                where work happens and carry a local-retention share: how much of the money spent
                here is held by an organisation based here.
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
                address is in town and their money is counted there. Postcode 0872 covers a vast
                area across eight councils, and the homelands inside it have no gazetteer entry at
                all, so those organisations sit outside every council total here. They are listed
                by name rather than dropped.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="sources-title">
          <h2 id="sources-title" className="text-2xl font-black uppercase tracking-widest">Sources</h2>
          <ul className="mt-4 grid gap-2 text-sm">
            <li>Government contracts: AusTender, matched by supplier ABN. Northern Territory government
              buyers account for roughly 95% of the value here, so this is not federal spending.</li>
            <li>Grants: GrantConnect awarded grants, placed by the delivery location the award itself
              publishes. Two agencies cap their export at 50,000 records, so grant totals are floors.</li>
            <li>Philanthropic grants: ACNC-registered funders, matched to grantees by ABN only.</li>
            <li>Organisation details and community-controlled status: Australian Charities and Not-for-profits Commission register.</li>
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
