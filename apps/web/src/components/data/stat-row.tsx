import type { ReactNode } from 'react';

/**
 * A row of headline figures in one 4px black frame, as on every CivicGraph profile.
 *
 * The frame is the container and the 2px rules between cells are its background showing through
 * the grid gap, so the dividers stay correct at every breakpoint without per-cell border logic.
 * Taken from the /entities header and power profile (2026-09-23); DESIGN.md "Cards".
 */
const COLS: Record<2 | 3 | 4 | 5, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
};

export function StatRow({ cols, children }: { cols: 2 | 3 | 4 | 5; children: ReactNode }) {
  return (
    <div className={`grid ${COLS[cols]} gap-[2px] border-4 border-bauhaus-black bg-bauhaus-black`}>
      {children}
    </div>
  );
}

const TONE = {
  ink: 'text-bauhaus-black',
  red: 'text-bauhaus-red',
  money: 'text-money',
  blue: 'text-bauhaus-blue',
} as const;

/**
 * One headline figure. `sub` says what the figure is made of ("from 5,066 contracts"); the
 * reference sites all qualify their numbers and a bare total invites the wrong reading.
 */
export function Stat({
  label,
  value,
  sub,
  tone = 'ink',
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof TONE;
  children?: ReactNode;
}) {
  return (
    <div className="bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</p>
      <p className={`mt-1 text-2xl sm:text-3xl font-black tabular-nums ${TONE[tone]}`}>{value}</p>
      {children}
      {sub && <p className="mt-1 text-xs text-bauhaus-muted">{sub}</p>}
    </div>
  );
}
