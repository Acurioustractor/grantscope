import Link from 'next/link';

/**
 * PHN Commissioning Intelligence — early-access value pitch + waitlist.
 * Leads with what the product does (the vision) and the real CivicGraph + ALMA
 * foundation it's built on. Figures are corrected to live counts (verified 2026-06-08);
 * round honestly so they don't read as false-precise or rot immediately.
 */
export default function CommissioningPage() {
  return (
    <div className="max-w-5xl">
      <Link href="/procurement" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Procurement Dashboard
      </Link>

      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
          <p className="text-xs font-black text-white/60 uppercase tracking-[0.3em] mb-3">CivicGraph — Early Access</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Commissioning Intelligence
          </h1>
          <p className="text-white/80 font-medium max-w-3xl leading-relaxed">
            Place-based health and social care commissioning for Primary Health Networks.
            Map provider capabilities against population needs, identify thin markets, and commission
            evidence-based interventions — powered by the Australian Living Map of Alternatives (ALMA)
            and the CivicGraph entity graph.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* What it does — lead with value */}
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-widest">What Commissioning Intelligence Does</h2>
          </div>
          <div className="divide-y divide-bauhaus-black/10">
            {[
              {
                title: 'Thin Market Identification',
                desc: 'Cross-reference population health needs with local provider density to identify areas where no capable provider exists to absorb commissioned funding.',
              },
              {
                title: 'Evidence-Based Intervention Matching',
                desc: 'Match ALMA-rated intervention programs (with proven effectiveness evidence) to specific LGA-level population needs and available provider capabilities.',
              },
              {
                title: 'Service Gap Mapping',
                desc: 'Visualise geographic gaps between population demand and provider supply across the entity graph, SEIFA disadvantage and remoteness.',
              },
              {
                title: 'Cultural Safety Commissioning',
                desc: 'Identify community-controlled and culturally safe providers for Indigenous health commissioning, cross-referenced with community demand indicators.',
              },
            ].map((uc, i) => (
              <div key={i} className="p-5">
                <h3 className="text-sm font-black mb-1">{uc.title}</h3>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* The real foundation it's built on */}
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-widest">Built on CivicGraph + ALMA</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-bauhaus-black/10">
            {[
              {
                title: 'Entity Graph',
                stats: '600K+ entities · 1.6M relationships',
                desc: 'Charities, Indigenous corporations and social enterprises mapped by LGA, postcode, SEIFA disadvantage decile and remoteness.',
              },
              {
                title: 'ALMA Evidence Base',
                stats: '2,000+ interventions · 630+ evidence records',
                desc: 'Australian Living Map of Alternatives — evidence-rated intervention programs with outcome measurement and geographic coverage.',
              },
              {
                title: 'Place Intelligence',
                stats: '489 LGAs · 12K postcodes',
                desc: 'SEIFA disadvantage scores, remoteness classification, funding flows by region and entity-density mapping.',
              },
            ].map((item, i) => (
              <div key={i} className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-black uppercase tracking-wider">{item.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 font-black border border-money bg-money/10 text-money">LIVE</span>
                </div>
                <p className="text-xs font-mono text-bauhaus-blue mb-2">{item.stats}</p>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Waitlist CTA */}
        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-center">
          <p className="text-white font-black text-sm uppercase tracking-widest mb-2">Want Commissioning Intelligence for your PHN?</p>
          <p className="text-white/60 text-sm mb-4">Register your interest and we&apos;ll line you up for early access as the commissioning toolset ships.</p>
          <a
            href="mailto:hello@civicgraph.au?subject=Commissioning Intelligence — early access"
            className="inline-block px-6 py-3 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
          >
            Register Interest
          </a>
        </div>
      </div>
    </div>
  );
}
