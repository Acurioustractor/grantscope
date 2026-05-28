import { notFound } from 'next/navigation';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getFoundationWatchlistData, type FunderTemperature, type FoundationWatchlistItem } from '@/lib/services/foundation-watchlist-service';
import { getActSurfaceCounts } from '@/lib/services/act-surface-counts';
import { ActSurfaceNav } from '../../_components/act-surface-nav';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Foundation Watchlist',
  description: 'Relationship CRM for foundations and lifetime funders.',
};

const TEMP_CLASSES: Record<FunderTemperature, string> = {
  WARM: 'bg-green-600 text-white',
  TEPID: 'bg-bauhaus-yellow text-bauhaus-black',
  LIGHT: 'bg-gray-300 text-bauhaus-black',
  COLD: 'bg-gray-200 text-bauhaus-muted',
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDays(d: number | null): string {
  if (d == null) return '—';
  if (d === 0) return 'today';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export default async function FoundationWatchlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = (await getOrgProfileBySlug(slug)) ?? (isActSlug(slug) ? ACT_FAST_PROFILE : null);
  if (!profile) notFound();

  const [data, counts] = await Promise.all([
    getFoundationWatchlistData(slug),
    getActSurfaceCounts(slug),
  ]);
  if (!data) notFound();

  const { items, totals } = data;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">
            Foundations
          </p>
          <h1 className="text-2xl font-black uppercase tracking-wider mt-1">
            Watchlist
          </h1>
          <p className="mt-1 text-[11px] font-mono text-gray-300">
            {totals.funders} funders · {fmtMoney(totals.paid_lifetime)} lifetime paid · {totals.warm} warm / {totals.tepid} tepid / {totals.light} light / {totals.cold} cold
          </p>
          <div className="mt-6">
            <ActSurfaceNav slug={slug} current="foundations" counts={counts} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {items.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-12 text-center font-mono text-sm">
            No foundations on watchlist yet.
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr className="text-[10px] font-black uppercase tracking-widest">
                  <th className="text-left p-3">Funder</th>
                  <th className="text-left p-3">Temp</th>
                  <th className="text-right p-3">Lifetime $</th>
                  <th className="text-right p-3">Annual giving</th>
                  <th className="text-left p-3">Projects</th>
                  <th className="text-left p-3">Themes</th>
                  <th className="text-right p-3">Open progs</th>
                  <th className="text-right p-3">Last touch</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <FoundationRow key={item.key} item={item} striped={i % 2 === 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 text-[10px] font-mono text-bauhaus-muted leading-relaxed">
          <p>
            Sources: <code>org_pipeline</code> rows where opportunity_type=&apos;foundation&apos; ·{' '}
            <code>v_act_income_by_funder</code> (Xero PAID invoices) ·{' '}
            <code>funder_context_snapshot</code> (CivicGraph derived). Temperature is derived from
            lifetime paid + pipeline-presence, falling back to relationship_score when present.
          </p>
        </div>
      </div>
    </main>
  );
}

function FoundationRow({ item, striped }: { item: FoundationWatchlistItem; striped: boolean }) {
  return (
    <tr className={striped ? 'bg-bauhaus-canvas' : 'bg-white'}>
      <td className="p-3 border-t border-bauhaus-black/20">
        <div className="font-black">{item.funder_name}</div>
        {item.website && (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-bauhaus-muted underline decoration-2 underline-offset-2 hover:text-bauhaus-red"
          >
            {item.website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)}
          </a>
        )}
        {item.recent_grantees.length > 0 && (
          <div className="text-[10px] font-mono text-bauhaus-muted mt-1 line-clamp-1" title={item.recent_grantees.join(', ')}>
            Recent: {item.recent_grantees.join(', ')}
          </div>
        )}
      </td>
      <td className="p-3 border-t border-bauhaus-black/20">
        <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${TEMP_CLASSES[item.temperature]}`}>
          {item.temperature}
        </span>
      </td>
      <td className="p-3 border-t border-bauhaus-black/20 text-right font-mono tabular-nums">
        {item.paid_total > 0 ? (
          <span className="font-black text-green-700">{fmtMoney(item.paid_total)}</span>
        ) : (
          <span className="text-bauhaus-muted">—</span>
        )}
        {item.auth_total > 0 && (
          <div className="text-[10px] text-bauhaus-muted">+{fmtMoney(item.auth_total)} auth</div>
        )}
      </td>
      <td className="p-3 border-t border-bauhaus-black/20 text-right font-mono tabular-nums">
        {item.annual_giving ? fmtMoney(item.annual_giving) : <span className="text-bauhaus-muted">—</span>}
      </td>
      <td className="p-3 border-t border-bauhaus-black/20">
        <div className="flex gap-1 flex-wrap">
          {item.project_codes.map((pc) => (
            <span
              key={pc}
              className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black"
            >
              {pc}
            </span>
          ))}
        </div>
      </td>
      <td className="p-3 border-t border-bauhaus-black/20 text-[10px] font-mono text-bauhaus-muted line-clamp-2 max-w-[200px]">
        {item.thematic_focus.slice(0, 3).join(', ') || '—'}
      </td>
      <td className="p-3 border-t border-bauhaus-black/20 text-right font-mono tabular-nums">
        {item.open_programs_count > 0 ? (
          <span className="font-black text-bauhaus-blue">{item.open_programs_count}</span>
        ) : (
          <span className="text-bauhaus-muted">—</span>
        )}
      </td>
      <td className="p-3 border-t border-bauhaus-black/20 text-right font-mono text-[11px]">
        {fmtDays(item.days_since_last_touch)}
      </td>
    </tr>
  );
}
