// The People surface (spec: docs/specs/people-surface-ux-spec.md, #154).
// Org-wide — People are the one cross-project noun. Desk-style split: list
// left, detail right, selection via ?rec=. Skin: Quiet Ledger, same tokens
// as One Desk. All reads hit the act_people mirror, never GHL live (ADR 0002).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  getActPeople,
  getMintCandidates,
  getPersonEvidence,
  ROLE_LABEL,
  ROLE_TYPES,
  WARMTH_VALUES,
  type ActPerson,
  type RoleType,
  type Warmth,
} from '@/lib/services/act-people';
import { deskProjectLabel } from '@/lib/services/act-one-desk';
import { PersonNextMove, AddRoleInline, MintPersonButton, ProjectsInline, AskLinksInline } from './people-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'People — CivicGraph' };
}

type Horizon = 'overdue' | 'fortnight' | 'quarter' | 'undated';
const HORIZON_LABEL: Record<Horizon, string> = {
  overdue: 'Overdue', fortnight: 'This fortnight', quarter: 'This quarter', undated: 'No date',
};

function horizon(p: ActPerson): Horizon {
  if (p.dueDays == null) return 'undated';
  if (p.dueDays < 0) return 'overdue';
  if (p.dueDays <= 14) return 'fortnight';
  return 'quarter';
}

