'use client';

import Link from 'next/link';

/**
 * PHN Commissioning Intelligence — scaffold page.
 * Shows the value prop and what data we'd need to build the full product.
 * Currently maps our existing data (entities, SEIFA, ALMA interventions)
 * against the PHN commissioning use case.
 */
export default function CommissioningPage() {
  return (
    <div className="max-w-5xl">
      <Link href="/procurement" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Procurement Dashboard
      </Link>

      <div className="mt-4 mb-6">
        <div className="bg-white border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-blue)' }}>
          <p className="text-xs font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-3">CivicGraph — Coming Soon</p>
          <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black leading-tight mb-3">
            Commissioning Intelligence
          </h1>
          <p className="text-bauhaus-muted font-medium max-w-3xl leading-relaxed">
            Place-based health and social care commissioning for Primary Health Networks.
            Map provider capabilities against population needs, identify thin markets,
            and commission evidence-based interventions — powered by ALMA and CivicGraph data.
          </p>
        </div>
      </div>

      {/* What we have */}
      <div className="space-y-6">
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-widest">Data Available Now</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-bauhaus-black/10">
            {[
              {
                title: 'Entity Graph',
                stats: '143K entities, 301K relationships',
                desc: 'Charities, Indigenous corps, social enterprises mapped by LGA, postcode, SEIFA disadvantage decile, and remoteness.',
                ready: true,
              },
              {
                title: 'ALMA Evidence Base',
                stats: '1,155 interventions, 570 evidence records',
                desc: 'Australian Living Map of Alternatives — evidence-rated intervention programs with outcome measurement and geographic coverage.',
                ready: true,
              },
              {
                title: 'Place Intelligence',
                stats: '492 LGAs, 12K postcodes',
                desc: 'SEIFA disadvantage scores, remoteness classification, funding flows by region, entity density mapping.',
                ready: true,
              },
            ].map((item, i) => (
              <div key={i} className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-black uppercase tracking-wider">{item.title}</h3>
                  {item.ready && <span className="text-[10px] px-1.5 py-0.5 font-black border border-money bg-money/10 text-money">LIVE</span>}
                </div>
                <p className="text-xs font-mono text-bauhaus-blue mb-2">{item.stats}</p>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What we need */}
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-red/5 border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-widest">Data Needed to Complete</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-bauhaus-black/10">
            {[
              {
                title: 'Health Workforce Data',
                source: 'National Health Workforce Dataset (NHWDS)',
                desc: 'GP, allied health, and specialist FTE ratios per SA2/LGA. Required for identifying clinical workforce shortages and thin markets.',
              },
              {
                title: 'PHN Boundaries + Needs',
                source: 'Dept of Health / PHN HNA Reports',
                desc: 'Geographic catchment boundaries for 31 PHNs, plus their published Health Needs Assessments for priority area identification.',
              },
              {
                title: 'MBS/PBS Utilisation',
                source: 'Services Australia / AIHW',
                desc: 'Medicare and pharmaceutical utilisation rates by geography to identify areas of under-service and unmet demand.',
              },
              {
                title: 'Community Voice Data',
                source: 'PHN consultations / lived experience',
                desc: 'Qualitative data from community consultations, integrated with consent-aware governance via Empathy Ledger framework.',
              },
            ].map((item, i) => (
              <div key={i} className="p-5">
                <h3 className="text-sm font-black uppercase tracking-wider mb-1">{item.title}</h3>
                <p className="text-[10px] font-mono text-bauhaus-red mb-2">{item.source}</p>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Use cases */}
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-widest">PHN Commissioning Use Cases</h2>
          </div>
          <div className="divide-y divide-bauhaus-black/10">
            {[
              {
                title: 'Thin Market Identification',
                desc: 'Cross-reference population health needs with local provider density to identify areas where no capable provider exists to absorb commissioned funding.',
                data: 'Entities + SEIFA + Health Workforce',
              },
              {
                title: 'Evidence-Based Intervention Matching',
                desc: 'Match ALMA-rated intervention programs (with proven effectiveness evidence) to specific LGA-level population needs and available provider capabilities.',
                data: 'ALMA + Entities + Place Data',
              },
              {
                title: 'Service Gap Mapping',
                desc: 'Visualise geographic gaps between population demand (derived from MBS utilisation) and provider supply (entity graph + workforce data).',
                data: 'Entities + MBS + Health Workforce + PHN Boundaries',
              },
              {
                title: 'Cultural Safety Commissioning',
                desc: 'Identify community-controlled and culturally safe providers for Indigenous health commissioning, cross-referenced with community demand indicators.',
                data: 'Entities (7.8K CC orgs) + ALMA + Closing the Gap data',
              },
            ].map((uc, i) => (
              <div key={i} className="p-5">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-sm font-black">{uc.title}</h3>
                  <span className="text-[10px] font-mono text-bauhaus-muted flex-shrink-0 ml-4">{uc.data}</span>
                </div>
                <p className="text-sm text-bauhaus-muted leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 text-center">
          <p className="text-white font-black text-sm uppercase tracking-widest mb-2">Interested in Commissioning Intelligence?</p>
          <p className="text-white/60 text-sm mb-4">Contact us to discuss early access for your PHN or commissioning body.</p>
          <a
            href="mailto:hello@civicgraph.au?subject=Commissioning Intelligence Interest"
            className="inline-block px-6 py-3 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
          >
            Get In Touch
          </a>
        </div>
      </div>
    </div>
  );
}
