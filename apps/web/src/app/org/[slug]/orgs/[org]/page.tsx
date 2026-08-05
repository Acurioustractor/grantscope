// The Org record — everything ACT knows about one Org on one screen.
// Quiet Ledger skin. Composes the loaders behind the old Listen view; the desk
// links here, GHL stays the system of record (every GHL fact shows its age).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  getActOrgRecord,
  ASK_STAGE_LABEL, ASK_STAGE_ORDER, DOMAIN_REL_LABEL,
  type ActDomainRelType, type ActOrgRecord,
} from '@/lib/services/act-org-record';
import type { ActRelationshipTimelineEvent } from '@/lib/services/act-relationship-ledger';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string; org: string }> }) {
  const { org } = await params;
  return { title: `${org.replace(/-/g, ' ')} — Org record — CivicGraph` };
}

const money = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

const REL_CHIP: Record<ActDomainRelType, string> = {
  funds: 'bg-ql-kind-funder', buys: 'bg-ql-kind-buyer', distributes: 'bg-ql-moss',
  auspices: 'bg-ql-accent', collaborates: 'bg-ql-kind-commitment', opens: 'bg-ql-kind-grant',
};

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days < 60) return `${days}d ago`;
  if (days < 730) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/** Freshness badge for GHL-derived facts: stale when the sync is > 24h old. */