function Due({ d }: { d: number | null }) {
  if (d == null) return <span className="font-ql-mono text-[10px] text-ql-muted">—</span>;
  if (d < 0) return <span className="font-ql-mono text-[10px] font-semibold text-ql-alert">{-d}d overdue</span>;
  if (d <= 14) return <span className="font-ql-mono text-[10px] font-semibold text-ql-alert">{d}d</span>;
  return <span className="font-ql-mono text-[10px] font-medium text-ql-ink">{d}d</span>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default async function PeoplePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  if (!profile) notFound();
  const orgProfileId = profile.id;

  const sp = await searchParams;
  const warmthFilter = WARMTH_VALUES.find((w) => w === sp.warmth) ?? null;
  const projectFilter = typeof sp.project === 'string' ? sp.project : null;
  const roleFilter = ROLE_TYPES.find((r) => r === sp.role) ?? null;
  const dueOnly = sp.due === '1';

  const [all, candidates] = await Promise.all([
    getActPeople(orgProfileId),
    getMintCandidates(orgProfileId),
  ]);

  const pool = all.filter(
    (p) =>
      (!warmthFilter || p.warmth === warmthFilter) &&
      (!projectFilter || p.projectCodes.includes(projectFilter)) &&
      (!roleFilter || p.roles.some((r) => r.roleType === roleFilter)) &&
      (!dueOnly || p.dueDays != null)
  );
  const selected = (typeof sp.rec === 'string' ? pool.find((p) => p.id === sp.rec) : null) ?? pool[0] ?? null;
  const evidence = selected ? await getPersonEvidence(selected.name) : null;

  const dueThisWeek = all.filter((p) => p.dueDays != null && p.dueDays >= 0 && p.dueDays <= 7).length;
  const overdue = all.filter((p) => p.dueDays != null && p.dueDays < 0).length;
  const syncedTimes = all.map((p) => (p.lastSyncedAt ? new Date(p.lastSyncedAt).getTime() : 0));
  const newestSync = syncedTimes.length ? Math.max(...syncedTimes) : null;
  const allStale = all.length > 0 && all.every((p) => p.stale);

  const base = `/org/${slug}/people`;
  const qs = (extra: Record<string, string | null>) => {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries({
      warmth: warmthFilter, role: roleFilter, project: projectFilter, due: dueOnly ? '1' : null, ...extra,
    })) {
      if (v) merged[k] = v;
    }
    const s = new URLSearchParams(merged).toString();
    return s ? `${base}?${s}` : base;
  };

  const groups: Array<{ horizon: Horizon; items: ActPerson[] }> = [];
  for (const p of pool.slice(0, 120)) {
    const h = horizon(p);
    const last = groups[groups.length - 1];
    if (last && last.horizon === h) last.items.push(p);
    else groups.push({ horizon: h, items: [p] });
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
      active ? 'border-ql-bar bg-ql-bar text-ql-inverse' : 'border-ql-border bg-ql-surface text-ql-text2 hover:border-ql-muted'
    }`;

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">
      <div className="mx-auto max-w-[1760px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-ql-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
              {all.length} people · {dueThisWeek} due this week · {overdue} overdue
            </div>
            <h1 className="mt-1 font-ql-display text-4xl font-semibold">People</h1>
          </div>
          <MintPersonButton orgProfileId={orgProfileId} />
        </div>

        {allStale && newestSync ? (
          <div className="mt-4 rounded-md border border-ql-border bg-ql-warm px-4 py-2 text-xs text-ql-text2">
            Relationship state may be stale — synced {Math.round((Date.now() - newestSync) / 3600_000)}h ago
          </div>
        ) : null}

        {/* Rail filters (spec §3): warmth band · role type · due only. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {WARMTH_VALUES.map((w) => (
            <Link key={w} href={qs({ warmth: warmthFilter === w ? null : w, rec: null })} className={chip(warmthFilter === w)}>
              {w}
            </Link>
          ))}
          <span className="mx-1 text-ql-border">·</span>
          {ROLE_TYPES.map((r) => (
            <Link key={r} href={qs({ role: roleFilter === r ? null : r, rec: null })} className={chip(roleFilter === r)}>
              {ROLE_LABEL[r]}
            </Link>
          ))}
          <span className="mx-1 text-ql-border">·</span>
          {[...new Set(all.flatMap((p) => p.projectCodes))].sort().map((c) => (
            <Link key={c} href={qs({ project: projectFilter === c ? null : c, rec: null })} className={chip(projectFilter === c)}>
              {deskProjectLabel(c)}
            </Link>
          ))}
          <span className="mx-1 text-ql-border">·</span>
          <Link href={qs({ due: dueOnly ? null : '1', rec: null })} className={chip(dueOnly)}>
            due only
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-ql-border bg-ql-surface">
              {groups.map((group) => (
                <div key={group.horizon}>
                  <div className={`sticky top-0 z-10 px-4 py-1.5 font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-inverse ${group.horizon === 'overdue' ? 'bg-ql-alert' : 'bg-ql-bar'}`}>
                    {HORIZON_LABEL[group.horizon]} · {group.items.length}
                  </div>
                  {group.items.map((p) => (
                    <Link
                      key={p.id}
                      href={qs({ rec: p.id })}
                      className={`flex items-center gap-2.5 border-t border-ql-border/60 px-4 py-2.5 text-sm first:border-t-0 ${selected?.id === p.id ? 'bg-ql-warm' : 'hover:bg-ql-surface2'}`}
                    >
                      <span className="rounded bg-ql-bar px-1.5 py-0.5 font-ql-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ql-inverse">person</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">{p.name}</span>
                        {p.nextAction ? <span className="text-ql-text2"> · {p.nextAction}</span> : null}
                      </span>
                      {p.projectCodes.slice(0, 2).map((c) => (
                        <span key={c} className="hidden rounded-full border border-ql-border px-2 py-0.5 font-ql-mono text-[8.5px] uppercase tracking-[0.06em] text-ql-text2 xl:inline">
                          {deskProjectLabel(c)}
                        </span>
                      ))}
                      {p.warmVia ? <span className="hidden text-xs italic text-ql-text2 md:inline">via {p.warmVia}</span> : null}
                      <Due d={p.dueDays} />
                    </Link>
                  ))}
                </div>
              ))}
              {pool.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-ql-text2">
                  {all.length === 0
                    ? 'No People yet. A Person is a human ACT deliberately cultivates — mint the first one, or pick from the candidates below.'
                    : 'Nothing matches this filter.'}
                </div>
              ) : null}
            </div>

            {/* Candidates rail (spec §5): not yet people — minting signals only. */}
            <details className="mt-3 rounded-lg border border-ql-border bg-ql-surface" open={all.length === 0}>
              <summary className="cursor-pointer px-4 py-2.5 font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ql-text2">
                Not yet people · {candidates.length}
              </summary>
              {candidates.map((c, i) => (
                <div key={`${c.source}-${c.ghlContactId ?? c.name}-${i}`} className="flex items-center gap-2.5 border-t border-ql-border/60 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{c.name}</span>
                    {c.detail ? <span className="text-ql-text2"> · {c.detail}</span> : null}
                  </span>
                  <span className="font-ql-mono text-[8.5px] uppercase text-ql-muted">{c.source === 'ghl' ? 'GHL' : 'contacts'}</span>
                  <MintPersonButton orgProfileId={orgProfileId} prefill={{ name: c.name, ghlContactId: c.ghlContactId }} small />
                </div>
              ))}
              {candidates.length === 0 ? <div className="border-t border-ql-border/60 px-4 py-3 text-xs text-ql-text2">No unminted candidates.</div> : null}
            </details>
          </div>

          {/* Detail pane (spec §4). */}
          <div className="rounded-lg border border-ql-border bg-ql-surface p-7">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded bg-ql-bar px-1.5 py-0.5 font-ql-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ql-inverse">person</span>
                  {selected.warmth ? (
                    <span className="font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ql-text2">{selected.warmth}</span>
                  ) : null}
                  {selected.warmVia ? <span className="text-xs italic text-ql-text2">via {selected.warmVia}</span> : null}
                  {selected.stale ? (
                    <span className="rounded-full border border-ql-alert px-2 py-0.5 font-ql-mono text-[8.5px] font-semibold uppercase text-ql-alert">stale</span>
                  ) : null}
                </div>
                <h2 className="mt-2.5 font-ql-display text-3xl font-semibold leading-tight">{selected.name}</h2>
                <p className="mt-1.5 text-xs text-ql-muted">
                  {selected.owner ? `${selected.owner} · ` : ''}last touch {fmtDate(selected.lastTouchAt)} · synced {fmtDate(selected.lastSyncedAt)}
                </p>

                <div className="mt-5">
                  <div className="font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-muted">Roles</div>
                  {selected.roles.length > 0 ? (
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {selected.roles.map((r) => (
                        <li key={r.id}>
                          {r.roleType === 'opens_into' ? (
                            <span className="font-semibold text-ql-accent">opens into </span>
                          ) : (
                            <span className="text-ql-text2">{ROLE_LABEL[r.roleType]} </span>
                          )}
                          {r.orgRef?.startsWith('GS-') ? (
                            <Link href={`/entity/${r.orgRef}`} className="font-medium underline decoration-ql-border underline-offset-2 hover:text-ql-accent">
                              {r.orgName}
                            </Link>
                          ) : (
                            <span className="font-medium">{r.orgName}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <AddRoleInline orgProfileId={orgProfileId} personId={selected.id} />
                </div>

                <ProjectsInline orgProfileId={orgProfileId} personId={selected.id} projectCodes={selected.projectCodes} />
                <AskLinksInline orgProfileId={orgProfileId} personId={selected.id} askLinks={selected.askLinks} />

                <PersonNextMove
                  orgProfileId={orgProfileId}
                  personId={selected.id}
                  nextAction={selected.nextAction}
                  reviewBy={selected.reviewBy}
                />

                {/* CivicGraph evidence — annotations, never state (spec §4.4). */}
                <details className="mt-5 rounded-md border border-ql-border">
                  <summary className="cursor-pointer px-4 py-2 font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-muted">
                    CivicGraph evidence
                  </summary>
                  <div className="space-y-1.5 px-4 pb-3 text-xs text-ql-text2">
                    {evidence?.influence ? (
                      <p>{evidence.influence.boardCount} board seats · financial footprint ${Math.round(evidence.influence.financialFootprint / 1000)}K</p>
                    ) : null}
                    {evidence?.interlocks.map((it, i) => (
                      <p key={i}>Shared boards ({it.sharedBoardCount}): {it.entities}</p>
                    ))}
                    {!evidence?.influence && (evidence?.interlocks.length ?? 0) === 0 ? <p>No CivicGraph matches for this name.</p> : null}
                    <p className="text-ql-muted">Evidence refreshes nightly with the CivicGraph views.</p>
                  </div>
                </details>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.ghlUrl ? (
                    <a href={selected.ghlUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-accent hover:bg-ql-surface2">
                      Open in GHL ↗
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-ql-text2">Nothing selected.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
