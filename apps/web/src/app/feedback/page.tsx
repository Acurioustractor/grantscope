import Link from 'next/link';
import FeedbackForm from './FeedbackForm';

export const metadata = {
  title: 'Feedback — CivicGraph',
  description: 'Tell us what you found valuable, what you want more of, and how you would use this. Helps shape what gets built next.',
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const sp = await searchParams;
  const subject = sp.subject || null;

  return (
    <div>
      <div className="mb-10">
        <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← CivicGraph</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Feedback</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          What did you find valuable?
        </h1>
        <p className="text-xl text-bauhaus-muted leading-tight font-medium max-w-3xl">
          We&apos;re building this in public &mdash; structured signals + free text shape what gets built next, where the data goes deeper, and how this gets priced. Tick what fits, leave what doesn&apos;t. Anonymous if you want.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <FeedbackForm reportSubject={subject || undefined} />
        </div>

        <aside className="space-y-5">
          <div className="border-4 border-bauhaus-yellow p-5 bg-bauhaus-yellow">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">The example you (probably) just read</div>
            <h3 className="text-lg font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">FECCA &amp; ECCV — The Federation&apos;s Money Map</h3>
            <p className="text-xs text-bauhaus-black font-medium leading-relaxed mb-3">
              ~12-min narrative. 9 sections. Combines audited financials, federal procurement, state grants, board interlocks, and ABR/ACNC registration data.
            </p>
            <Link href="/share/fecca-eccv" className="inline-block text-xs font-black uppercase tracking-widest text-bauhaus-black border-2 border-bauhaus-black px-3 py-2 bg-white hover:bg-bauhaus-canvas">
              View dashboard →
            </Link>
          </div>

          <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">What we&apos;re trying to learn</div>
            <ul className="text-xs text-bauhaus-black font-medium leading-relaxed space-y-2">
              <li><span className="font-black mr-1">·</span>Who finds this most valuable</li>
              <li><span className="font-black mr-1">·</span>What data layer to go deeper on (procurement / grants / boards / donations / etc.)</li>
              <li><span className="font-black mr-1">·</span>How people would actually use it (board · journalism · diligence · advocacy · curiosity)</li>
              <li><span className="font-black mr-1">·</span>What it&apos;s worth (without showing prices)</li>
            </ul>
          </div>

          <div className="border-4 border-bauhaus-black p-5 bg-white">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">No spam</div>
            <p className="text-xs text-bauhaus-black font-medium leading-relaxed">
              Submit anonymously or leave contact. If you opt-in, we&apos;ll send the next report and nothing else.
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
