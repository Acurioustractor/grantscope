import Link from 'next/link';
import FeedbackForm from '../feedback/FeedbackForm';

export const metadata = {
  title: 'What is this worth to you? · CivicGraph',
  description: 'Instead of guessing at prices, we ask. Tell us how valuable this is, what you want more of, and how you would actually use it. Pricing follows the answers.',
};

/**
 * /pricing is intentionally NOT a price sheet. CivicGraph is being built
 * in public; price discovery happens through structured conversation with
 * the people who'd actually use the work. This page renders the same
 * feedback form as /feedback but with pricing-conversation framing so the
 * URL is meaningful for the "where's the pricing?" instinct.
 *
 * Submissions land in `report_feedback` and (if email supplied) push to
 * GoHighLevel tagged with value signals + pay band + use case + topics +
 * data-interaction preference, ready for follow-up.
 */
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const sp = await searchParams;
  const subject = sp.subject || 'pricing-page';

  return (
    <div>
      <div className="mb-10">
        <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← CivicGraph</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Pricing, but not a price sheet</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          What&apos;s this worth to you?
        </h1>
        <p className="text-xl text-bauhaus-muted leading-tight font-medium max-w-3xl mb-4">
          We&apos;re not guessing at prices. Pricing follows the conversation. Tick what fits, tell us how you&apos;d actually use it, and we&apos;ll come back with something shaped to how you work.
        </p>
        <div className="border-l-4 border-bauhaus-yellow pl-4 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Four questions worth a real answer</p>
          <ul className="text-sm text-bauhaus-black space-y-1 list-disc pl-5 marker:text-bauhaus-yellow">
            <li>Which sectors / data layers should we go deeper on (procurement · grants · donations · contracts · charities · directors)?</li>
            <li>How you&apos;d actually consume it (polished report · live dashboard · alerts · API · embed · briefings · workshop · custom)?</li>
            <li>What it&apos;s worth to your org or the people you serve, without us pre-anchoring a number?</li>
            <li>The questions you wish someone was answering with this data, but no one is.</li>
          </ul>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <FeedbackForm reportSubject={subject} />
        </div>

        <aside className="space-y-5">
          <div className="border-4 border-bauhaus-yellow p-5 bg-bauhaus-yellow">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Why no price sheet?</div>
            <p className="text-xs text-bauhaus-black font-medium leading-relaxed mb-3">
              The work serves wildly different audiences: foundations, ACCOs, journalists, peaks, oversight bodies, individual researchers. Pricing one of them prices the rest out of reach. We&apos;d rather hear what would actually shift your decisions, then propose something that fits.
            </p>
            <Link href="/reports" className="inline-block text-xs font-black uppercase tracking-widest text-bauhaus-black border-2 border-bauhaus-black px-3 py-2 bg-white hover:bg-bauhaus-canvas">
              See the reports →
            </Link>
          </div>

          <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">Across the data we hold</div>
            <ul className="text-xs text-bauhaus-black font-medium leading-relaxed space-y-2">
              <li><span className="font-black mr-1">·</span><span className="font-black">Procurement</span>:770K federal contracts (AusTender)</li>
              <li><span className="font-black mr-1">·</span><span className="font-black">Grants</span>:18K opportunities + state &amp; federal disbursements</li>
              <li><span className="font-black mr-1">·</span><span className="font-black">Charities</span>:66K ACNC profiles + giving history</li>
              <li><span className="font-black mr-1">·</span><span className="font-black">Foundations</span>:10.8K with thematic / geographic focus</li>
              <li><span className="font-black mr-1">·</span><span className="font-black">Donations</span>:312K political-donation records</li>
              <li><span className="font-black mr-1">·</span><span className="font-black">Tax transparency</span>:24K large-entity ATO records</li>
              <li><span className="font-black mr-1">·</span><span className="font-black">Director networks</span>:board interlocks across all of the above</li>
            </ul>
            <p className="text-xs font-mono text-bauhaus-muted mt-3">~1.5M relationships connecting it.</p>
          </div>

          <div className="border-4 border-bauhaus-black p-5 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">No spam, real reply</div>
            <p className="text-xs text-bauhaus-black font-medium leading-relaxed">
              Submit anonymously or leave contact. If you opt-in for follow-up, Ben replies personally, usually within 2 business days.
            </p>
            <p className="text-xs text-bauhaus-muted font-mono mt-3">
              <a href="mailto:Benjamin@act.place" className="text-bauhaus-blue hover:underline font-black">Benjamin@act.place</a>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
