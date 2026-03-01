export default function ReportsPage() {
  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Investigations</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Living Reports</h1>
        <p className="text-bauhaus-muted font-medium">
          Data-driven investigations into where money flows, who holds power, and what outcomes result.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <a href="/reports/youth-justice" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-red group-hover:text-white">
            <div className="text-xs font-black text-bauhaus-red mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Flagship</div>
            <h2 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">QLD Youth Justice</h2>
            <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
              $343M/year on detention. $1.3M per child. 73% reoffend.
              Follow the money from taxpayer to outcome.
            </p>
          </div>
        </a>

        <a href="/reports/money-flow" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-blue group-hover:text-white">
            <div className="text-xs font-black text-bauhaus-blue mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
            <h2 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Follow the Dollar</h2>
            <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
              Trace funding flows from taxpayer to outcome across all domains.
              Interactive flow diagrams for every tracked program.
            </p>
          </div>
        </a>

        <a href="/reports/access-gap" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-yellow">
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest group-hover:text-bauhaus-black">Live</div>
            <h2 className="text-xl font-black text-bauhaus-black mb-2">The Access Gap</h2>
            <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-bauhaus-black/70">
              Small orgs spend 40% on admin. Large orgs spend 15%.
              The structural barriers to community funding.
            </p>
          </div>
        </a>

        <a href="/reports/power-dynamics" className="group block">
          <div className="bg-white border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm group-hover:bg-bauhaus-black group-hover:text-white">
            <div className="text-xs font-black text-purple mb-2 uppercase tracking-widest group-hover:text-bauhaus-yellow">Live</div>
            <h2 className="text-xl font-black text-bauhaus-black mb-2 group-hover:text-white">Power Dynamics</h2>
            <p className="text-sm text-bauhaus-muted leading-relaxed group-hover:text-white/80">
              Who controls Australia&apos;s philanthropy? HHI concentration,
              Gini inequality, and funding distribution analysis.
            </p>
          </div>
        </a>

        <a href="/reports/big-philanthropy" className="group block sm:col-span-2">
          <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 transition-all group-hover:-translate-y-1" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
            <div className="text-xs font-black text-bauhaus-yellow mb-2 uppercase tracking-widest">Data Investigation</div>
            <h2 className="text-xl font-black text-white mb-2">Where Does Australia&apos;s $222 Billion Go?</h2>
            <p className="text-sm text-bauhaus-muted leading-relaxed">
              An investigation into 359,678 charity financial records across 7 years, revealing
              the concentration of philanthropic power. 53,207 charities. ACNC AIS data 2017-2023.
            </p>
          </div>
        </a>
      </div>
    </div>
  );
}
