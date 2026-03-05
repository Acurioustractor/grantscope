export default function ReportsPage() {
  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Research Wiki</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Living Reports</h1>
        <p className="text-bauhaus-muted font-medium max-w-2xl">
          Data-driven investigations into where money flows, who holds power, and what communities
          can do about it. Start anywhere &mdash; each report links to the others.
        </p>
      </div>

      {/* Reading order guide */}
      <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-5 mb-10 bauhaus-shadow-sm max-w-2xl">
        <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Suggested Reading Order</p>
        <ol className="space-y-2 text-sm font-medium text-bauhaus-black/80">
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">1.</span>
            <span><a href="/reports/big-philanthropy" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">$222 Billion</a> &mdash; Where does Australia&apos;s charity money actually go?</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">2.</span>
            <span><a href="/reports/community-parity" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Community Parity</a> &mdash; Who benefits, who misses out, and why</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">3.</span>
            <span><a href="/reports/power-dynamics" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Power Dynamics</a> &mdash; Concentration, inequality, and who controls the levers</span>
          </li>
          <li className="flex gap-2">
            <span className="text-bauhaus-red font-black">4.</span>
            <span><a href="/reports/community-power" className="font-bold text-bauhaus-blue hover:text-bauhaus-red">Community Power Playbook</a> &mdash; The alternative: what communities are building</span>
          </li>
        </ol>
      </div>

      {/* ===== SECTION A: THE PROBLEM ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">The Problem</h2>
          <p className="text-sm text-bauhaus-muted font-medium">Investigations into how Australia&apos;s funding system works &mdash; and who it works for.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/big-philanthropy" className="group block sm:col-span-2">
            <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Data Investigation</div>
              <h3 className="text-xl font-black text-white mb-2">Where Does Australia&apos;s $222 Billion Go?</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                An investigation into 359,678 charity financial records across 7 years, revealing
                the concentration of philanthropic power. 53,207 charities. ACNC AIS data 2017-2023.
              </p>
            </div>
          </a>

          <a href="/reports/community-parity" className="group block sm:col-span-2">
            <div className="bg-bauhaus-red border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm">
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">New Investigation</div>
              <h3 className="text-xl font-black text-white mb-2">Big Philanthropy &amp; Community Parity</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                0.5% to First Nations. 12% to women &amp; girls. 94% to the top 10%.
                How philanthropy concentrates power, who it leaves behind, and what the tax system enables.
              </p>
            </div>
          </a>

          <a href="/reports/power-dynamics" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-purple mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Power Dynamics</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                Who controls Australia&apos;s philanthropy? HHI concentration,
                Gini inequality, and funding distribution analysis.
              </p>
            </div>
          </a>

          <a href="/reports/access-gap" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-yellow">
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest group-hover:text-bauhaus-black">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2">The Access Gap</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-bauhaus-black/70">
                Small orgs spend 40% on admin. Large orgs spend 15%.
                The structural barriers to community funding.
              </p>
            </div>
          </a>

          <a href="/charities/insights" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
              <div className="text-xs font-black text-money mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">New</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Charity Sector Insights</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                The anatomy of {(64473).toLocaleString()} charities. Size pyramid, geography,
                purposes, beneficiaries, grant-makers, and 7-year financial trends.
              </p>
            </div>
          </a>

          <a href="/reports/money-flow" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Follow the Dollar</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                Trace funding flows from taxpayer to outcome across all domains.
                Interactive flow diagrams for every tracked program.
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* ===== SECTION B: CASE STUDIES ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">Case Studies</h2>
          <p className="text-sm text-bauhaus-muted font-medium">Specific domain investigations where the data tells a story.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/youth-justice" className="group block">
            <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
              <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Flagship</div>
              <h3 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">QLD Youth Justice</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
                $343M/year on detention. $1.3M per child. 73% reoffend.
                Follow the money from taxpayer to outcome.
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* ===== SECTION C: THE ALTERNATIVE ===== */}
      <section className="mb-12">
        <div className="mb-5">
          <h2 className="text-xl font-black text-bauhaus-black mb-1">The Alternative</h2>
          <p className="text-sm text-bauhaus-muted font-medium">What community-led economic power looks like &mdash; and what&apos;s already working.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <a href="/reports/community-power" className="group block sm:col-span-2">
            <div className="bg-bauhaus-blue border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-yellow)' }}>
              <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">New Report</div>
              <h3 className="text-xl font-black text-white mb-2">Community Power Playbook</h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Cooperatives, revolving funds, social enterprise, timebanking, and the models that
                are already building community economic sovereignty across Australia.
                1,819 co-ops. 20,000 social enterprises. $21.3B in revenue.
              </p>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
