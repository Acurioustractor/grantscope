'use client';

interface GivingHistoryChartProps {
  history: Array<{ year: number; amount: number }>;
}

export function GivingHistoryChart({ history }: GivingHistoryChartProps) {
  const normalized = Array.from(
    history.reduce((map, entry) => {
      map.set(entry.year, (map.get(entry.year) ?? 0) + Number(entry.amount ?? 0));
      return map;
    }, new Map<number, number>())
  ).map(([year, amount]) => ({ year, amount }));
  const sorted = normalized.sort((a, b) => a.year - b.year);
  const maxAmount = Math.max(...sorted.map(h => h.amount));

  function formatMoney(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  }

  return (
    <div className="bg-white border-4 border-bauhaus-black p-4 bauhaus-shadow-sm">
      <div className="space-y-2">
        {sorted.map(entry => {
          const pct = maxAmount > 0 ? (entry.amount / maxAmount) * 100 : 0;
          return (
            <div key={entry.year} className="flex items-center gap-3">
              <span className="text-xs text-bauhaus-muted w-10 text-right tabular-nums flex-shrink-0 font-black">{entry.year}</span>
              <div className="flex-1 bg-bauhaus-canvas h-7 overflow-hidden border-2 border-bauhaus-black">
                <div
                  className="bg-money h-full flex items-center justify-end px-2 transition-all duration-500"
                  style={{ width: `${Math.max(pct, 8)}%` }}
                >
                  <span className="text-[10px] text-white font-black tabular-nums whitespace-nowrap">
                    {formatMoney(entry.amount)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {sorted.length >= 2 && (() => {
        const first = sorted[0].amount;
        const last = sorted[sorted.length - 1].amount;
        const change = first > 0 ? ((last - first) / first) * 100 : 0;
        return (
          <div className="mt-3 pt-3 border-t-2 border-bauhaus-black/20 text-xs text-bauhaus-muted font-bold uppercase tracking-wider">
            {change > 0
              ? `+${change.toFixed(0)}% increase from ${sorted[0].year} to ${sorted[sorted.length - 1].year}`
              : change < 0
                ? `${change.toFixed(0)}% decrease from ${sorted[0].year} to ${sorted[sorted.length - 1].year}`
                : `No change from ${sorted[0].year} to ${sorted[sorted.length - 1].year}`}
          </div>
        );
      })()}
    </div>
  );
}
