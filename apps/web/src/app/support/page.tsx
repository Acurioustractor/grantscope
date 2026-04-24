import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support CivicGraph',
  description:
    'CivicGraph is civic infrastructure built by A Curious Tractor. We partner with researchers, journalists, government agencies, and communities who want to understand and challenge how power moves in Australia.',
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <section className="border-b-4 border-bauhaus-black bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
            A Curious Tractor · Civic Infrastructure
          </p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-tight sm:text-6xl">
            Support the work
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-bauhaus-muted">
            CivicGraph is Australia&apos;s accountability atlas. It exists so community
            organisations, journalists, researchers, and citizens can see the system they&apos;re
            operating inside and act on it. We track action rather than wait for others.
          </p>
          <p className="mt-4 max-w-3xl text-lg text-bauhaus-muted">
            We&apos;re self-funded by A Curious Tractor and grow through partnerships, research
            commissions, and collaborations with people doing honest civic work.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-0 border-x-4 border-b-4 border-bauhaus-black bg-white md:grid-cols-2 md:divide-x-4 md:divide-bauhaus-black">
        <div className="p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
            Commission research
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase">
            Need a custom investigation, dataset, or brief?
          </h2>
          <p className="mt-4 text-sm text-bauhaus-muted">
            We deliver accountability briefs, sector landscapes, procurement analyses, and bespoke
            data work for government agencies, universities, journalism outlets, and peak bodies.
          </p>
          <Link
            href="mailto:ben@benjamink.com.au?subject=CivicGraph%20research%20commission"
            className="mt-6 inline-block border-4 border-bauhaus-black bg-bauhaus-black px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-bauhaus-red"
          >
            Get in touch
          </Link>
        </div>

        <div className="p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">
            Partner with us
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase">
            Journalism, research, and advocacy partnerships
          </h2>
          <p className="mt-4 text-sm text-bauhaus-muted">
            Publishing an investigation? Running an advocacy campaign? Writing a thesis? We share
            data, co-produce findings, and give credit where credit is due.
          </p>
          <Link
            href="mailto:ben@benjamink.com.au?subject=CivicGraph%20partnership"
            className="mt-6 inline-block border-4 border-bauhaus-black bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
          >
            Reach out
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
          The Curious Tractor portfolio
        </p>
        <h2 className="mt-2 text-2xl font-black uppercase">Four lenses, one philosophy</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
              CivicGraph
            </p>
            <p className="mt-2 text-sm text-bauhaus-muted">
              The power atlas. Who holds it, where it flows, who&apos;s cut out.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">
              JusticeHub
            </p>
            <p className="mt-2 text-sm text-bauhaus-muted">
              Sector evidence. ALMA interventions, outcomes, what works.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">
              Empathy Ledger
            </p>
            <p className="mt-2 text-sm text-bauhaus-muted">
              First-person stories from inside the systems.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
              Goods
            </p>
            <p className="mt-2 text-sm text-bauhaus-muted">
              Commerce with accountability. Buy from orgs doing the work.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
