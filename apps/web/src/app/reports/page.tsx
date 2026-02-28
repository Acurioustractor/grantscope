export default function ReportsPage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Living Reports</h1>
        <p className="text-navy-500">
          Data-driven investigations into where money flows, who holds power, and what outcomes result.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <a href="/reports/youth-justice" className="group block">
          <div className="bg-white border-2 border-danger rounded-xl p-6 transition-all group-hover:shadow-lg group-hover:-translate-y-0.5">
            <div className="text-xs font-bold text-danger mb-2 uppercase tracking-wider">Flagship</div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">QLD Youth Justice</h2>
            <p className="text-sm text-navy-500 leading-relaxed">
              $343M/year on detention. $1.3M per child. 73% reoffend.
              Follow the money from taxpayer to outcome.
            </p>
          </div>
        </a>

        <a href="/reports/money-flow" className="group block">
          <div className="bg-white border-2 border-link rounded-xl p-6 transition-all group-hover:shadow-lg group-hover:-translate-y-0.5">
            <div className="text-xs font-bold text-link mb-2 uppercase tracking-wider">Live</div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">Follow the Dollar</h2>
            <p className="text-sm text-navy-500 leading-relaxed">
              Trace funding flows from taxpayer to outcome across all domains.
              Interactive flow diagrams for every tracked program.
            </p>
          </div>
        </a>

        <a href="/reports/access-gap" className="group block">
          <div className="bg-white border-2 border-warning rounded-xl p-6 transition-all group-hover:shadow-lg group-hover:-translate-y-0.5">
            <div className="text-xs font-bold text-warning mb-2 uppercase tracking-wider">Live</div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">The Access Gap</h2>
            <p className="text-sm text-navy-500 leading-relaxed">
              Small orgs spend 40% on admin. Large orgs spend 15%.
              The structural barriers to community funding.
            </p>
          </div>
        </a>

        <a href="/reports/power-dynamics" className="group block">
          <div className="bg-white border-2 border-purple rounded-xl p-6 transition-all group-hover:shadow-lg group-hover:-translate-y-0.5">
            <div className="text-xs font-bold text-purple mb-2 uppercase tracking-wider">Live</div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">Power Dynamics</h2>
            <p className="text-sm text-navy-500 leading-relaxed">
              Who controls Australia&apos;s philanthropy? HHI concentration,
              Gini inequality, and funding distribution analysis.
            </p>
          </div>
        </a>
      </div>
    </div>
  );
}
