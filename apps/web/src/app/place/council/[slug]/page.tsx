import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCouncilPlaceReport } from '@/lib/services/council-place-report';
import { getSchoolNeedSignal } from '@/lib/services/school-need-signal';
import { SchoolNeed } from '../../school-need';
import { PlaceContextPanel } from '../../place-context';
import { CorrectionForm } from '../../correction-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await getCouncilPlaceReport(slug);
  if (!report) return { title: 'Council not found — CivicGraph' };
  return {
    title: `${report.lgaName}: what we cannot tell you — CivicGraph`,
    description: `Where our records run out for ${report.lgaName}, and how to correct them.`,
  };
}

export default async function CouncilPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await getCouncilPlaceReport(slug);
  if (!report) notFound();
  const schools = await getSchoolNeedSignal(report.lgaName);

  // The correction still goes to a person — the form writes to a review
  // queue (place_corrections) that a person reads, never to the register.
  // The mailto stays as the fallback so a failed request loses nothing.
  const correctionSubject = encodeURIComponent(`Correction: ${report.lgaName}`);
  const correctionBody = encodeURIComponent(
    `Council area: ${report.lgaName}\n` +
      `Page: /place/council/${report.slug}\n\n` +
      `Organisations on this page that belong to our community:\n  - \n\n` +
      `Organisations listed that are not ours:\n  - \n\n` +
      `Anything else we have got wrong:\n  - \n\n` +
      `Your name and organisation (optional):\n`,
  );

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <header className="border-b-4 border-bauhaus-black bg-white px-5 py-10 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            <Link href="/place/council" className="underline">Every remote council</Link>
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight lg:text-5xl">
            {report.lgaName}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7">
            We hold <strong>{report.orgCount.toLocaleString('en-AU')}</strong> organisations under
            this council, <strong>{report.communityControlled.toLocaleString('en-AU')}</strong> of
            them community-controlled. This page is about the ones we could not place, and the
            reasons we could not.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7">
            It was generated, not researched. Nobody has been through this council area by hand, so
            everything below is what a register can say about itself and no more.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 lg:px-10">
        {schools ? <SchoolNeed signal={schools} placeLabel={report.lgaName} /> : null}

        <PlaceContextPanel
          context={report.context}
          remoteness={report.remoteness}
          placeLabel={report.lgaName}
        />

        {report.unplacedTotal > 0 ? (
          <section aria-labelledby="unplaced-title" className="border-4 border-bauhaus-red bg-white p-6">
            <h2 id="unplaced-title" className="text-2xl font-black uppercase tracking-widest">
              {report.unplacedTotal.toLocaleString('en-AU')} organisations we could not place
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">
              They share {report.postcodes.length === 1 ? 'the postcode' : 'the postcodes'} this
              council&apos;s organisations use — {report.postcodes.join(', ')} — and the register
              gives no council for any of them.{' '}
              <strong>{report.unplacedCommunityControlled.toLocaleString('en-AU')}</strong> are
              community-controlled.
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7">
              Some of these belong here. Some belong to a neighbouring council. We cannot tell which,
              and rather than guess we are showing you the list.
            </p>

            {report.unplacedOrgs.length > 0 ? (
              <>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {report.unplacedOrgs.map((org, index) => (
                    <li
                      key={`${org.name}-${index}`}
                      className="flex items-start gap-2 border-b border-bauhaus-black/15 pb-2 text-sm"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 bg-bauhaus-red" aria-hidden="true" />
                      <span>{org.name}</span>
                    </li>
                  ))}
                </ul>
                {report.unplacedTotal > report.unplacedOrgs.length ? (
                  <p className="mt-4 font-mono text-xs">
                    Showing {report.unplacedOrgs.length} community-controlled and Indigenous
                    corporations of {report.unplacedTotal.toLocaleString('en-AU')} unplaced
                    organisations in these postcodes.
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {report.gazetteerGaps.length > 0 ? (
          <section aria-labelledby="gaps-title" className="border-4 border-bauhaus-black bg-white p-6">
            <h2 id="gaps-title" className="text-2xl font-black uppercase tracking-widest">
              Places the map cannot resolve
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7">
              A council can only be worked out for a locality the national gazetteer lists once.
              These are either missing from ABS SAL_2021 or mapped to more than one council, so
              neither answer is available.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {report.gazetteerGaps.map(gap => (
                <li key={gap.locality} className="border-l-4 border-bauhaus-red bg-bauhaus-canvas p-3 text-sm">
                  <span className="font-black uppercase">{gap.locality}</span>
                  <span className="mt-1 block font-mono text-[11px]">
                    {gap.straddles.length > 1
                      ? `spans ${gap.straddles.join(', ')}`
                      : 'no entry in the national gazetteer'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="correct-title" className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
          <h2 id="correct-title" className="text-2xl font-black uppercase tracking-widest">
            Tell us if we have this wrong
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7">
            You know which of these organisations are yours. We do not, and no amount of querying
            will tell us. If you can say which belong here and which do not, that is the one thing
            that would make this page true.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-7">
            It goes to a person, not a pipeline. We will say what we changed and why.
          </p>
          <div className="mt-5 max-w-3xl">
            <CorrectionForm
              pageRoute={`/place/council/${report.slug}`}
              lgaName={report.lgaName}
              mailtoHref={`mailto:hello@civicgraph.au?subject=${correctionSubject}&body=${correctionBody}`}
            />
          </div>
        </section>

        <section className="text-sm leading-6">
          <h2 className="text-2xl font-black uppercase tracking-widest">What this page is not</h2>
          <p className="mt-3 max-w-3xl">
            It does not tell you how much money reaches this council, because the figure would
            mislead. Remote organisations are usually administered from a regional centre, so their
            money is recorded against the town their post goes to. Four regions have been worked
            through properly and each one showed a different version of that problem — money
            credited to a hub inside the region, to a city outside it, or to the wrong state
            entirely.
          </p>
          <p className="mt-3 max-w-3xl">
            Doing that here needs someone who knows this place. Until then, this page states what it
            can stand behind.
          </p>
          <p className="mt-4 font-mono text-xs">
            Generated{' '}
            {new Date(report.computedAt).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            from ABS ASGS Ed3 SAL_2021 with LGA_2025, and the ACNC and ORIC registers.
          </p>
        </section>
      </div>
    </main>
  );
}
