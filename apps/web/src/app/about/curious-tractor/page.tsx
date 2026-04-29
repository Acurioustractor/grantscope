import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'A Curious Tractor — Track Action Rather Than Wait For Others',
  description:
    'A Curious Tractor is a civic infrastructure studio building Australia’s accountability atlas and the tools small organisations, journalists, and communities need to act on what they find. CivicGraph, JusticeHub, Empathy Ledger, and Goods — four lenses, one philosophy.',
};

export default function CuriousTractorPage() {
  return (
    <main className="space-y-12 pb-16">
      {/* Hero */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-bauhaus-yellow">
            A Curious Tractor
          </p>
          <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Track action rather
            <br />
            than wait for others.
          </h1>
          <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-white/75 sm:text-xl">
            A Curious Tractor is a civic infrastructure studio. We build the data, the tools, and the
            evidence that communities, journalists, and small organisations need to see how power moves
            in Australia, and to act on what they find.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/60">
            The Four Corners episode might never come. The Royal Commission might not see this pattern.
            The Auditor General is five years behind. We don&rsquo;t wait.
          </p>
        </div>
      </section>

      {/* Philosophy */}
      <section className="grid gap-0 lg:grid-cols-2 border-4 border-bauhaus-black">
        <div className="border-b-4 border-bauhaus-black bg-white p-8 sm:p-12 lg:border-b-0 lg:border-r-4">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Curious</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black">
            Ask real questions.
          </h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-bauhaus-muted">
            Don&rsquo;t accept received wisdom. Don&rsquo;t take the government press release at face value.
            Don&rsquo;t trust the tagline on the foundation&rsquo;s homepage. Read the data. Follow the
            money. Find the thing everyone is looking past.
          </p>
        </div>
        <div className="bg-bauhaus-canvas p-8 sm:p-12">
          <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Tractor</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black">
            Do the work.
          </h2>
          <p className="mt-4 text-base font-medium leading-relaxed text-bauhaus-muted">
            Not glamorous. Not viral. Not a thinkpiece. Infrastructure. Pull the weight. Plough the ground.
            Build the thing, publish the thing, let communities use the thing. Repeat weekly, for years.
          </p>
        </div>
      </section>

      {/* Why */}
      <section className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black p-8 sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-muted">Why We Exist</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black sm:text-4xl">
            Power is opaque. Communities most affected have the least information.
          </h2>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              num: '01',
              title: 'The systems don’t talk to each other.',
              copy: 'AusTender shows contracts. AEC shows donations. ACNC shows charities. GrantConnect shows grants. Nobody joins them. So nobody can see the same org taking $3M in contracts, donating $200K to the party that awarded them, while the community most affected receives none of it.',
            },
            {
              num: '02',
              title: 'Institutions move slowly. Communities can’t wait.',
              copy: 'By the time an inquiry reports, the money is already out the door. By the time the Auditor General catches it, the pattern has already shifted. Transparency infrastructure needs to move at the speed of the abuses it is trying to surface.',
            },
            {
              num: '03',
              title: 'Public good tools shouldn’t be gated by a paywall.',
              copy: 'If this was a $500/month SaaS tool, the people who most need it couldn’t use it. Community organisations, Indigenous-led groups, journalists working on thin budgets. So we built it free for them, and we fund it through partnerships, research commissions, and the portfolio.',
            },
          ].map((item, index) => (
            <div
              key={item.num}
              className={`p-6 sm:p-8 ${index < 2 ? 'border-b-4 border-bauhaus-black md:border-b-0 md:border-r-4' : ''}`}
            >
              <p className="text-3xl font-black text-bauhaus-red">{item.num}</p>
              <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-bauhaus-black">
                {item.title}
              </h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portfolio */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-canvas">
        <div className="border-b-4 border-bauhaus-black bg-white p-8 sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">The Portfolio</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black sm:text-4xl">
            Four lenses. One civil society operating system.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-relaxed text-bauhaus-muted">
            Each project stands alone. Together they&rsquo;re a complete view: the power, the evidence, the
            stories, the action. When communities push back, they need all four.
          </p>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          {[
            {
              name: 'CivicGraph',
              layer: 'Power',
              colour: 'text-bauhaus-red',
              copy: 'Australia’s accountability atlas. 591K resolved entities, 1.53M cross-system relationships, and 32K indexed grants. Contracts, donations, grants, boards, lobbying, ALMA evidence, ATO tax transparency, all resolved into one public graph. Who holds power, where money flows, who’s being cut out.',
              href: '/',
              cta: 'Explore the atlas',
            },
            {
              name: 'JusticeHub',
              layer: 'Evidence',
              colour: 'text-bauhaus-blue',
              copy: 'Sector evidence for youth justice and community-led change. The Australian Living Map of Alternatives (ALMA) — 1,155 interventions, 570 evidence records, 506 outcomes. What actually works, who’s doing it, what the evidence says.',
              href: 'https://justicehub.org.au',
              cta: 'Visit JusticeHub',
              external: true,
            },
            {
              name: 'Empathy Ledger',
              layer: 'Stories',
              colour: 'text-bauhaus-yellow',
              copy: 'First-person stories from inside the systems. The lived reality behind the data. Each story can anchor to a CivicGraph entity so readers see both the human and the structural context at once.',
              href: 'https://empathyledger.com',
              cta: 'Visit Empathy Ledger',
              external: true,
            },
            {
              name: 'Goods',
              layer: 'Action',
              colour: 'text-bauhaus-black',
              copy: 'Commerce with accountability. Buy from community-controlled and Indigenous-led organisations doing the work. Powered by CivicGraph supplier verification and procurement intelligence.',
              href: '#',
              cta: 'Coming soon',
            },
          ].map((project, index) => (
            <div
              key={project.name}
              className={`bg-white p-6 sm:p-8 ${
                index === 0 ? 'border-b-4 border-r-0 border-bauhaus-black md:border-r-4' : ''
              } ${index === 1 ? 'border-b-4 border-bauhaus-black' : ''} ${
                index === 2 ? 'border-r-0 md:border-r-4 border-bauhaus-black' : ''
              }`}
            >
              <p className={`text-xs font-black uppercase tracking-widest ${project.colour}`}>
                {project.layer}
              </p>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-bauhaus-black">
                {project.name}
              </h3>
              <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-muted">{project.copy}</p>
              <Link
                href={project.href}
                {...(project.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="mt-6 inline-block text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-red transition-colors"
              >
                {project.cta} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it fits */}
      <section className="border-4 border-bauhaus-black bg-white p-8 sm:p-12">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">How It Fits Together</p>
        <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black">
          Each project strengthens the others.
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <p className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5 text-sm font-medium leading-relaxed text-bauhaus-black">
            <span className="font-black">CivicGraph</span> exposes the pattern. <span className="font-black">JusticeHub</span> shows which interventions the evidence supports. Together you can say &ldquo;the money went here, the evidence says it should have gone there.&rdquo;
          </p>
          <p className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5 text-sm font-medium leading-relaxed text-bauhaus-black">
            <span className="font-black">Empathy Ledger</span> anchors every story to a real org on <span className="font-black">CivicGraph</span>. Readers get the human experience and the structural context in one place.
          </p>
          <p className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5 text-sm font-medium leading-relaxed text-bauhaus-black">
            <span className="font-black">Goods</span> uses <span className="font-black">CivicGraph</span> to verify suppliers, surface Indigenous-led businesses, and track government procurement compliance. Buy accountable. Sell accountably.
          </p>
          <p className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5 text-sm font-medium leading-relaxed text-bauhaus-black">
            Communities push back. <span className="font-black">CivicGraph</span> gives them the data, <span className="font-black">JusticeHub</span> gives them the evidence, <span className="font-black">Empathy Ledger</span> gives them the voice, <span className="font-black">Goods</span> gives them a way to trade. All four are the operating system.
          </p>
        </div>
      </section>

      {/* How it’s funded */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-canvas">
        <div className="border-b-4 border-bauhaus-black bg-white p-8 sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-muted">How It’s Funded</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black sm:text-4xl">
            Self-funded. No investors. No extractive capital.
          </h2>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b-4 border-bauhaus-black bg-white p-6 sm:p-8 md:border-b-0 md:border-r-4">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">Free for communities</p>
            <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-black">
              Small organisations, Indigenous-led groups, journalists, and researchers use everything free.
              No gates. No tiers. This is what we exist for.
            </p>
          </div>
          <div className="bg-white p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
              Paid by institutions
            </p>
            <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-black">
              Government agencies, universities, and peak bodies commission custom research, briefings, and
              bespoke analyses. Their fees fund the public-good infrastructure for everyone else.
            </p>
          </div>
        </div>
      </section>

      {/* Who we work with */}
      <section className="border-4 border-bauhaus-black bg-white p-8 sm:p-12">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Partners</p>
        <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-bauhaus-black">
          Who we work with
        </h2>
        <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-bauhaus-muted">
          We partner with foundations, researchers, journalists, and community organisations who share
          the &ldquo;track action rather than wait&rdquo; philosophy. Partner relationships are public and
          transparent. Partners never get vetoes over our investigations — that&rsquo;s non-negotiable.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {['Snow Foundation', 'Dusseldorp Forum', 'Oonchiumpa', 'JusticeHub'].map((name) => (
            <span
              key={name}
              className="border-4 border-bauhaus-black bg-bauhaus-canvas px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm font-medium text-bauhaus-muted">
          See the{' '}
          <Link href="/snow-foundation" className="font-black text-bauhaus-black underline hover:text-bauhaus-red">
            Snow Foundation partnership
          </Link>{' '}
          for an example of how we work together.
        </p>
      </section>

      {/* CTA */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-black p-8 text-white sm:p-12">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Get Involved</p>
        <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
          What you can do
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              who: 'Journalists',
              ask: 'Investigate with us. Access the data, co-byline the story, keep your independence.',
            },
            {
              who: 'Researchers',
              ask: 'Query the graph. Cite the atlas. Partner on academic work, thesis projects, and peer-reviewed publications.',
            },
            {
              who: 'Community organisations',
              ask: 'Use everything. Tell us what’s missing. Introduce us to the people in your region we haven’t reached.',
            },
            {
              who: 'Funders and institutions',
              ask: 'Commission research. Fund specific investigations. Support the infrastructure that everyone else uses free.',
            },
          ].map((item) => (
            <div key={item.who} className="border-4 border-white/20 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">
                {item.who}
              </p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-white/80">{item.ask}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-0">
          <Link
            href="mailto:ben@benjamink.com.au?subject=Partnership%20with%20A%20Curious%20Tractor"
            className="border-4 border-white bg-bauhaus-yellow px-6 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-white"
          >
            Get in touch
          </Link>
          <Link
            href="/support"
            className="border-y-4 border-r-4 border-white bg-transparent px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
          >
            Partner with us
          </Link>
          <Link
            href="/reports"
            className="border-y-4 border-r-4 border-white bg-transparent px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
          >
            Read investigations
          </Link>
        </div>
      </section>
    </main>
  );
}
