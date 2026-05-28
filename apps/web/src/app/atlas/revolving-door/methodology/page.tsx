import Link from 'next/link';

export const metadata = {
  title: 'Methodology — Revolving Door Explorer — CivicGraph',
  description: 'How CivicGraph computes the revolving-door score: influence vectors across lobbying, donations, contracts, and funding.',
};

export default function RevolvingDoorMethodologyPage() {
  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/atlas/revolving-door" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Revolving Door
        </Link>

        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-6">
          <div className="inline-block bg-bauhaus-yellow border-2 border-bauhaus-black px-3 py-1 text-xs font-black uppercase tracking-widest mb-3">
            Methodology · v1
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            How the revolving<br />door score works
          </h1>
        </header>

        <article className="prose-bauhaus">
          <Section heading="What it measures">
            <p>
              The <code className="font-mono text-bauhaus-red">revolving_door_score</code> flags
              Australian entities that play across multiple influence vectors at once. An entity
              that donates to a federal party, holds Commonwealth contracts, and also receives
              government funding has structural touchpoints with policy-makers across procurement,
              campaign finance, and grant-making simultaneously. That is the &quot;revolving door.&quot;
            </p>
            <p>
              It is built on the materialised view <code className="font-mono">mv_revolving_door</code>
              in the CivicGraph database. The MV is refreshed nightly.
            </p>
          </Section>

          <Section heading="The four vectors">
            <ul>
              <li><strong>Lobbies</strong> — listed on the Australian Government Register of Lobbyists.</li>
              <li><strong>Donates</strong> — appears as a donor entity in AEC Annual Returns (party returns + donor returns).</li>
              <li><strong>Contracts</strong> — appears as a supplier on AusTender Commonwealth contracts.</li>
              <li><strong>Receives funding</strong> — appears as a recipient in <code>justice_funding</code> or linked grant streams.</li>
            </ul>
            <p>
              An entity must have at least two of these vectors active to appear in the view.
            </p>
          </Section>

          <Section heading="How the score is computed">
            <p>
              The score is a composite of:
            </p>
            <ul>
              <li>Number of vectors active (2–4)</li>
              <li>Total donation footprint</li>
              <li>Total contract footprint (and distinct buyers)</li>
              <li>Total funding-received footprint</li>
            </ul>
            <p>
              Higher score = more vectors and/or larger dollar magnitude. The current top-of-table
              entities (Telstra, Aspen Medical, Built Pty Ltd) sit around 22 — the four-vector
              ceiling at present dollar weighting. Scores below 10 indicate an entity active in two
              vectors with modest dollar magnitude.
            </p>
          </Section>

          <Section heading="What it does NOT measure">
            <ul>
              <li>
                <strong>State-level lobbying or donations.</strong> Most states maintain their own
                registers; coverage of state lobbying is partial in CivicGraph.
              </li>
              <li>
                <strong>Personal donations by directors or executives.</strong> Only entity-level
                donations are counted. Individual donations from board members or beneficial owners
                are tracked separately in <code>mv_board_donor_links</code>.
              </li>
              <li>
                <strong>Soft influence</strong> — sponsorships, advisory roles, secondments, conference
                hospitality, think-tank funding, &quot;independent&quot; chair positions. CivicGraph
                does not yet have systematic data on these.
              </li>
              <li>
                <strong>Sub-contractor relationships.</strong> Where Entity A holds a Commonwealth
                contract and sub-contracts to Entity B, only Entity A appears as a contracts vector.
              </li>
              <li>
                <strong>Intent.</strong> A high score does not mean wrongdoing. Many entities (large
                consultancies, peak bodies) have legitimate reasons to engage across multiple vectors.
                The score is a starting point for further inquiry, not a verdict.
              </li>
            </ul>
          </Section>

          <Section heading="Known limitations">
            <ul>
              <li>
                <strong>ABN matching is approximate.</strong> The lobbying register, donation
                disclosures, and AusTender use different naming conventions and sometimes report no
                ABN. Where ABN is missing we fall back to canonical-name matching, which can produce
                false positives or false negatives.
              </li>
              <li>
                <strong>Lag in disclosures.</strong> AEC annual returns are filed late in the
                following year. Recent donation activity may not yet appear.
              </li>
              <li>
                <strong>Subsidiary linkage.</strong> A holding company that lobbies and a subsidiary
                that contracts may not be matched as the same beneficial entity. Board interlock data
                (see <code>mv_board_interlocks</code>) helps here.
              </li>
            </ul>
          </Section>

          <Section heading="How to challenge a record">
            <p>
              Every profile page links to the entity&apos;s full record and includes a JSON
              download with source citations. If you find a misattribution, please write to
              feedback@civicgraph.au with the entity name and the correction.
            </p>
          </Section>

          <Section heading="Data sources">
            <ul>
              <li>Australian Government Register of Lobbyists</li>
              <li>Australian Electoral Commission (AEC) Annual Returns</li>
              <li>AusTender (Commonwealth contracts)</li>
              <li><code>justice_funding</code> table and linked grant streams</li>
              <li>Australian Business Register (ABR / ABN Lookup)</li>
              <li>Board appointment records (where available)</li>
            </ul>
          </Section>

          <Section heading="How to cite">
            <p>
              CivicGraph (2026). <em>Revolving Door Explorer: Australian entities active across
              influence vectors</em>. Retrieved from https://civicgraph.au/atlas/revolving-door
            </p>
          </Section>
        </article>
      </div>

      <style>{`
        .prose-bauhaus h2 { font-family: Satoshi, system-ui, sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: 1.25rem; margin-top: 2.5rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid #121212; }
        .prose-bauhaus p { font-family: 'DM Sans', system-ui, sans-serif; font-size: 1rem; line-height: 1.7; margin-bottom: 1rem; color: #121212; }
        .prose-bauhaus ul { list-style: none; padding-left: 0; margin-bottom: 1rem; }
        .prose-bauhaus li { font-family: 'DM Sans', system-ui, sans-serif; font-size: 1rem; line-height: 1.7; margin-bottom: 0.5rem; padding-left: 1.5rem; position: relative; color: #121212; }
        .prose-bauhaus li::before { content: '■'; position: absolute; left: 0; color: #D02020; font-size: 0.8rem; top: 0.4rem; }
        .prose-bauhaus li li { margin-top: 0.4rem; }
        .prose-bauhaus li li::before { content: '–'; color: #1040C0; }
        .prose-bauhaus code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; padding: 0.1em 0.3em; background: #FFE8E8; border: 1px solid #121212; }
        .prose-bauhaus strong { font-weight: 700; }
        .prose-bauhaus em { font-style: italic; }
      `}</style>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{heading}</h2>
      {children}
    </section>
  );
}
