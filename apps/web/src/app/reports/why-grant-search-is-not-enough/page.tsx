import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const metadata = {
  title: 'Why Grant Search Is Not Enough',
  description:
    'A broader CivicGraph essay on why the next useful category is an intelligence layer for funding, not just a larger grants database.',
};

function SectionHeading({ id, number, children }: { id: string; number: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4 scroll-mt-24">
      <span className="text-bauhaus-red font-black text-lg mt-1">{number}</span>
      <span>{children}</span>
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-bauhaus-black/80 leading-relaxed font-medium space-y-4 max-w-[720px]">{children}</div>;
}

function Callout({ children, color = 'yellow' }: { children: React.ReactNode; color?: 'yellow' | 'blue' | 'red' }) {
  const palette =
    color === 'blue'
      ? 'bg-bauhaus-blue text-white'
      : color === 'red'
        ? 'bg-bauhaus-red text-white'
        : 'bg-bauhaus-yellow text-bauhaus-black';

  return (
    <blockquote className={`${palette} border-4 border-bauhaus-black p-6 my-8 bauhaus-shadow-sm max-w-3xl`}>
      <div className="text-lg font-bold leading-relaxed">{children}</div>
    </blockquote>
  );
}

export default function WhyGrantSearchIsNotEnoughPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-3">Essay</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          Why Grant Search
          <br />
          <span className="text-bauhaus-red">Is Not Enough</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-3xl leading-relaxed mb-6">
          The next useful category is not a bigger grants database. It is an intelligence layer that can
          remember, monitor, connect, and explain how funding work actually happens.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Broad article</span>
          <span>|</span>
          <span>Empathy Ledger syndication fit</span>
          <span>|</span>
          <span>CivicGraph publishing</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">Reading Guide</div>
            <nav className="space-y-3 text-sm font-bold">
              <a href="#too-late" className="block text-bauhaus-blue hover:text-bauhaus-red">01 Funding Work Starts Too Late</a>
              <a href="#search" className="block text-bauhaus-blue hover:text-bauhaus-red">02 Search Is Not Enough</a>
              <a href="#continuity" className="block text-bauhaus-blue hover:text-bauhaus-red">03 Continuity Is The Product</a>
              <a href="#beyond-grants" className="block text-bauhaus-blue hover:text-bauhaus-red">04 Beyond Grants</a>
              <a href="#voice" className="block text-bauhaus-blue hover:text-bauhaus-red">05 Money And Voice</a>
              <a href="#notice" className="block text-bauhaus-blue hover:text-bauhaus-red">06 What People Will Notice</a>
            </nav>
          </div>
        </aside>

        <article className="min-w-0">
          <SectionHeading id="too-late" number="01">Funding Work Often Starts Too Late</SectionHeading>
          <Prose>
            <p>
              Most funding work still begins when pressure is already present. A team realises a grant is
              open, opens a spreadsheet, checks a portal, forwards a PDF, and starts rebuilding context from
              scratch. That pattern is so common it can look unavoidable, but it is really a symptom of a
              fragmented category.
            </p>
            <p>
              The fragments are familiar: opportunities, memory, relationships, evidence, timing. One person
              knows which foundation opened early last year. Another remembers which peer was funded. Another
              has the old guidelines in a folder. Another has the community evidence that explains why the
              work matters. The work is real, but the continuity is weak.
            </p>
            <p>
              What looks like grant research is often a coordination problem.
            </p>
          </Prose>

          <Callout>
            The sector does not only need better discovery. It needs better memory, better signal, and better
            shared context.
          </Callout>

          <SectionHeading id="search" number="02">Search Is Necessary, But It Is Not Enough</SectionHeading>
          <Prose>
            <p>
              Search helps when you already know it is time to look. But many of the most important questions
              arrive before or around the search moment: what changed this week, which funders are likely to
              move next, what is truly open now, and which opportunities belong in your real pipeline rather
              than your maybe-later pile.
            </p>
            <p>
              Most tools still struggle here because they are built around static rows. A row can tell you
              that a grant exists. It usually cannot tell you whether the foundation page changed yesterday,
              whether the PDF guidelines were updated, whether that funder consistently supports peers like
              you, or whether the alert that surfaced the grant ever produced real work.
            </p>
            <p>
              That is the difference between a listings product and an intelligence system.
            </p>
          </Prose>

          <SectionHeading id="continuity" number="03">Continuity Is The Product</SectionHeading>
          <Prose>
            <p>
              When people say they want better grant research, they often mean they want less interruption,
              less duplication, and fewer blind spots. They want a system that remembers what has already
              been seen, what should be rescanned, which pages are high-yield, which sources are stale, which
              foundations matter, and what the team has already done.
            </p>
            <p>
              Continuity changes the character of the work. The system stops being a place you visit only
              when you are already under pressure. It becomes something that keeps working while you are away.
              That matters because funding work is not just a research problem. It is a timing problem.
            </p>
          </Prose>

          <Callout color="blue">
            Finding the right thing too late is often not much better than not finding it at all.
          </Callout>

          <SectionHeading id="beyond-grants" number="04">Once You Structure It Properly, The Category Widens</SectionHeading>
          <Prose>
            <p>
              Once funding work is properly structured, the category stops being only about opportunities. It
              becomes about where money is flowing, where it is not, which organisations appear credible and
              proximate, which foundations have recurring interests, and which relationship signals matter.
            </p>
            <p>
              This is where workflow opens into power. Funding is never only about opportunity. It is also
              about visibility, legibility, timing, trust, and who gets recognised as fundable in the first
              place.
            </p>
            <p>
              An intelligence layer can help a grants lead build a better shortlist. It can also help a
              funder understand who keeps being missed, or help a place-based organisation show why the same
              communities keep appearing across multiple systems.
            </p>
          </Prose>

          <SectionHeading id="voice" number="05">Money Without Voice Is Still Incomplete</SectionHeading>
          <Prose>
            <p>
              This is why the relationship between CivicGraph and Empathy Ledger matters. CivicGraph is
              concerned with money flows, institutional relationships, grant and foundation context, and
              operating signal. Empathy Ledger is concerned with governed voice, lived experience, shared
              memory, and what communities are prepared to say, show, and stand behind.
            </p>
            <p>
              Those systems should remain distinct. But they become much more useful when they can speak to
              each other. Money without voice can distort need. Voice without operating context can struggle
              to influence how money moves. Together, they open a stronger conversation around governed proof,
              community-grounded signal, and operational context for action.
            </p>
          </Prose>

          <Callout color="red">
            The tooling question eventually opens into a governance question: what can be seen, what gets
            remembered, and who gets recognised as worth backing.
          </Callout>

          <SectionHeading id="notice" number="06">What People Will Start To Notice</SectionHeading>
          <Prose>
            <p>
              If this system becomes legible, people will stop seeing grants as isolated opportunities and
              start seeing a living field: active opportunities, likely future opportunities, institutional
              behaviour, relationship patterns, and the gap between formal funding logic and community
              experience.
            </p>
            <p>
              That gives us better language and more useful public discussion. Not every piece has to be a
              product explainer. Some can be about the labour of grant work. Some can be about the politics
              of legibility. Some can be about what a foundation page reveals before a round opens. Some can
              be about what changes when money data and governed voice begin to sit in the same conversation.
            </p>
            <p>
              That is how people start to take notice: not through one announcement, but through a series of
              grounded arguments that keep giving them a better frame.
            </p>
          </Prose>

          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6 bauhaus-shadow-sm mt-12 max-w-3xl">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Related Reads</div>
            <div className="space-y-2 text-sm font-bold">
              <Link href="/reports/civicgraph-thesis" className="block text-bauhaus-blue hover:text-bauhaus-red">
                The CivicGraph Investor Memo
              </Link>
              <Link href="/reports/grant-frontier" className="block text-bauhaus-blue hover:text-bauhaus-red">
                Grant Source Control Surface
              </Link>
              <Link href="/reports/philanthropy" className="block text-bauhaus-blue hover:text-bauhaus-red">
                Foundation Intelligence
              </Link>
            </div>
          </div>

          <ReportCTA reportSlug="why-grant-search-is-not-enough" reportTitle="Why Grant Search Is Not Enough" variant="inline" />
        </article>
      </div>
    </div>
  );
}
