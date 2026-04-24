import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { buildPhilanthropyPowerReport } from '@grant-engine/reports/philanthropy-power';

export const dynamic = 'force-dynamic';

function money(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function PhilanthropyPowerPage() {
  const supabase = getServiceSupabase();
  const report = await buildPhilanthropyPowerReport(supabase);

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; All Reports
        </a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Philanthropy Gatekeepers and Open Capital
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          This is the power map behind Australian philanthropy: who holds the capital, who stays publicly
          approachable, who remains opaque, and where grantmaking discipline is concentrated by theme and geography.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <Link href="/graph" className="px-3 py-2 border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
            Open funding workspace
          </Link>
          <Link href="/foundations" className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light hover:bg-bauhaus-blue hover:text-white transition-colors">
            Search foundations
          </Link>
          <Link href="/reports/power-dynamics" className="px-3 py-2 border-2 border-bauhaus-red text-bauhaus-red bg-bauhaus-red/5 hover:bg-bauhaus-red hover:text-white transition-colors">
            Compare concentration metrics
          </Link>
        </div>
      </div>

      <section className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Tracked Annual Giving</div>
            <div className="text-4xl font-black">{money(report.metrics.totalGiving)}</div>
            <div className="text-white/60 text-xs font-bold mt-2">{report.metrics.givingFoundationCount.toLocaleString('en-AU')} foundations with giving data</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Open Capital Share</div>
            <div className="text-4xl font-black text-bauhaus-blue">{pct(report.metrics.openCapitalShare)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">
              {report.metrics.relationshipReadyCount.toLocaleString('en-AU')} relationship-ready foundations
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Opaque Capital Share</div>
            <div className="text-4xl font-black text-bauhaus-red">{pct(report.metrics.opaqueCapitalShare)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">{money(report.metrics.gatekeptGiving)} sits behind low-openness profiles</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-yellow text-bauhaus-black">
            <div className="text-xs font-black uppercase tracking-widest mb-2">Filtered Operators</div>
            <div className="text-4xl font-black">{report.metrics.excludedOperatorCount.toLocaleString('en-AU')}</div>
            <div className="text-bauhaus-black/70 text-xs font-bold mt-2">{money(report.metrics.excludedOperatorGiving)} removed from the capital-holder layer</div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Public Signals</div>
              <div className="text-lg font-black leading-tight">
                {report.metrics.withApplicationTips.toLocaleString('en-AU')} tips &middot; {report.metrics.withOpenPrograms.toLocaleString('en-AU')} open programs
              </div>
              <div className="text-bauhaus-muted text-xs font-bold mt-2">
                {report.metrics.withGivingPhilosophy.toLocaleString('en-AU')} explain giving philosophy
              </div>
            </div>
            <div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Classifier Rule</div>
              <p className="text-sm font-medium text-bauhaus-muted">
                This report now excludes high-revenue operators, universities, legal aid bodies, hospitals, and service charities unless they show credible philanthropic capital-holder signals.
              </p>
            </div>
            <div>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Why it matters</div>
              <p className="text-sm font-medium text-bauhaus-muted">
                The point is not to flatter the size of the sector. It is to show who actually holds philanthropic capital versus who only looks like a grantmaker because they also run services.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Gatekeeping Layer</p>
            <h2 className="text-2xl font-black text-white">High-giving foundations with low public openness</h2>
            <p className="text-sm text-white/80 font-medium mt-2 max-w-2xl">
              These foundations move serious money but disclose little about approachability, open programs,
              or how they think. This is where philanthropic power stays hardest to interrogate.
            </p>
          </div>
          <div className="divide-y-4 divide-bauhaus-black/10">
            {report.gatekeepers.map((foundation) => (
              <div key={foundation.name} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-bauhaus-black">{foundation.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                      <span className="px-2 py-1 border-2 border-bauhaus-red text-bauhaus-red bg-bauhaus-red/5">
                        {money(foundation.totalGiving)} annual giving
                      </span>
                      <span className="px-2 py-1 border-2 border-bauhaus-black/20 text-bauhaus-muted">
                        openness {pct(foundation.opennessScore * 100)}
                      </span>
                      <span className="px-2 py-1 border-2 border-bauhaus-black/20 text-bauhaus-muted">
                        {foundation.capitalHolderClass.replace(/_/g, ' ')}
                      </span>
                      {foundation.thematicFocus.slice(0, 3).map((theme) => (
                        <span key={`${foundation.name}-${theme}`} className="px-2 py-1 border-2 border-bauhaus-black/20 text-bauhaus-muted">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                    {foundation.opennessLabel}
                  </div>
                </div>
                <ul className="mt-3 text-sm font-medium text-bauhaus-muted list-disc pl-5 space-y-1">
                  {foundation.reasons.length > 0 ? foundation.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>No public approach signals found</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Relationship Layer</p>
            <h2 className="text-2xl font-black text-white">Foundations that look plausibly approachable</h2>
            <p className="text-sm text-white/80 font-medium mt-2">
              These are the better entry points: clearer guidance, better profile quality, more open programs,
              and stronger geography/theme discipline.
            </p>
          </div>
          <div className="divide-y-4 divide-bauhaus-black/10">
            {report.relationshipReady.map((foundation) => (
              <div key={foundation.name} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-bauhaus-black">{foundation.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                      <span className="px-2 py-1 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light">
                        {money(foundation.totalGiving)} annual giving
                      </span>
                      <span className="px-2 py-1 border-2 border-bauhaus-black/20 text-bauhaus-muted">
                        openness {pct(foundation.opennessScore * 100)}
                      </span>
                      <span className="px-2 py-1 border-2 border-bauhaus-black/20 text-bauhaus-muted">
                        {foundation.capitalSourceClass.replace(/_/g, ' ')}
                      </span>
                      {foundation.geographicFocus.slice(0, 2).map((focus) => (
                        <span key={`${foundation.name}-${focus}`} className="px-2 py-1 border-2 border-bauhaus-black/20 text-bauhaus-muted">
                          {focus}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                    {foundation.opennessLabel}
                  </div>
                </div>
                <ul className="mt-3 text-sm font-medium text-bauhaus-muted list-disc pl-5 space-y-1">
                  {foundation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-yellow border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Theme Discipline</p>
            <h2 className="text-2xl font-black text-bauhaus-black">Where philanthropic capital clusters</h2>
          </div>
          <div className="divide-y-4 divide-bauhaus-black/10">
            {report.themePower.map((theme) => (
              <div key={theme.theme} className="p-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-bauhaus-black">{theme.theme}</h3>
                  <p className="text-sm text-bauhaus-muted font-medium mt-1">
                    {theme.foundationCount.toLocaleString('en-AU')} foundations &middot; top giver {theme.topFoundation}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-bauhaus-black">{money(theme.totalGiving)}</div>
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mt-1">
                    {pct(theme.openCapitalShare)} open &middot; {pct(theme.opaqueCapitalShare)} opaque
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Geography Discipline</p>
            <h2 className="text-2xl font-black text-white">Where grantmaking attention clusters</h2>
          </div>
          <div className="divide-y-4 divide-bauhaus-black/10">
            {report.geographyPower.map((geo) => (
              <div key={geo.geography} className="p-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-bauhaus-black">{geo.geography}</h3>
                  <p className="text-sm text-bauhaus-muted font-medium mt-1">
                    {geo.foundationCount.toLocaleString('en-AU')} foundations &middot; top giver {geo.topFoundation}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-bauhaus-black">{money(geo.totalGiving)}</div>
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mt-1">
                    {pct(geo.openCapitalShare)} relationship-ready
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
        <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Why this matters</p>
        <p className="text-base font-medium text-bauhaus-black/80 leading-relaxed max-w-4xl">
          The problem is not just how much philanthropic money exists. It is how much of that capital is hidden behind
          opaque profiles, unclear approach pathways, and concentrated theme or geography discipline. This layer lets
          users search for money, for delivery, and for gatekeeping behavior in one system instead of treating foundations
          as a black box that communities are somehow meant to decode themselves.
        </p>
      </section>
    </div>
  );
}
