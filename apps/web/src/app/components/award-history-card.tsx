import Link from 'next/link';
import type { Tier } from '@/lib/subscription';

// Payload shape from the get_grant_award_history(uuid) SQL function (Phase 6 migration).
export interface AwardWinner {
  recipient_name: string;
  recipient_abn: string | null;
  gs_entity_id: string | null;
  entity_type: string | null;
  is_community_controlled: boolean | null;
  n_awards: number;
  total_awarded: number;
  latest_year: number | null;
}
export interface AwardHistoryTheme {
  theme: string;
  n_awards: number;
  distinct_recipients: number;
  total_awarded: number;
  median_award: number | null;
  p25_award: number | null;
  p75_award: number | null;
  earliest_year: number | null;
  latest_year: number | null;
  n_peer_recipients: number;
  peer_total_awarded: number | null;
  peer_median_award: number | null;
  n_community_controlled: number;
  n_charity: number;
  n_social_enterprise: number;
  winners: AwardWinner[];
}

const THEME_LABELS: Record<string, string> = {
  'youth-justice': 'Youth Justice',
  'child-protection': 'Child Protection',
  'family-services': 'Family Services',
  'legal-services': 'Legal Services',
  corrections: 'Corrections & Community Safety',
  community: 'Community Services',
  education: 'Education',
  health: 'Health',
  disability: 'Disability',
  housing: 'Housing',
  indigenous: 'Indigenous',
};

const TYPE_LABELS: Record<string, string> = {
  charity: 'Charity',
  indigenous_corp: 'Indigenous corp',
  social_enterprise: 'Social enterprise',
  foundation: 'Foundation',
};

function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme.replace(/-/g, ' ');
}

function money(n: number | null): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ── KPI cell ────────────────────────────────────────────────────────────────
function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="p-4 lg:p-5">
      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">{label}</div>
      <div className={`text-2xl lg:text-3xl font-black tabular-nums leading-none ${accent ?? 'text-bauhaus-black'}`}>
        {value}
      </div>
    </div>
  );
}

