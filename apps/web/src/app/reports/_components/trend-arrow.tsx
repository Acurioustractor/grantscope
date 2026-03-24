/**
 * Trend arrow indicator — compares current vs prior period value.
 * Shows ↑/↓/→ with color coding: green=improving, red=worsening.
 * Respects higherIsWorse flag (e.g. detention rate — higher is bad).
 */
export function TrendArrow({
  current,
  prior,
  higherIsWorse = false,
}: {
  current: number | null;
  prior: number | null;
  higherIsWorse?: boolean;
}) {
  if (current == null || prior == null || current === prior) return null;

  const increasing = current > prior;
  const improving = higherIsWorse ? !increasing : increasing;
  const pctChange = prior !== 0 ? Math.abs(((current - prior) / prior) * 100) : 0;

  // Don't show arrow for trivial changes (<0.5%)
  if (pctChange < 0.5) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-black ml-1.5 ${
        improving ? 'text-emerald-600' : 'text-red-600'
      }`}
      title={`${increasing ? '+' : ''}${((current - prior) / Math.abs(prior) * 100).toFixed(1)}% vs prior period`}
    >
      {increasing ? '↑' : '↓'}
      {pctChange >= 5 && <span>{pctChange.toFixed(0)}%</span>}
    </span>
  );
}
