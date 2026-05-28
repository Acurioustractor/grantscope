import Link from 'next/link';

export const metadata = {
  title: 'Methodology — Funding Deserts Atlas — CivicGraph',
  description: 'How CivicGraph computes the desert_score: SEIFA disadvantage + remoteness + funding flow, with honest limitations.',
};

export default function FundingDesertsMethodologyPage() {
  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/atlas/funding-deserts"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; Funding Deserts Atlas
        </Link>

        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-6">
          <div className="inline-block bg-bauhaus-yellow border-2 border-bauhaus-black px-3 py-1 text-xs font-black uppercase tracking-widest mb-3">
            Methodology · v1
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            How the desert<br />score works
          </h1>
        </header>

        <article className="prose-bauhaus">
          <Section heading="What it measures">
            <p>
              The <code className="font-mono text-bauhaus-red">desert_score</code> is a 0–200 composite that
              flags Australian Local Government Areas (LGAs) where structural disadvantage is high but
              measured funding flow (procurement, justice spending, political donations) is low. Higher
              scores mean a worse mismatch between need and money.
            </p>
            <p>
              It is built on the materialised view <code className="font-mono">mv_funding_deserts</code>
              in the CivicGraph database. The MV is refreshed nightly from public-sector sources only.
            </p>
          </Section>

          <Section heading="What goes into it">
            <ul>
              <li>
                <strong>SEIFA IRSD 2021</strong> — the ABS Index of Relative Socio-economic
                Disadvantage. We use the postcode-level decile (1 = most disadvantaged, 10 = least).
                Lower deciles increase the score.
              </li>
              <li>
                <strong>ABS Remoteness 2021</strong> — Major Cities, Inner Regional, Outer Regional,
                Remote, Very Remote. More remote categories increase the score because remote
                communities consistently receive lower per-capita non-government funding.
              </li>
              <li>
                <strong>Funding flow</strong> — summed across three independent public sources:
                <ul>
                  <li>AusTender contracts where the supplier postcode falls in the LGA</li>
                  <li>Justice funding records (per the <code>justice_funding</code> table) linked to entities in the LGA</li>
                  <li>Political donations (AEC) made by entities in the LGA</li>
                </ul>
                Lower funding-per-indexed-entity increases the score.
              </li>
              <li>
                <strong>Indexed entities</strong> — the count of CivicGraph entities (ACNC charities,
                ABR-registered organisations) located in the LGA. We use this to normalise funding flow
                into a per-entity rate.
              </li>
            </ul>
          </Section>

          <Section heading="How the score is computed">
            <p>
              For each LGA × remoteness slice in <code>mv_funding_deserts</code>, the score weights
              SEIFA deficit, remoteness band, and a funding-deficit term computed against the national
              median funding-per-entity. Slices are then aggregated to one row per LGA × state in this
              atlas; the worst-served slice represents the LGA&apos;s headline score.
            </p>
            <p>
              The 0–200 range is interpretable but not normalised against a fixed population. Two LGAs
              with the same score are equally underserved <em>relative to their structural
              disadvantage</em> — not relative to each other in absolute dollar terms.
            </p>
          </Section>

          <Section heading="What it does NOT measure">
            <ul>
              <li>
                <strong>Philanthropic funding from private foundations.</strong> ACNC reporting on
                grant-making is partial. We track foundation activity in
                <code> mv_foundation_grantees</code> but it is excluded from this score until coverage
                is reliable enough to publish.
              </li>
              <li>
                <strong>State government grant programs.</strong> State-level grant data is uneven across
                jurisdictions and not yet integrated. NSW, VIC, QLD have partial coverage; others have
                very little.
              </li>
              <li>
                <strong>In-kind value, volunteer hours, and informal economy.</strong> The score is
                strictly dollar-denominated public-sector flow.
              </li>
              <li>
                <strong>Need versus want.</strong> A high score does not mean an LGA &quot;deserves
                more&quot; funding — it means the dollars going in are low compared to the structural
                disadvantage signal. Whether the dollars are well spent is a separate question.
              </li>
              <li>
                <strong>Money that lands in an LGA but exits.</strong> Where a head-office contractor in
                a capital city delivers services in a remote LGA, the contract is attributed by supplier
                postcode (their office), not by service location. This is a known limitation of AusTender
                data and biases scores upward for service-delivery LGAs.
              </li>
            </ul>
          </Section>

          <Section heading="Known limitations + caveats">
            <ul>
              <li>
                <strong>Postcode-to-LGA mapping</strong> is approximate. ABS uses statistical areas, not
                postcodes; the mapping in <code>postcode_geo</code> is a best-effort join.
              </li>
              <li>
                <strong>LGA boundaries change</strong>. Recent amalgamations (e.g. in QLD, WA) mean some
                historical funding records may map to legacy LGA names.
              </li>
              <li>
                <strong>Some LGAs have very few indexed entities</strong> (under 5). Their per-entity
                normalisation is noisy. We display the raw count so you can apply your own filter.
              </li>
              <li>
                <strong>The score is a composite, not a measurement</strong>. It is designed to surface
                LGAs that deserve a second look, not to rank-order policy priority on its own.
              </li>
            </ul>
          </Section>

          <Section heading="How to challenge a number">
            <p>
              Every LGA profile page includes a JSON download with the raw counts that feed the score.
              The materialised view definition is public; the source tables are listed in the data
              attribution below. If you find a misattribution — an LGA where the supplier-postcode
              method has flagged it as desert when it actually receives substantial service-delivery
              funding from elsewhere — please write to feedback@civicgraph.au with the LGA name and the
              correction. We log corrections in a public errata.
            </p>
          </Section>

          <Section heading="Data sources">
            <ul>
              <li>ABS Census 2021 (SEIFA IRSD 2021)</li>
              <li>ABS Remoteness Structure 2021</li>
              <li>AusTender contracts (Australian Government procurement)</li>
              <li>Australian Charities and Not-for-profits Commission (ACNC) register</li>
              <li>Australian Electoral Commission (AEC) Annual Returns</li>
              <li>Australian Business Register (ABR / ABN Lookup)</li>
              <li>Various state and federal justice funding records (per <code>justice_funding</code> table)</li>
            </ul>
          </Section>

          <Section heading="How to cite">
            <p>
              CivicGraph (2026). <em>Funding Deserts Atlas: Australian LGA disadvantage vs funding
              flow</em>. Retrieved from https://civicgraph.au/atlas/funding-deserts
            </p>
          </Section>
        </article>
      </div>

      {/* Inline styles to avoid pulling Tailwind typography plugin */}
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