function Freshness({ at }: { at: string | null }) {
  if (!at) {
    return <span className="rounded-full border border-ql-border px-2 py-0.5 font-ql-mono text-[9px] uppercase tracking-[0.08em] text-ql-muted">sync age unknown</span>;
  }
  const hours = Math.floor((Date.now() - new Date(at).getTime()) / 3_600_000);
  const stale = hours > 24;
  return (
    <span className={`rounded-full border px-2 py-0.5 font-ql-mono text-[9px] uppercase tracking-[0.08em] ${stale ? 'border-ql-alert text-ql-alert' : 'border-ql-moss text-ql-moss'}`}>
      {stale ? `stale · synced ${hours > 48 ? `${Math.floor(hours / 24)}d` : `${hours}h`} ago` : `synced ${hours <= 1 ? 'this hour' : `${hours}h ago`}`}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-ql-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ql-accent">{children}</h2>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-lg border border-ql-border bg-ql-surface p-5">{children}</section>;
}

function TimelineRow({ event }: { event: ActRelationshipTimelineEvent }) {
  return (
    <li className="border-t border-ql-border/60 py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-ql-mono text-[9px] uppercase tracking-[0.08em] text-ql-muted">{event.kind}</span>
        <span className="text-sm font-semibold">{event.title}</span>
        {event.amount != null && <span className="font-ql-mono text-[11px] font-semibold">{money(event.amount)}</span>}
        <span className="ml-auto font-ql-mono text-[10px] text-ql-muted">{event.happenedAt ? event.happenedAt.slice(0, 10) : '—'}</span>
      </div>
      <p className="mt-0.5 text-[13px] leading-5 text-ql-text2">{event.summary}</p>
    </li>
  );
}

function Asks({ record }: { record: ActOrgRecord }) {
  if (record.asks.length === 0) {
    return <p className="mt-2 text-sm text-ql-text2">No Asks yet. Deciding to chase money here mints one in GHL.</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {ASK_STAGE_ORDER.filter((stage) => record.asks.some((ask) => ask.stage === stage)).map((stage) => (
        <div key={stage}>
          <div className="font-ql-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-ql-text2">{ASK_STAGE_LABEL[stage]}</div>
          {record.asks.filter((ask) => ask.stage === stage).map((ask) => (
            <div key={ask.id} className="mt-1 rounded-md border border-ql-border bg-ql-surface2 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-semibold">{ask.purpose ?? ask.relType.replace(/_/g, ' ')}</span>
                {ask.amountAud != null && <span className="font-ql-mono text-[11px] font-semibold">{money(ask.amountAud)}</span>}
                <span className="ml-auto font-ql-mono text-[10px] text-ql-muted">warmth {ask.warmth}</span>
              </div>
              {ask.nextAction && (
                <p className="mt-1 text-[13px] text-ql-text2">
                  Next: {ask.nextAction}
                  {ask.nextActionDue ? <span className="font-ql-mono text-[10px]"> · due {ask.nextActionDue.slice(0, 10)}</span> : null}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function ActOrgRecordPage({ params }: { params: Promise<{ slug: string; org: string }> }) {
  const { slug, org } = await params;
  if (!isActSlug(slug)) notFound();
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  if (!profile) notFound();
  const record = await getActOrgRecord(slug, profile.id, org);
  if (!record) notFound();

  const item = record.ledgerItem;
  const followUps = [
    ...(item?.followUp && item.followUp.status === 'planned' ? [{ id: item.followUp.id, text: `${item.followUp.action} — ${item.followUp.owner}, due ${item.followUp.dueAt}` }] : []),
    ...(item?.obligations ?? []).map((obligation) => ({
      id: obligation.id,
      text: `${obligation.kind === 'return' ? 'Return owed' : 'Promise'}: ${obligation.action} (${obligation.owner}${obligation.dueAt ? `, due ${obligation.dueAt}` : ''})`,
    })),
  ];

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink" data-testid="act-org-record">
      <div className="mx-auto max-w-[1760px]">
        <div className="font-ql-mono text-[10px] uppercase tracking-[0.14em] text-ql-text2">
          <Link href={`/org/${slug}/orgs`} className="hover:text-ql-ink">Orgs</Link> / Org record
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-ql-display text-4xl font-semibold">{record.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {record.relationships.length === 0 && <span className="text-sm text-ql-text2">No relationship on record yet.</span>}
              {record.relationships.map((rel) => (
                <span key={rel.type} title={rel.basis} className={`rounded px-2 py-0.5 font-ql-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-ql-inverse ${REL_CHIP[rel.type]}`}>
                  {DOMAIN_REL_LABEL[rel.type]}{rel.warmth != null ? ` · ${rel.warmth}` : ''}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {record.ghl?.url ? (
              <>
                <Freshness at={record.ghl.lastSyncedAt} />
                <a href={record.ghl.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-accent hover:bg-ql-surface2">
                  Open in GHL ↗
                </a>
              </>
            ) : (
              <span className="rounded-full border border-ql-border px-2 py-0.5 font-ql-mono text-[9px] uppercase tracking-[0.08em] text-ql-muted">not in GHL — not yet an Ask</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <SectionTitle>Asks · the five stages</SectionTitle>
              <Asks record={record} />
            </Card>

            <Card>
              <SectionTitle>Next moves & follow-ups</SectionTitle>
              {item?.nextMove && <p className="mt-2 rounded-md bg-ql-warm px-3 py-2 text-sm font-medium leading-6">{item.nextMove}</p>}
              {record.brief?.actions.length ? (
                <ul className="mt-2 space-y-1.5">
                  {record.brief.actions.map((action) => (
                    <li key={action.id} className="text-[13px] leading-5">
                      <span className="font-ql-mono text-[9px] uppercase tracking-[0.08em] text-ql-muted">{action.kind}</span>{' '}
                      <span className="font-semibold">{action.title}</span>
                      <span className="text-ql-text2"> — {action.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {followUps.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {followUps.map((followUp) => <li key={followUp.id} className="text-[13px] text-ql-text2">• {followUp.text}</li>)}
                </ul>
              )}
              {!item?.nextMove && !record.brief?.actions.length && followUps.length === 0 && (
                <p className="mt-2 text-sm text-ql-text2">No next move recorded.</p>
              )}
            </Card>

            <Card>
              <SectionTitle>Money · Xero</SectionTitle>
              {item ? (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Invoiced', value: item.invoicedTotal, tone: 'text-ql-ink' },
                      { label: 'Paid', value: item.receivedTotal, tone: 'text-ql-moss' },
                      { label: 'Outstanding', value: item.outstandingTotal, tone: item.outstandingTotal > 0 ? 'text-ql-alert' : 'text-ql-muted' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-md border border-ql-border bg-ql-surface2 px-3 py-2">
                        <div className="font-ql-mono text-[9px] uppercase tracking-[0.1em] text-ql-muted">{stat.label}</div>
                        <div className={`font-ql-mono text-lg font-semibold ${stat.tone}`}>{money(stat.value)}</div>
                      </div>
                    ))}
                  </div>
                  {item.oldestOverdueDays > 0 && <p className="mt-2 text-[13px] font-medium text-ql-alert">Oldest invoice {item.oldestOverdueDays} days overdue.</p>}
                  <ul className="mt-3">
                    {item.invoices.slice(0, 8).map((invoice) => (
                      <li key={invoice.id} className="flex flex-wrap items-baseline gap-2 border-t border-ql-border/60 py-1.5 text-[13px] first:border-t-0">
                        <span className="font-ql-mono">{invoice.number ?? 'Invoice'}</span>
                        <span className="text-ql-text2">{invoice.date?.slice(0, 10) ?? '—'}</span>
                        <span className="font-ql-mono text-[9px] uppercase tracking-[0.08em] text-ql-muted">{invoice.status}</span>
                        <span className="ml-auto font-ql-mono font-semibold">{money(invoice.total)}</span>
                        {invoice.due > 0 && <span className="font-ql-mono text-[11px] text-ql-alert">{money(invoice.due)} due</span>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-ql-text2">No invoice history linked to this Org yet.</p>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <SectionTitle>People</SectionTitle>
              {item?.people.length ? (
                <ul className="mt-2 space-y-1.5">
                  {item.people.slice(0, 10).map((person) => (
                    <li key={person.id} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                      <span className="font-semibold">{person.name}</span>
                      {person.role && <span className="text-ql-text2">{person.role}</span>}
                      {person.email && <span className="font-ql-mono text-[11px] text-ql-text2">{person.email}</span>}
                      <span className="ml-auto flex items-center gap-1.5 font-ql-mono text-[10px] text-ql-muted">
                        {person.lastContactAt ? ago(person.lastContactAt) : 'no contact recorded'}
                        {person.source === 'ghl' && <Freshness at={record.ghl?.lastSyncedAt ?? null} />}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ql-text2">No named people yet — find the person who can explain this relationship.</p>
              )}
            </Card>

            <Card>
              <SectionTitle>Conversations & history</SectionTitle>
              {record.timeline.length ? (
                <ul className="mt-1 max-h-[52vh] overflow-y-auto">
                  {record.timeline.slice(0, 30).map((event) => <TimelineRow key={event.id} event={event} />)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ql-text2">No conversations or exchanges recorded yet.</p>
              )}
            </Card>

            {item?.evidenceGaps.length ? (
              <Card>
                <SectionTitle>Evidence gaps</SectionTitle>
                <ul className="mt-2 space-y-1">
                  {item.evidenceGaps.map((gap) => <li key={gap} className="text-[13px] text-ql-text2">• {gap}</li>)}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
