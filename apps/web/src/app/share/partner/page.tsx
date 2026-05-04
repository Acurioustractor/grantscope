import Link from 'next/link';
import PartnerForm from './PartnerForm';

export const metadata = {
  title: 'Partner with CivicGraph',
  description: 'Partnership inquiries: foundations, ACCOs, sector peaks, journalists, researchers. Tell us what you want to do and we reply within 2 business days.',
};

const ARTEFACT_LABELS: Record<string, string> = {
  'qld-youth-justice': 'QLD Youth Justice · Sector Deep Dive',
  'fecca-eccv': "FECCA & ECCV · The Federation's Money Map",
  'multicultural-sector': 'Multicultural Sector · Locked Surface',
};

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const sp = await searchParams;
  const ref = typeof sp?.ref === 'string' ? sp.ref : undefined;
  const artefactLabel = ref ? ARTEFACT_LABELS[ref] : undefined;

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">★ Partner with us</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Let&apos;s build the next one together.</h1>
        {artefactLabel && (
          <p className="text-sm font-mono text-bauhaus-muted mb-4">
            From: <Link href={`/share/${ref}`} className="underline hover:text-bauhaus-black">{artefactLabel}</Link>
          </p>
        )}
        <p className="text-bauhaus-black font-medium leading-relaxed text-lg max-w-3xl mb-4">
          CivicGraph reports use public data and ship fast. The same pipeline that produced the report you just read runs for any sector or organisation in Australia. If something landed for you and you want a version of it, this is where to start.
        </p>
        <div className="border-l-4 border-bauhaus-yellow pl-4 max-w-3xl">
          <p className="text-sm text-bauhaus-black font-medium leading-relaxed mb-2"><span className="font-black uppercase tracking-widest text-xs text-bauhaus-yellow">What we&apos;re looking for:</span></p>
          <ul className="text-sm text-bauhaus-black space-y-1 list-disc pl-5 marker:text-bauhaus-yellow">
            <li><span className="font-black">Foundations co-funding sector reports.</span> Quarterly cadence, board-grade evidence, shared back to the field.</li>
            <li><span className="font-black">ACCOs + community-controlled orgs</span> wanting their own version of this for their funders and boards.</li>
            <li><span className="font-black">Sector peaks + advocacy bodies</span> pitching system change with sourced data, not vibes.</li>
            <li><span className="font-black">Journalists</span> on a story. We&apos;ll point you at the records, the directors, the dollar trail.</li>
            <li><span className="font-black">Researchers</span> using the underlying dataset for academic work or evaluation.</li>
          </ul>
        </div>
      </div>

      <PartnerForm sourceArtefact={ref} />

      <div className="mt-10 pt-6 border-t-2 border-bauhaus-black/20 max-w-3xl text-xs font-mono text-bauhaus-muted">
        Prefer email? Write to <a href="mailto:Benjamin@act.place" className="underline">Benjamin@act.place</a> directly. The form just makes sure nothing gets lost.
      </div>
    </div>
  );
}
