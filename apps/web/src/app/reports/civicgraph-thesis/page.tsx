import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const metadata = {
  title: 'The CivicGraph Investor Memo',
  description:
    'A shorter investor memo on why CivicGraph can become the intelligence layer for funding, foundation prospecting, and institutional relationship discovery.',
};

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
      <div className={`text-3xl sm:text-4xl font-black tabular-nums ${color || 'text-bauhaus-black'}`}>{value}</div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">{label}</div>
    </div>
  );
}

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

export default function CivicGraphThesisPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">CivicGraph Memo</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          The CivicGraph
          <br />
          <span className="text-bauhaus-blue">Investor Memo</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-3xl leading-relaxed mb-6">
          A shorter 2–3 page case for why CivicGraph can become the intelligence layer for grants,
          foundation prospecting, and institutional relationship discovery in the Australian social sector.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Short memo version</span>
          <span>|</span>
          <span>Grant pipeline, foundation prospecting, alerts</span>
          <span>|</span>
          <span>Updated April 2026</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-4">Memo Outline</div>
            <nav className="space-y-3 text-sm font-bold">
              <a href="#problem" className="block text-bauhaus-blue hover:text-bauhaus-red">01 The Problem</a>
              <a href="#wedge" className="block text-bauhaus-blue hover:text-bauhaus-red">02 The Wedge</a>
              <a href="#moat" className="block text-bauhaus-blue hover:text-bauhaus-red">03 The Moat</a>
              <a href="#why-now" className="block text-bauhaus-blue hover:text-bauhaus-red">04 Why Now</a>
              <a href="#already-true" className="block text-bauhaus-blue hover:text-bauhaus-red">05 What Is Already True</a>
              <a href="#commercial" className="block text-bauhaus-blue hover:text-bauhaus-red">06 Commercial Path</a>
              <a href="#proof" className="block text-bauhaus-blue hover:text-bauhaus-red">07 What Must Be Proven</a>
            </nav>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <Stat value="18K+" label="Grant Opportunities" color="text-bauhaus-blue" />
            <Stat value="10.8K" label="Foundations" color="text-bauhaus-red" />
            <Stat value="100K+" label="Entities" color="text-bauhaus-blue" />
            <Stat value="50K+" label="Frontier URLs" color="text-bauhaus-red" />
          </div>

          <SectionHeading id="problem" number="01">The Problem</SectionHeading>
          <Prose>
            <p>
              Australian funding work is still fragmented across grant portals, foundation websites, PDF
              guidelines, annual reports, spreadsheets, CRM notes, newsletters, and memory. That means the
              market is still operating in a pre-platform state: high manual effort, weak continuity, and
              poor visibility into what changed recently or what actually fits.
            </p>
            <p>
              Most products in the category solve only one slice of that problem. They give you a list of
              grants, a newsletter, a compliance workflow, or a grants management system. Very few close the
              gap between <em>I can search</em> and <em>I know what to do next</em>.
            </p>
            <p>
              That gap is commercially important because time is not the only thing being wasted. The market
              also lacks usable answers to higher-value questions: which funders consistently support peers,
              which pages changed this week, which opportunities are truly open now, and which alert actually
              created real pipeline work.
            </p>
          </Prose>

          <Callout>
            The category is still built around rows and reminders. The real opportunity is a system that
            continuously finds, ranks, explains, and monitors funding work better than manual research can.
          </Callout>

          <SectionHeading id="wedge" number="02">The Wedge</SectionHeading>
          <Prose>
            <p>
              The best initial product is not a broad “social sector intelligence platform.” It is a tighter,
              sellable wedge: <strong className="text-bauhaus-black">an always-on grant pipeline and foundation prospecting product</strong>{' '}
              for grant consultants and grants or fundraising leads.
            </p>
            <p>
              That wedge needs to do four things well: match relevant grants to an organisation, monitor
              opportunities and funders continuously, help teams work a live pipeline, and generate alerts
              that create real funding activity rather than passive email traffic.
            </p>
            <p>
              This is the right entry point because the ROI is immediate. Consultants and funding teams
              already spend real time on research, monitoring, grant calendars, reporting, and ad hoc
              foundation scanning. If CivicGraph cuts research time and improves signal quality, it becomes
              valuable before it becomes category-defining.
            </p>
          </Prose>

          <SectionHeading id="moat" number="03">The Moat</SectionHeading>
          <Prose>
            <p>
              The moat is not public data. Grant pages, foundation sites, ACNC data, and open government
              sources are available to everyone. What matters is what CivicGraph does after ingestion.
            </p>
            <p>
              The defensible layer is the combination of entity resolution, cross-source linking, frontier
              memory, relationship extraction, fit scoring, alert learning, and workflow attribution. Instead
              of only storing rows, the system learns which pages are alive, which are high-yield, which
              foundations matter, which alerts convert, and which matches turn into real pipeline work.
            </p>
            <p>
              That creates an asset that compounds over time. The data is public. The graph, memory, and
              behavioural feedback are not.
            </p>
          </Prose>

          <Callout color="blue">
            A directory gives you rows. A graph gives you context: which foundation this program belongs to,
            what changed on the source page, which peers were funded before, and why a match is worth acting on.
          </Callout>

          <SectionHeading id="why-now" number="04">Why Now</SectionHeading>
          <Prose>
            <p>
              Two things are now true at once. AI makes continuous extraction, summarisation, and prioritised
              monitoring more practical than it was even a few years ago, while funding work remains
              structurally under-tooled and highly manual.
            </p>
            <p>
              That combination creates a narrow but valuable window. A product can now sit above fragmented
              public information, structure it continuously, and give users a reliable operating surface
              before the category fully matures.
            </p>
            <p>
              Importantly, CivicGraph does not need to replace every existing system on day one. It can win by
              becoming the system that tells a user what matters, why it matters, and what changed while they
              were away.
            </p>
          </Prose>

          <SectionHeading id="already-true" number="05">What Is Already True</SectionHeading>
          <Prose>
            <p>
              This is not a concept deck without operating substance. The current system already has meaningful
              infrastructure behind it: roughly 18K grant opportunities, 10.8K foundations, more than 100K
              entities, roughly 199K relationships, thousands of foundation programs, and more than 50K
              frontier URLs under monitoring.
            </p>
            <p>
              The operating loop is also visible now. The system discovers sources, polls and rescans the
              frontier, extracts opportunities and relationship signals, syncs them into the product layer,
              matches them against organisation profiles, queues alerts, and tracks whether those alerts
              actually create pipeline work.
            </p>
            <p>
              On the product side, the workflow is coherent: profile, matched grants, shortlist, tracker,
              alerts, billing, and operational instrumentation. That shifts the question from “can this be
              built?” to “will users trust it, return for it, and pay for it?”
            </p>
          </Prose>

          <div className="grid grid-cols-2 gap-4 my-8 max-w-2xl">
            <Stat value="199K+" label="Relationships" color="text-bauhaus-blue" />
            <Stat value="2K+" label="Foundation Programs" color="text-bauhaus-red" />
            <Stat value="Live" label="Alert Attribution" color="text-bauhaus-blue" />
            <Stat value="Live" label="Billing + Funnel Metrics" color="text-bauhaus-red" />
          </div>

          <SectionHeading id="commercial" number="06">Commercial Path</SectionHeading>
          <Prose>
            <p>
              The fastest path to revenue is still the clearest one: sell first to grant consultants,
              freelance grant writers, and small advisory firms, then expand into in-house grants and
              fundraising teams.
            </p>
            <p>
              Consultants are the strongest initial customer because they feel the pain most often, work
              across multiple clients, and can justify spend on leverage faster than a typical nonprofit team.
              The product they buy is not “data infrastructure.” It is a system that tells them what to
              pursue next, why it fits, and what changed before they found it manually.
            </p>
            <p>
              That supports a clean commercial ladder: self-serve for solo operators, team plans for shared
              workflow, and higher-value intelligence for funders, commissioners, and enterprise users later.
            </p>
          </Prose>

          <Callout color="red">
            The wedge is operational. The long-term category is decision infrastructure. The company only earns
            the bigger story if the smaller story wins first.
          </Callout>

          <SectionHeading id="proof" number="07">What Must Be Proven Next</SectionHeading>
          <Prose>
            <p>
              The next stage is not about adding more top-level modules. It is about proving trust,
              activation, retention, and payment.
            </p>
            <p>
              Trust means strong precision on matched grants, open-now status, and foundation signal quality.
              Activation means users reach first value quickly: profile completed, shortlist created, tracker
              started, alert engaged. Retention means the alert and digest loop becomes useful enough that the
              product feels alive between sessions. Payment means consultants and funding teams convert because
              the system is saving them time and creating better pipeline work.
            </p>
            <p>
              If CivicGraph proves those four things, it can grow from a useful workflow product into a much
              more important intelligence layer for the sector. That is the real investment case.
            </p>
          </Prose>

          <ReportCTA reportSlug="civicgraph-thesis" reportTitle="The CivicGraph Investor Memo" variant="inline" />

          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6 bauhaus-shadow-sm mt-12 max-w-3xl">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Read Next</div>
            <div className="space-y-2 text-sm font-bold">
              <Link href="/reports/grant-frontier" className="block text-bauhaus-blue hover:text-bauhaus-red">
                Grant Source Control Surface
              </Link>
              <Link href="/reports/philanthropy" className="block text-bauhaus-blue hover:text-bauhaus-red">
                Foundation Intelligence
              </Link>
              <Link href="/pricing" className="block text-bauhaus-blue hover:text-bauhaus-red">
                Pricing and product wedge
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
