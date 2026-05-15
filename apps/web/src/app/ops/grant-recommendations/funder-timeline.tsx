'use client';

import { useEffect, useState } from 'react';

interface TimelineEvent {
  date: string;
  type: 'xero_invoice' | 'xero_payment' | 'contact' | 'decision' | 'past_grant';
  label: string;
  detail?: string;
  amount?: number | null;
  status?: string | null;
}

interface TimelineStats {
  total_events: number;
  earliest: string | null;
  latest: string | null;
  xero_paid_count: number;
  xero_paid_total: number;
  contact_count: number;
  decision_count: number;
  past_grant_count: number;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  if (num >= 1000) return `$${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(num).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
}

const TYPE_LABEL: Record<TimelineEvent['type'], { dot: string; pill: string }> = {
  xero_payment: { dot: 'bg-green-600', pill: 'PAID' },
  xero_invoice: { dot: 'bg-bauhaus-blue', pill: 'INV' },
  contact: { dot: 'bg-bauhaus-yellow', pill: 'CONTACT' },
  decision: { dot: 'bg-bauhaus-red', pill: 'DECIDE' },
  past_grant: { dot: 'bg-purple-600', pill: 'GRANT' },
};

export function FunderTimeline({ funderName }: { funderName: string }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/ops/funders/timeline?funder=${encodeURIComponent(funderName)}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) {
          setError(body.error);
          setEvents([]);
        } else {
          setEvents(body.events ?? []);
          setStats(body.stats ?? null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [funderName]);

  if (loading) {
    return (
      <div className="text-[10px] font-mono text-bauhaus-muted">Loading timeline…</div>
    );
  }

  if (error) {
    return <div className="text-[10px] font-mono text-bauhaus-red">Timeline error: {error}</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-[10px] font-mono text-bauhaus-muted italic">
        No timeline events recorded for this funder.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      {stats && (
        <div className="flex flex-wrap gap-2 text-[10px] font-mono">
          {stats.xero_paid_count > 0 && (
            <span className="bg-green-600 text-white px-2 py-0.5 font-black uppercase tracking-wider">
              {stats.xero_paid_count} payments · {fmtMoney(stats.xero_paid_total)}
            </span>
          )}
          {stats.contact_count > 0 && (
            <span className="bg-bauhaus-yellow text-bauhaus-black px-2 py-0.5 font-black uppercase tracking-wider">
              {stats.contact_count} contact events
            </span>
          )}
          {stats.decision_count > 0 && (
            <span className="bg-bauhaus-red text-white px-2 py-0.5 font-black uppercase tracking-wider">
              {stats.decision_count} ACT decisions
            </span>
          )}
          {stats.past_grant_count > 0 && (
            <span className="bg-purple-600 text-white px-2 py-0.5 font-black uppercase tracking-wider">
              {stats.past_grant_count} past grants to ACT
            </span>
          )}
          {stats.earliest && stats.latest && (
            <span className="text-bauhaus-muted">
              {fmtDate(stats.earliest)} → {fmtDate(stats.latest)}
            </span>
          )}
        </div>
      )}

      {/* Event list (max 50, newest first) */}
      <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {events.map((e, i) => {
          const label = TYPE_LABEL[e.type];
          return (
            <li key={`${e.date}-${i}`} className="flex items-start gap-2 text-[11px] leading-snug">
              <span className={`flex-none w-2 h-2 rounded-full mt-1.5 ${label.dot}`} />
              <span className="font-mono text-bauhaus-muted w-20 flex-none">{fmtDate(e.date)}</span>
              <span className={`flex-none text-[8px] font-black uppercase tracking-wider px-1 py-0.5 text-white ${label.dot}`}>
                {label.pill}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-bauhaus-black truncate">{e.label}</div>
                {(e.detail || e.amount != null) && (
                  <div className="text-[10px] font-mono text-bauhaus-muted truncate">
                    {e.amount != null && <span className="mr-2">{fmtMoney(e.amount)}</span>}
                    {e.detail}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
