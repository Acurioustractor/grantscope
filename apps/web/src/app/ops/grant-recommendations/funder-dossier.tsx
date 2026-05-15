'use client';

export interface FunderContext {
  funder_name: string;
  funder_aliases: string[] | null;
  foundation_id: string | null;
  abn: string | null;
  annual_giving: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  website: string | null;
  contacts_count: number;
  contacts: Array<{ name: string | null; email: string | null; last_contact_date: string | null }> | null;
  most_recent_contact_at: string | null;
  grantee_count: number;
  recent_grantees: string[] | null;
  xero_invoiced_total: number | string | null;
  xero_paid_total: number | string | null;
  xero_authorised_total: number | string | null;
  xero_last_invoice_date: string | null;
  xero_last_payment_date: string | null;
  notion_org_id: string | null;
  notion_org_name: string | null;
  decisions: Record<string, number> | null;
  total_decisions: number;
  email_count: number;
  email_last_date: string | null;
  email_summary: string | null;
  relationship_score: number;
  refreshed_at: string;
}

function fmtMoney(v: number | string | null | undefined): string {
  if (v == null) return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!n) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function scoreBadge(score: number): { color: string; label: string } {
  if (score >= 50) return { color: 'bg-green-600 text-white', label: 'WARM' };
  if (score >= 20) return { color: 'bg-bauhaus-yellow text-bauhaus-black', label: 'TEPID' };
  if (score > 0) return { color: 'bg-gray-300 text-bauhaus-black', label: 'LIGHT' };
  return { color: 'bg-gray-200 text-bauhaus-muted', label: 'COLD' };
}

/**
 * Compact funder dossier panel. Shows what we know about the funder from
 * every system: foundations profile, ACT contacts, Xero financial flow,
 * past grantees, past decisions, Notion presence.
 */
export function FunderDossier({ context }: { context: FunderContext | null }) {
  if (!context) {
    return (
      <div className="text-[10px] font-mono text-bauhaus-muted italic">
        No context — refresh-funder-context.mjs hasn’t indexed this funder.
      </div>
    );
  }

  const badge = scoreBadge(context.relationship_score);
  const topContact = context.contacts?.[0];
  const xeroTotal = (Number(context.xero_paid_total) || 0) + (Number(context.xero_authorised_total) || 0);

  return (
    <div className="bg-bauhaus-canvas border-l-4 border-bauhaus-black px-3 py-2 text-xs space-y-2">
      {/* Top strip: score + ACT money + contacts + grantees */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${badge.color}`}
        >
          {badge.label} · {context.relationship_score}
        </span>
        {xeroTotal > 0 && (
          <span
            className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-green-600 text-white"
            title={`Paid ${fmtMoney(context.xero_paid_total)} · Authorised ${fmtMoney(context.xero_authorised_total)}`}
          >
            ACT $: {fmtMoney(xeroTotal)}
          </span>
        )}
        {context.annual_giving != null && Number(context.annual_giving) > 0 && (
          <span className="text-[10px] font-mono text-bauhaus-muted">
            Annual giving {fmtMoney(context.annual_giving)}
          </span>
        )}
        {context.grantee_count > 0 && (
          <span className="text-[10px] font-mono text-bauhaus-muted">
            {context.grantee_count} grantees
          </span>
        )}
        {context.total_decisions > 0 && (
          <span className="text-[10px] font-mono text-bauhaus-muted">
            ACT decisions: {Object.entries(context.decisions ?? {}).map(([k, v]) => `${k}:${v}`).join(' · ')}
          </span>
        )}
      </div>

      {/* Top contact line — the single most-useful field for triage */}
      {topContact && (
        <div className="flex items-baseline gap-2 text-[11px]">
          <span className="font-black uppercase tracking-widest text-bauhaus-muted text-[9px]">
            CONTACT:
          </span>
          <span className="font-black text-bauhaus-black">{topContact.name}</span>
          {topContact.email && (
            <a
              href={`mailto:${topContact.email}`}
              className="font-mono text-bauhaus-blue hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {topContact.email}
            </a>
          )}
          <span className="font-mono text-bauhaus-muted">
            last {timeAgo(topContact.last_contact_date)}
          </span>
          {context.contacts_count > 1 && (
            <span className="text-[10px] font-mono text-bauhaus-muted">
              (+{context.contacts_count - 1} more)
            </span>
          )}
        </div>
      )}

      {/* Themes + geography */}
      {(context.thematic_focus?.length || context.geographic_focus?.length) && (
        <div className="flex gap-3 text-[10px] font-mono text-bauhaus-muted">
          {context.thematic_focus?.length ? (
            <span>Themes: {context.thematic_focus.slice(0, 5).join(', ')}</span>
          ) : null}
          {context.geographic_focus?.length ? (
            <span>Geo: {context.geographic_focus.join(', ')}</span>
          ) : null}
        </div>
      )}

      {/* Recent grantees */}
      {context.recent_grantees && context.recent_grantees.length > 0 && (
        <div className="text-[10px] font-mono text-bauhaus-muted">
          Recent grantees: {context.recent_grantees.slice(0, 3).join(' · ')}
        </div>
      )}
    </div>
  );
}
