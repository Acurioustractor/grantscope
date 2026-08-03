import Link from 'next/link';
import { getCentralAustraliaIntelligence } from '@/lib/services/place-intelligence';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Where the money goes: Central Australia — CivicGraph',
  description:
    'Public money and philanthropic grants reaching organisations in Mparntwe (Alice Springs), Tennant Creek and the remote Central Australian homelands.',
};

function money(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString('en-AU', { maximumFractionDigits: 1 })}M`;
  }
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

export default async function CentralAustraliaPage() {
  const { areas, unplacedOrgs, unplacedTotal, gapNote } = await getCentralAustraliaIntelligence();
  const computedAt = areas[0]?.computedAt;

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
            Tennant Creek and the remote homelands. Every figure comes from a public register and
            can be checked. Where we cannot tell you something, the page says so instead of
            guessing.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:px-10">
        <section aria-labelledby="areas-title">
          <h2 id="areas-title" className="text-2xl font-black uppercase tracking-widest">
            By place
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {areas.map(area => (
              <article key={area.areaKey} className="border-4 border-bauhaus-black bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-black uppercase">{area.areaLabel}</h3>
                  {!area.lgaResolved ? (
                    <span className="shrink-0 bg-bauhaus-yellow px-2 py-1 font-mono text-[10px] font-black uppercase">
                      No council area
                    </span>
                  ) : null}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Organisations</dt>
                    <dd className="mt-1 text-2xl font-black">{area.orgCount.toLocaleString('en-AU')}</dd>
                    <dd className="font-mono text-[11px]">
                      {area.communityControlledCount.toLocaleString('en-AU')} community-controlled
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Federal contracts</dt>
                    <dd className="mt-1 text-2xl font-black">{money(area.contractValue)}</dd>
                    <dd className="font-mono text-[11px]">{area.contractCount.toLocaleString('en-AU')} contracts</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Government grants</dt>
                    <dd className="mt-1 text-2xl font-black">{money(area.govtGrantValue)}</dd>
                    <dd className="font-mono text-[11px]">{area.govtGrantCount.toLocaleString('en-AU')} grants</dd>
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

        {unplacedOrgs.length > 0 ? (
          <section aria-labelledby="unplaced-title" className="border-4 border-bauhaus-black bg-white p-6">
            <h2 id="unplaced-title" className="text-2xl font-black uppercase tracking-widest">
              The homelands, by name
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              These organisations share postcode 0872, which stretches across remote Northern
              Territory, South Australia and Western Australia. Until we hold a locality reference
              for it, they cannot be shown on a council map. Naming them is the honest alternative
              to leaving them out — which is what every previous version of this data did.
            </p>
            {gapNote ? (
              <p className="mt-3 max-w-3xl border-l-4 border-bauhaus-red bg-bauhaus-canvas p-3 font-mono text-xs leading-5">
                {gapNote}
              </p>
            ) : null}
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {unplacedOrgs.map(org => (
                <li key={org.name} className="flex items-start gap-2 border-b border-bauhaus-black/15 pb-2 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 bg-bauhaus-red" aria-hidden="true" />
                  <span>{org.name}</span>
                </li>
              ))}
            </ul>
            {unplacedTotal > unplacedOrgs.length ? (
              <p className="mt-4 font-mono text-xs">
                Showing {unplacedOrgs.length} of {unplacedTotal} organisations in this postcode.
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
                Contract value is matched to the supplier&apos;s registered address. Many
                organisations based in Alice Springs deliver into the homelands, so this shows
                where money is contracted, not where it is spent. It is not a measure of who
                benefits.
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
                Some places have no map yet
              </h3>
              <p className="mt-2 text-sm leading-6">
                Postcode 0872 covers a vast remote area and has no usable locality reference, so
                those organisations sit outside every council total on this page. They are listed
                by name rather than dropped.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="sources-title">
          <h2 id="sources-title" className="text-2xl font-black uppercase tracking-widest">Sources</h2>
          <ul className="mt-4 grid gap-2 text-sm">
            <li>Federal contracts: AusTender, matched by supplier ABN.</li>
            <li>Government grants: published grant and funding registers, matched by recipient ABN.</li>
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
