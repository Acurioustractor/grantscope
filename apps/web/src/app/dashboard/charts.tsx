'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SectorRow { sector: string; count: number; total_giving: number }
interface GeoRow { geo: string; count: number; total_giving: number }
interface TopFoundation { name: string; total_giving_annual: number; type: string | null; profile_confidence: string }
interface ClosingGrant { id: string; name: string; provider: string; closes_at: string; amount_max: number | null }
interface SourceRow { source: string; count: number }

interface Props {
  sectors: SectorRow[];
  geography: GeoRow[];
  topFoundations: TopFoundation[];
  closingSoon: ClosingGrant[];
  sources: SourceRow[];
  profiledPct: number;
  embeddedPct: number;
  profiledCount: number;
  embeddedCount: number;
  totalFoundations: number;
  totalGrants: number;
}

function formatMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const BAUHAUS_COLORS = ['#1040C0', '#D02020', '#F0C020', '#059669', '#7c3aed', '#f97316', '#121212', '#777777'];

const TYPE_COLORS: Record<string, string> = {
  private_ancillary_fund: '#1040C0',
  public_ancillary_fund: '#D02020',
  trust: '#F0C020',
  corporate_foundation: '#059669',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5">
      <h3 className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EnrichmentProgress({ profiledPct, embeddedPct, profiledCount, embeddedCount, totalFoundations, totalGrants }: {
  profiledPct: number; embeddedPct: number; profiledCount: number; embeddedCount: number; totalFoundations: number; totalGrants: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs font-black text-bauhaus-black mb-1">
          <span>Foundations Profiled</span>
          <span className="tabular-nums">{profiledCount.toLocaleString()} / {totalFoundations.toLocaleString()}</span>
        </div>
        <div className="h-6 bg-bauhaus-canvas border-4 border-bauhaus-black relative">
          <div
            className="h-full bg-bauhaus-red absolute top-0 left-0 flex items-center justify-end pr-2"
            style={{ width: `${profiledPct}%` }}
          >
            <span className="text-[11px] font-black text-white">{profiledPct}%</span>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs font-black text-bauhaus-black mb-1">
          <span>Grants Embedded</span>
          <span className="tabular-nums">{embeddedCount.toLocaleString()} / {totalGrants.toLocaleString()}</span>
        </div>
        <div className="h-6 bg-bauhaus-canvas border-4 border-bauhaus-black relative">
          <div
            className="h-full bg-bauhaus-blue absolute top-0 left-0 flex items-center justify-end pr-2"
            style={{ width: `${embeddedPct}%` }}
          >
            <span className="text-[11px] font-black text-white">{embeddedPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bauhaus-black text-white p-2 border-0 text-xs font-bold">
      <div>{label}</div>
      <div className="text-bauhaus-yellow tabular-nums">{formatMoney(payload[0].value)}</div>
    </div>
  );
}

export function DashboardCharts(props: Props) {
  const sectorData = props.sectors.map(s => ({
    name: s.sector.charAt(0).toUpperCase() + s.sector.slice(1).replace(/_/g, ' '),
    value: s.total_giving,
    count: s.count,
  }));

  const geoData = props.geography.map(g => ({
    name: g.geo,
    value: g.total_giving,
    count: g.count,
  }));

  const foundationData = props.topFoundations.map(f => ({
    name: f.name.length > 30 ? f.name.slice(0, 30) + '\u2026' : f.name,
    value: f.total_giving_annual,
    type: f.type,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Enrichment Progress */}
      <ChartCard title="Enrichment Progress">
        <EnrichmentProgress
          profiledPct={props.profiledPct}
          embeddedPct={props.embeddedPct}
          profiledCount={props.profiledCount}
          embeddedCount={props.embeddedCount}
          totalFoundations={props.totalFoundations}
          totalGrants={props.totalGrants}
        />
      </ChartCard>

      {/* Source Coverage */}
      <ChartCard title="Grant Sources">
        <div className="space-y-1.5">
          {props.sources.slice(0, 8).map((s, i) => {
            const maxCount = props.sources[0]?.count || 1;
            return (
              <div key={s.source} className="flex items-center gap-2">
                <div className="w-24 text-[11px] font-bold text-bauhaus-muted truncate text-right">{s.source}</div>
                <div className="flex-1 h-5 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                  <div
                    className="h-full absolute top-0 left-0 flex items-center pl-1.5"
                    style={{ width: `${(s.count / maxCount * 100)}%`, background: BAUHAUS_COLORS[i % BAUHAUS_COLORS.length] }}
                  >
                    <span className="text-[10px] font-black text-white">{s.count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* Sector Giving */}
      <ChartCard title="Foundation Giving by Sector">
        {sectorData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(300, sectorData.length * 32)}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fontWeight: 700 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" barSize={18}>
                {sectorData.map((_, i) => (
                  <Cell key={i} fill={BAUHAUS_COLORS[i % BAUHAUS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-bauhaus-muted text-sm font-medium py-8 text-center">No sector data available</div>
        )}
      </ChartCard>

      {/* Geographic Distribution */}
      <ChartCard title="Foundation Giving by Geography">
        {geoData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(300, geoData.length * 32)}>
            <BarChart data={geoData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fontWeight: 700 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#7c3aed" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-bauhaus-muted text-sm font-medium py-8 text-center">No geographic data available</div>
        )}
      </ChartCard>

      {/* Top Foundations */}
      <ChartCard title="Top 15 Foundations by Annual Giving">
        {foundationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={foundationData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fontWeight: 600 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" barSize={14}>
                {foundationData.map((entry, i) => (
                  <Cell key={i} fill={TYPE_COLORS[entry.type || ''] || '#121212'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-bauhaus-muted text-sm font-medium py-8 text-center">No foundation data available</div>
        )}
      </ChartCard>

      {/* Closing Soon */}
      <ChartCard title="Closing in Next 30 Days">
        {props.closingSoon.length > 0 ? (
          <div className="space-y-2">
            {props.closingSoon.map(g => {
              const days = daysUntil(g.closes_at);
              return (
                <a key={g.id} href={`/grants/${g.id}`} className="block group">
                  <div className="flex items-center justify-between p-2.5 border-2 border-bauhaus-black/20 hover:border-bauhaus-black hover:bg-bauhaus-canvas transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-bauhaus-black truncate group-hover:text-bauhaus-blue">{g.name}</div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">{g.provider}</div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      {g.amount_max && (
                        <div className="text-xs font-black text-money tabular-nums">{formatMoney(g.amount_max)}</div>
                      )}
                      <div className={`text-[11px] font-black tabular-nums ${days <= 7 ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                        {days} day{days !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-bauhaus-muted text-sm font-medium py-8 text-center">No grants closing in the next 30 days</div>
        )}
      </ChartCard>
    </div>
  );
}