// ── Winners table (paid) ─────────────────────────────────────────────────────
function WinnersTable({ winners }: { winners: AwardWinner[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-bauhaus-black text-white">
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest">Recipient</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest hidden sm:table-cell">Type</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-right tabular-nums">Awards</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-right hidden sm:table-cell">Latest</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-right tabular-nums">Total Won</th>
          </tr>
        </thead>
        <tbody>
          {winners.map((w, i) => {
            const type = w.entity_type ? TYPE_LABELS[w.entity_type] ?? w.entity_type : '—';
            return (
              <tr key={`${w.recipient_name}-${i}`} className="border-b border-bauhaus-black/15 last:border-b-0 hover:bg-link-light transition-colors">
                <td className="px-4 py-2.5">
                  <span className="text-sm font-bold text-bauhaus-black">{w.recipient_name}</span>
                  {w.is_community_controlled && (
                    <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-money">◆ Community-controlled</span>
                  )}
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  <span className="text-[11px] font-black uppercase tracking-wider text-bauhaus-muted">{type}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-bauhaus-black">{w.n_awards.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-bauhaus-muted hidden sm:table-cell">{w.latest_year ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-sm font-black tabular-nums text-bauhaus-blue">{money(w.total_awarded)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Winners table (free tier) — locked placeholder, NO real data ──────────────
function LockedWinners({ rows }: { rows: number }) {
  return (
    <div className="relative">
      <table className="w-full text-left border-collapse" aria-hidden>
        <thead>
          <tr className="bg-bauhaus-black text-white">
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest">Recipient</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest hidden sm:table-cell">Type</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-right">Awards</th>
            <th className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-right">Total Won</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-bauhaus-black/15 last:border-b-0">
              <td className="px-4 py-3"><div className="h-3.5 bg-bauhaus-black/12" style={{ width: `${55 - i * 6}%` }} /></td>
              <td className="px-4 py-3 hidden sm:table-cell"><div className="h-3 w-16 bg-bauhaus-black/10" /></td>
              <td className="px-4 py-3"><div className="h-3.5 w-8 bg-bauhaus-black/10 ml-auto" /></td>
              <td className="px-4 py-3"><div className="h-3.5 w-14 bg-bauhaus-blue/15 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/40 via-white/75 to-white">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black text-center px-4">
          See every organisation that&apos;s won this — and your realistic odds
        </div>
        <Link
          href="/pricing"
          className="px-5 py-2.5 bg-bauhaus-black text-white font-black uppercase tracking-widest text-xs hover:bg-bauhaus-red transition-colors border-4 border-bauhaus-black bauhaus-shadow-sm"
        >
          Unlock past winners →
        </Link>
      </div>
    </div>
  );
}

// ── Primary (featured) theme ──────────────────────────────────────────────────
function PrimaryTheme({ t, isPaid }: { t: AwardHistoryTheme; isPaid: boolean }) {
  const others = Math.max(0, t.distinct_recipients - t.n_peer_recipients);
  const since = t.earliest_year ? `since ${t.earliest_year}` : '';

  return (
    <div className="border-4 border-bauhaus-black bg-white bauhaus-shadow-sm">
      {/* Header band — theme + one-line hook */}
      <div className="bg-bauhaus-black text-white px-4 lg:px-5 py-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h3 className="text-lg lg:text-xl font-black uppercase tracking-wide">{themeLabel(t.theme)}</h3>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/70 tabular-nums">
          {t.distinct_recipients.toLocaleString()} orgs · {money(t.total_awarded)} awarded {since}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b-4 border-bauhaus-black divide-x-4 divide-y-4 lg:divide-y-0 divide-bauhaus-black">
        <Kpi label="Typical peer award" value={money(t.peer_median_award)} accent="text-money" />
        <Kpi label="Community winners" value={t.n_peer_recipients.toLocaleString()} accent="text-bauhaus-blue" />
        <Kpi label="Total recipients" value={t.distinct_recipients.toLocaleString()} />
        <Kpi label="Total awarded" value={money(t.total_awarded)} />
      </div>

      {/* Winners */}
      <div className="px-4 lg:px-5 pt-4 pb-1">
        <div className="text-[11px] font-black text-bauhaus-black uppercase tracking-widest mb-2">
          Community-sector orgs who&apos;ve won this
        </div>
      </div>
      <div className="px-4 lg:px-5">
        {isPaid ? <WinnersTable winners={t.winners} /> : <LockedWinners rows={5} />}
      </div>
      <div className="px-4 lg:px-5 py-3">
        {isPaid && others > 0 && (
          <p className="text-xs text-bauhaus-muted font-medium">
            + {others.toLocaleString()} other recipients (companies, agencies &amp; unclassified) not shown.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Secondary themes — compact "also active in" strip ─────────────────────────
function SecondaryStrip({ themes }: { themes: AwardHistoryTheme[] }) {
  if (themes.length === 0) return null;
  return (
    <div className="mt-5">
      <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">
        This grant also spans
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {themes.map((t) => (
          <div key={t.theme} className="border-4 border-bauhaus-black bg-white p-3">
            <div className="text-sm font-black uppercase tracking-wide text-bauhaus-black mb-1">{themeLabel(t.theme)}</div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold text-bauhaus-muted uppercase tracking-wider tabular-nums">
                {t.n_peer_recipients.toLocaleString()} peers
              </span>
              <span className="text-sm font-black text-bauhaus-blue tabular-nums">{money(t.total_awarded)}</span>
            </div>
            <div className="text-[10px] font-bold text-bauhaus-muted uppercase tracking-wider tabular-nums mt-0.5">
              Typical peer award {money(t.peer_median_award)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Phase 6 — "Who's won this before" card. The award-history differentiator.
 * Renders nothing when the grant maps to no themes with historical awards (empty-safe:
 * also covers the window before the migration is applied, when the RPC returns []).
 * Free tier gets the aggregate hook + a locked table; paid tier gets named peer winners.
 * For the free tier the page fetches with p_winner_limit=0 so winner names never reach
 * the client (not even in the Next.js RSC fetch-cache payload) — see grants/[id]/page.tsx.
 */
export function AwardHistoryCard({ themes, tier }: { themes: AwardHistoryTheme[]; tier: Tier }) {
  if (!themes || themes.length === 0) return null;
  const isPaid = tier !== 'community';
  const [primary, ...rest] = themes; // ordered by total_awarded desc from the RPC
  const secondary = rest.slice(0, 3);

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between mb-4 pb-2 border-b-4 border-bauhaus-black">
        <h2 className="text-lg lg:text-xl font-black text-bauhaus-black uppercase tracking-widest">Who&apos;s Won This Before</h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
          {isPaid ? 'Award evidence' : 'Buyer evidence'}
        </span>
      </div>

      <PrimaryTheme t={primary} isPaid={isPaid} />
      <SecondaryStrip themes={secondary} />

      <p className="text-[10px] text-bauhaus-muted font-medium mt-4 leading-relaxed">
        Source: justice &amp; community-services funding records. Government administrators excluded;
        winners shown are community-sector recipients (charities, Indigenous corporations, social enterprises).
        Aggregate totals include all non-government recipients.
      </p>
    </section>
  );
}
