import Link from 'next/link';
import SubmissionForm from './SubmissionForm';

export const metadata = {
  title: 'Get a Report — CivicGraph',
  description: 'Apply for an investigative deep-dive report on any Australian charity, peak body, sector, or funding stream.',
};

export default async function GetAReportPage({ searchParams }: { searchParams: Promise<{ free?: string; budget?: string; src?: string }> }) {
  const sp = await searchParams;
  const isFree = sp.free === 'true';
  const defaultBudget = sp.budget || (isFree ? '0' : null);
  const defaultSource = sp.src || 'direct';

  return (
    <div>
      <div className="mb-12">
        <Link href="/feedback" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← Send feedback instead</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Submit a Request</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          {isFree ? 'Apply for First 5 Free' : 'Get a Report'}
        </h1>
        <p className="text-xl text-bauhaus-muted leading-tight font-medium max-w-3xl">
          {isFree
            ? 'Five free FECCA-style investigative reports for Australian peak bodies, foundations, and oversight orgs willing to be a public case study.'
            : 'A citation-grade investigative deep-dive on any Australian charity, peak body, sector, network, or funding stream. Standard turnaround 5–7 days.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <SubmissionForm defaultBudget={defaultBudget} defaultFree={isFree} defaultSource={defaultSource} />
        </div>

        <aside className="space-y-6">
          <div className="border-4 border-bauhaus-yellow p-5 bg-bauhaus-yellow">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Worked example</div>
            <h3 className="text-lg font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">FECCA &amp; ECCV — The Federation&apos;s Money Map</h3>
            <p className="text-xs text-bauhaus-black font-medium leading-relaxed mb-3">
              ~12-min narrative report. 9 sections. Every claim sourced. Combines audited financials, federal procurement, state grants, board interlocks, and ABR/ACNC registration data.
            </p>
            <Link href="/reports/multicultural-sector/fecca-eccv/long-read" className="inline-block text-xs font-black uppercase tracking-widest text-bauhaus-black border-2 border-bauhaus-black px-3 py-2 bg-white hover:bg-bauhaus-canvas">
              Read the example →
            </Link>
          </div>

          <div className="border-4 border-bauhaus-black p-5 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-3">What we need from you</div>
            <ul className="text-xs text-bauhaus-black font-medium leading-relaxed space-y-2">
              <li><span className="font-black mr-1">·</span>The org / sector / network / program name</li>
              <li><span className="font-black mr-1">·</span>What you want to know (questions a board / funder / journalist would ask)</li>
              <li><span className="font-black mr-1">·</span>What decision the report will inform</li>
              <li><span className="font-black mr-1">·</span>Timeline preference</li>
            </ul>
          </div>

          <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Not sure yet?</div>
            <p className="text-xs text-bauhaus-black font-medium leading-relaxed">
              We&apos;re still figuring out what to charge. The fastest way to help is to <Link href="/feedback" className="text-bauhaus-blue font-black hover:underline">send feedback</Link> on what you found valuable and what you&apos;d want next.
            </p>
          </div>
        </aside>
      </div>

      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">FAQ</h2>
        <div className="space-y-5 text-sm text-bauhaus-black font-medium leading-relaxed">
          <div>
            <div className="font-black uppercase tracking-widest text-xs text-bauhaus-yellow mb-1">How long does it take?</div>
            <p>5–7 days for an On-Demand Report once we&apos;ve confirmed scope. First 5 Free reports are batched into the campaign window (4–6 weeks).</p>
          </div>
          <div>
            <div className="font-black uppercase tracking-widest text-xs text-bauhaus-yellow mb-1">Can it stay private?</div>
            <p>Yes. Paid reports default to a private link &mdash; only you and your colleagues see it. Public publication is opt-in. First 5 Free reports require public-case-study permission as part of the campaign.</p>
          </div>
          <div>
            <div className="font-black uppercase tracking-widest text-xs text-bauhaus-yellow mb-1">What if the org I&apos;m investigating doesn&apos;t want to be reported on?</div>
            <p>We use only public data sources (ABR, ACNC, Austender, audited annual reports, state grant disclosures). We don&apos;t breach anyone&apos;s privacy. For private reports we don&apos;t need consent. For public publication we offer a courtesy-preview window so the subject can flag factual errors before we go live.</p>
          </div>
          <div>
            <div className="font-black uppercase tracking-widest text-xs text-bauhaus-yellow mb-1">What if I&apos;m the org being investigated?</div>
            <p>That&apos;s fine &mdash; many subscribers ask us to investigate themselves. Knowing how you look from outside is a strategic asset. For self-investigation, all reports are private by default.</p>
          </div>
          <div>
            <div className="font-black uppercase tracking-widest text-xs text-bauhaus-yellow mb-1">What if I want one off and then stay subscribed?</div>
            <p>The On-Demand price counts toward a Sector Subscription if you upgrade within 90 days. Effectively a free first report when you commit to the year.</p>
          </div>
        </div>
      </section>

      <section className="text-center mb-8">
        <p className="text-sm text-bauhaus-muted font-medium">Questions before submitting?</p>
        <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue font-black text-sm hover:underline">Benjamin@act.place</a>
      </section>
    </div>
  );
}
