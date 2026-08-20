import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCouncilPlaceReport } from '@/lib/services/council-place-report';
import { getSchoolNeedSignal } from '@/lib/services/school-need-signal';
import { SchoolNeed } from '../../school-need';
import { PlaceContextPanel } from '../../place-context';
import { PlaceCapture } from '../../place-capture';
import { PlaceLeaving } from '../../place-leaving';
import { PlaceLadder } from '../../place-ladder';
import { PlaceOrganisations } from '../../place-organisations';
import { organisationsInPlace } from '@/lib/place-organisations';
import { PlacePhilanthropySection } from '../../place-philanthropy';
import { philanthropyInPlace } from '@/lib/place-philanthropy';
import { contractLadderForPlace } from '@/lib/place-contract-ladder';
import { captureForLga, programsLeavingPlace } from '@/lib/grant-place-capture';
import { CorrectionForm } from '../../correction-form';
import { UnplacedAdviceList } from '../../unplaced-advice';

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
  // A capture failure must not take down the page it annotates: this council page is about what we
  // cannot tell you, and "we could not read the measure" is one more of those, not a 500.
  const capture = await captureForLga(report.lgaName, report.state).catch(() => null);
  // Only offered where the measure itself holds. Listing what left a place we could not measure
  // would be asserting a leak we have not shown.
  const leaving = capture
    ? await programsLeavingPlace(report.lgaName, report.state).catch(() => [])
    : [];
  // Independent of the capture measure: a council can hold contracts without any measurable grant
  // delivery, and the ladder is the entry story either way.
  const ladder = await contractLadderForPlace(report.lgaName).catch(() => null);
  // Named before anything is said about them. The page counted these organisations and never
  // listed one, while itemising every organisation it could NOT place.
  const organisations = await organisationsInPlace(report.lgaName).catch(() => ({
    organisations: [],
    total: 0,
  }));
  const philanthropy = await philanthropyInPlace(report.lgaName).catch(() => null);

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
      <header className="px-5 pt-10 lg:px-10">
        <div className="mx-auto max-w-5xl border-4 border-bauhaus-black bg-white p-6 shadow-[8px_8px_0_0_#121212] lg:p-8">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            <Link href="/place/council" className="underline">Every remote council</Link>
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight lg:text-5xl">
            {report.lgaName}
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-bauhaus-muted">
            {report.state ?? ''}{report.remoteness ? ` · ${report.remoteness}` : ''}
          </p>

          <dl className="mt-6 grid gap-5 sm:grid-cols-3">
            <div className="border-l-4 border-bauhaus-black pl-4">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Placed here</dt>
              <dd className="mt-1 text-3xl font-black">{report.orgCount.toLocaleString('en-AU')}</dd>
              <dd className="font-mono text-[11px]">organisations</dd>
            </div>
            <div className="border-l-4 border-bauhaus-black pl-4">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Community-controlled</dt>
              <dd className="mt-1 text-3xl font-black">{report.communityControlled.toLocaleString('en-AU')}</dd>
              <dd className="font-mono text-[11px]">of the placed</dd>
            </div>
            <div className="border-l-4 border-bauhaus-red pl-4">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">Cannot be placed</dt>
              <dd className="mt-1 text-3xl font-black text-bauhaus-red">{report.unplacedTotal.toLocaleString('en-AU')}</dd>
              <dd className="font-mono text-[11px]">share these postcodes</dd>
            </div>
          </dl>

          <p className="mt-6 max-w-3xl text-base leading-7">
            This page is about the ones we could not place, and the reasons we could not. It was
            generated, not researched: nobody has been through this council area by hand, so
            everything below is what a register can say about itself and no more.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 lg:px-10">
        {report.unplacedTotal > 0 ? (
          <section
            aria-labelledby="unplaced-title"
            className="border-4 border-bauhaus-red bg-white p-6 shadow-[8px_8px_0_0_#121212]"
          >
            <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
              The question only local people can answer
            </p>
            <h2 id="unplaced-title" className="mt-2 text-2xl font-black uppercase tracking-widest">
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
              Some belong here. Some belong to a neighbouring council. If you know which, tap it —
              each tap goes to a person for review, with your word as the evidence.
            </p>

            <UnplacedAdviceList
              orgs={report.unplacedOrgs}
              lgaName={report.lgaName}
              pageRoute={`/place/council/${report.slug}`}
            />
            {report.unplacedTotal > report.unplacedOrgs.length ? (
              <p className="mt-4 font-mono text-xs">
                Showing the {report.unplacedOrgs.length} community-controlled and Indigenous
                corporations; {report.unplacedTotal.toLocaleString('en-AU')} organisations in these
                postcodes are unplaced in all. The rest are in the correction form below.
              </p>
            ) : null}
          </section>
        ) : null}

        <PlaceOrganisations
          organisations={organisations.organisations}
          total={organisations.total}
          lgaName={report.lgaName}
        />

        <PlaceCapture capture={capture} lgaName={report.lgaName} />

        <PlaceLeaving programs={leaving} lgaName={report.lgaName} />

        <PlaceLadder ladder={ladder} lgaName={report.lgaName} />

        <PlacePhilanthropySection philanthropy={philanthropy} lgaName={report.lgaName} />

        {schools ? <SchoolNeed signal={schools} placeLabel={report.lgaName} /> : null}

        <PlaceContextPanel
          context={report.context}
          remoteness={report.remoteness}
          placeLabel={report.lgaName}
        />

        {report.gazetteerGaps.length > 0 ? (
          <section aria-labelledby="gaps-title" className="border-4 border-bauhaus-black bg-white p-6 shadow-[8px_8px_0_0_#121212]">
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

        <section aria-labelledby="correct-title" className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6 shadow-[8px_8px_0_0_#121212]">
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
