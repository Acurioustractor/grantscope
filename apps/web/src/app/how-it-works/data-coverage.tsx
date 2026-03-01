'use client';

interface CoverageStats {
  acncRecords: number;
  foundations: number;
  foundationsProfiled: number;
  grants: number;
  community: number;
  aisRecords: number;
  moneyFlows: number;
}

// Known universe sizes for Australian philanthropy/grants data
const UNIVERSE = {
  acncCharities: 60000,       // ~60k active registered charities (ACNC)
  foundations: 5000,           // ~4-5k active giving foundations (PAFs + PuAFs + trusts)
  grantsConnect: 50000,        // ~50k+ grant awards published since 2017
  stateGrants: 5000,           // Estimated state-level grants across 6 states
  communityOrgs: 30000,        // Estimated grassroots/community orgs
  corporateGiving: 200,        // ASX200 corporate giving programs
};

function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`.replace('.0M', 'M');
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`.replace('.0k', 'k');
  return n.toLocaleString();
}

function ProgressBar({ current, total, color, label, sublabel }: {
  current: number;
  total: number;
  color: string;
  label: string;
  sublabel: string;
}) {
  const pct = Math.min(Math.round((current / total) * 100), 100);
  const barColor = color === 'red' ? 'bg-bauhaus-red' : color === 'blue' ? 'bg-bauhaus-blue' : color === 'yellow' ? 'bg-bauhaus-yellow' : 'bg-bauhaus-black';

  return (
    <div className="bg-white border-4 border-bauhaus-black p-4">
      <div className="flex items-baseline justify-between mb-1">
        <div className="font-black text-bauhaus-black text-sm uppercase tracking-wider">{label}</div>
        <div className="text-xs font-black text-bauhaus-muted">{fmt(current)} / {fmt(total)}</div>
      </div>
      <div className="text-xs text-bauhaus-muted font-medium mb-2">{sublabel}</div>
      <div className="h-6 bg-bauhaus-canvas border-2 border-bauhaus-black relative overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-black ${pct > 50 ? 'text-white' : 'text-bauhaus-black'}`}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function DataCoverage({ coverage }: { coverage: CoverageStats }) {
  const totalHave = coverage.acncRecords + coverage.foundations + coverage.grants + coverage.community + coverage.aisRecords + coverage.moneyFlows;
  const totalUniverse = UNIVERSE.acncCharities + UNIVERSE.foundations + (UNIVERSE.grantsConnect + UNIVERSE.stateGrants) + UNIVERSE.communityOrgs + (UNIVERSE.acncCharities * 7) + 5000;
  const overallPct = Math.round((totalHave / totalUniverse) * 100);

  return (
    <div className="max-w-4xl mx-auto mt-16">
      <div className="border-t-4 border-bauhaus-black pt-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-1">Transparency</p>
            <h2 className="text-2xl font-black text-bauhaus-black">Data Coverage</h2>
            <p className="text-bauhaus-muted text-sm font-medium mt-1">
              How much of Australia&apos;s funding data we&apos;ve collected, enriched, and made searchable.
            </p>
          </div>
          <div className="bg-bauhaus-black px-5 py-3 flex-shrink-0">
            <div className="text-3xl font-black text-bauhaus-yellow tabular-nums">{overallPct}%</div>
            <div className="text-xs font-black text-white/60 uppercase tracking-widest">Overall</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          <div className="-mb-[4px] -mr-[4px] sm:-mr-0">
            <ProgressBar
              current={coverage.acncRecords}
              total={UNIVERSE.acncCharities}
              color="blue"
              label="Registered Charities"
              sublabel={`ACNC register — ${fmt(UNIVERSE.acncCharities)} active charities`}
            />
          </div>
          <div className="-mb-[4px] -mr-[4px] lg:-mr-0">
            <ProgressBar
              current={coverage.foundationsProfiled}
              total={coverage.foundations}
              color="red"
              label="Foundations Profiled"
              sublabel={`AI-enriched with giving philosophy & focus areas`}
            />
          </div>
          <div className="-mb-[4px]">
            <ProgressBar
              current={coverage.grants}
              total={UNIVERSE.grantsConnect + UNIVERSE.stateGrants}
              color="yellow"
              label="Grant Opportunities"
              sublabel={`Federal, state, council — NSW, QLD, Brisbane + more`}
            />
          </div>
          <div className="-mb-[4px] -mr-[4px] sm:-mr-0">
            <ProgressBar
              current={coverage.aisRecords}
              total={UNIVERSE.acncCharities * 7}
              color="blue"
              label="Financial Statements"
              sublabel={`ACNC Annual Information Statements (2017–2023)`}
            />
          </div>
          <div className="-mb-[4px] -mr-[4px] lg:-mr-0">
            <ProgressBar
              current={coverage.community}
              total={UNIVERSE.communityOrgs}
              color="black"
              label="Community Orgs"
              sublabel={`Grassroots organisations with admin burden analysis`}
            />
          </div>
          <div className="-mb-[4px]">
            <ProgressBar
              current={coverage.moneyFlows}
              total={5000}
              color="red"
              label="Money Flows"
              sublabel={`Tracked funding flows between foundations and recipients`}
            />
          </div>
        </div>

        <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-4 mt-6">
          <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Coming Next</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'VIC Grants', est: '~1,500' },
              { label: 'WA Grants', est: '~800' },
              { label: 'SA Grants', est: '~500' },
              { label: 'TAS Grants', est: '~200' },
              { label: 'ASX200 Corporate', est: '~200' },
              { label: 'Fellowships', est: '~500' },
              { label: 'GrantConnect Full', est: '~50k' },
            ].map(item => (
              <div key={item.label} className="bg-white border-2 border-bauhaus-black/20 px-3 py-1.5 flex items-center gap-2">
                <span className="w-2 h-2 bg-bauhaus-muted" />
                <span className="text-xs font-bold text-bauhaus-muted">{item.label}</span>
                <span className="text-[10px] text-bauhaus-muted/60">{item.est}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
