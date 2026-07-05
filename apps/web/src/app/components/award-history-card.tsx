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

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`text-lg font-black tabular-nums ${accent ?? 'text-bauhaus-black'}`}>{value}</div>
    </div>
  );
}

function WinnerRow({ w }: { w: AwardWinner }) {
  const type = w.entity_type ? TYPE_LABELS[w.entity_type] ?? w.entity_type : null;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b-2 border-bauhaus-black/10 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-bold text-bauhaus-black truncate">{w.recipient_name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {type && (
            <span className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">{type}</span>
          )}
          {w.is_community_controlled && (
            <span className="text-[10px] font-black uppercase tracking-wider text-money">Community-controlled</span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-black text-bauhaus-blue tabular-nums">{money(w.total_awarded)}</div>
        <div className="text-[10px] font-bold text-bauhaus-muted tabular-nums">
          {w.n_awards} award{w.n_awards !== 1 ? 's' : ''}{w.latest_year ? ` · to ${w.latest_year}` : ''}
        </div>
      </div>
    </div>
  );
}

/**
 * Locked placeholder — free tier. Deliberately carries NO real recipient data
 * (names/amounts are buyer-tier evidence and must never reach the free-tier DOM,
 * even blurred). Just a shaped skeleton behind the unlock CTA.
 */
function LockedRow() {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b-2 border-bauhaus-black/10 last:border-b-0" aria-hidden>
      <div className="min-w-0 w-full">
        <div className="h-3.5 w-2/3 bg-bauhaus-black/15" />
        <div className="h-2 w-20 bg-bauhaus-black/10 mt-1.5" />
      </div>
      <div className="text-right flex-shrink-0">
        <div className="h-3.5 w-12 bg-bauhaus-blue/20 ml-auto" />
        <div className="h-2 w-10 bg-bauhaus-black/10 mt-1.5 ml-auto" />
      </div>
    </div>
  );
}

function ThemeBlock({ t, isPaid }: { t: AwardHistoryTheme; isPaid: boolean }) {
  const others = Math.max(0, t.distinct_recipients - t.n_peer_recipients);
  const since = t.earliest_year ? ` since ${t.earliest_year}` : '';
  // Paid tier sees the named peer winners. Free tier sees only shaped placeholders +
  // the unlock CTA — no real recipient data reaches the free-tier DOM.
  const placeholderCount = Math.min(t.winners.length || 3, 3);

  return (
    <div className="mb-6 last:mb-0">
      {/* The hook line — always visible, this is the free-tier value that proves the depth exists */}
      <p className="text-sm text-bauhaus-black font-medium leading-relaxed mb-3">
        <span className="font-black">{t.distinct_recipients.toLocaleString()} organisations</span> have shared{' '}
        <span className="font-black text-bauhaus-blue">{money(t.total_awarded)}</span> in{' '}
        <span className="font-black">{themeLabel(t.theme)}</span> funding{since}.
      </p>

      <div className="grid grid-cols-3 gap-0 mb-4 border-4 border-bauhaus-black">
        <div className="p-3 border-r-4 border-bauhaus-black">
          <Stat label="Typical peer award" value={money(t.peer_median_award)} accent="text-money" />
        </div>
        <div className="p-3 border-r-4 border-bauhaus-black">
          <Stat label="Community winners" value={t.n_peer_recipients.toLocaleString()} />
        </div>
        <div className="p-3">
          <Stat label="Awards recorded" value={t.n_awards.toLocaleString()} />
        </div>
      </div>

      <div className="text-[11px] font-black text-bauhaus-black uppercase tracking-widest mb-2">
        Community-sector orgs who&apos;ve won this
      </div>
      <div className="border-4 border-bauhaus-black bg-white relative">
        {isPaid
          ? t.winners.map((w, i) => <WinnerRow key={`${w.recipient_name}-${i}`} w={w} />)
          : Array.from({ length: placeholderCount }).map((_, i) => <LockedRow key={i} />)}

        {/* Free-tier lock overlay */}
        {!isPaid && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-white/60 to-white">
            <Link
              href="/pricing"
              className="px-4 py-2.5 bg-bauhaus-black text-white font-black uppercase tracking-widest text-xs hover:bg-bauhaus-red transition-colors border-4 border-bauhaus-black"
            >
              Unlock who&apos;s won this →
            </Link>
          </div>
        )}
      </div>

      {isPaid && others > 0 && (
        <p className="text-xs text-bauhaus-muted font-medium mt-2">
          + {others.toLocaleString()} other recipients (companies, agencies &amp; unclassified) not shown.
        </p>
      )}
    </div>
  );
}

/**
 * Phase 6 — "Who's won this before" card. The award-history differentiator.
 * Renders nothing when the grant maps to no themes with historical awards (empty-safe:
 * also covers the window before the migration is applied, when the RPC returns []).
 * Free tier gets the aggregate hook + a blurred teaser; paid tier gets named peer winners.
 */
export function AwardHistoryCard({ themes, tier }: { themes: AwardHistoryTheme[]; tier: Tier }) {
  if (!themes || themes.length === 0) return null;
  const isPaid = tier !== 'community';
  // Lead with the two richest themes to keep the card focused.
  const lead = themes.slice(0, 2);

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b-4 border-bauhaus-black">
        <h2 className="text-sm font-black text-bauhaus-black uppercase tracking-widest">Who&apos;s Won This Before</h2>
        {!isPaid && (
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Buyer evidence</span>
        )}
      </div>

      {lead.map((t) => (
        <ThemeBlock key={t.theme} t={t} isPaid={isPaid} />
      ))}

      <p className="text-[10px] text-bauhaus-muted font-medium mt-1">
        Source: justice &amp; community-services funding records. Government administrators excluded;
        winners shown are community-sector recipients (charities, Indigenous corporations, social enterprises).
      </p>
    </section>
  );
}
