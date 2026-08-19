import { money } from '@/lib/services/report-service';

export interface LaneRow {
  measure_kind: string;
  rows: number;
  dollars: number | null;
  sources: number;
  from_fy: string | null;
  to_fy: string | null;
}

/**
 * What a jurisdiction's recipient table renders when the jurisdiction publishes no grant-level data.
 *
 * Not the same thing as `ReportUnavailable`, which means "the query failed". This means "the query
 * succeeded and the answer is that nobody publishes this". The distinction is the whole point: a
 * hidden section reads as an oversight, an empty table reads as zero dollars, and neither is what
 * happened. Seven of the eight states publish only system expenditure for youth justice.
 *
 * The lane figures are queried live rather than written into the copy, because a hand-typed figure
 * in a paragraph about data honesty is the exact thing that rots first.
 */
/** Singular and plural, because a jurisdiction with exactly one row is common here. */
const LANE_LABELS: Record<string, [singular: string, plural: string]> = {
  grant: ['grant row naming a recipient organisation', 'grant rows naming a recipient organisation'],
  expenditure_aggregate: ['whole-of-system expenditure row', 'whole-of-system expenditure rows'],
  budget_announcement: ['budget announcement', 'budget announcements'],
  contract_value: ['contract', 'contracts'],
};

function describeLane(l: LaneRow): string {
  const pair = LANE_LABELS[l.measure_kind];
  const fallback = l.measure_kind.replace(/_/g, ' ');
  const label = pair ? (l.rows === 1 ? pair[0] : pair[1]) : fallback;
  const span = l.from_fy && l.to_fy && l.from_fy !== l.to_fy ? `, ${l.from_fy} to ${l.to_fy}` : '';
  const amount = l.dollars ? ` worth ${money(l.dollars)}` : '';
  return `${l.rows.toLocaleString()} ${label}${amount}${span}`;
}

export function NoGrantLevelData({
  jurisdiction,
  topicLabel,
  lanes,
}: {
  jurisdiction: string;
  topicLabel: string;
  lanes: LaneRow[];
}) {
  const grantLane = lanes.find((l) => l.measure_kind === 'grant');
  const otherLanes = lanes.filter((l) => l.measure_kind !== 'grant' && l.rows > 0);

  return (
    <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">
        Not published
      </p>
      <h3 className="mt-3 text-xl font-black text-bauhaus-black">
        {jurisdiction} does not publish {topicLabel} funding at the level of individual recipients
      </h3>
      <p className="mt-4 text-sm leading-relaxed text-bauhaus-muted">
        {grantLane && grantLane.rows > 0 ? (
          <>
            We hold {grantLane.rows.toLocaleString()} grant-level {topicLabel}{' '}
            {grantLane.rows === 1 ? 'row' : 'rows'} for {jurisdiction}
            {grantLane.dollars
              ? ` carrying ${money(grantLane.dollars)}`
              : grantLane.rows === 1
                ? ', and it carries no amount'
                : ', none of which carry an amount'}
            . That is too thin to rank recipients from, so this table is empty rather than
            misleading.
          </>
        ) : (
          <>
            There are no grant-level {topicLabel} records for {jurisdiction} in this database. This
            table is empty because the data does not exist, not because the money is zero.
          </>
        )}
      </p>
      {otherLanes.length > 0 && (
        <>
          <p className="mt-4 text-sm leading-relaxed text-bauhaus-muted">
            What {jurisdiction} does publish for {topicLabel}:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-bauhaus-black">
            {otherLanes.map((l) => (
              <li key={l.measure_kind} className="flex gap-2">
                <span aria-hidden className="font-black text-bauhaus-blue">
                  ·
                </span>
                <span>{describeLane(l)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-bauhaus-muted">
            Those are system totals — what the state spent running youth justice, not money
            traceable to any organisation. They are counted separately on this page and are never
            added to grant figures, because they measure a different thing.
          </p>
        </>
      )}
    </div>
  );
}
