'use client';

// Client actions for the People surface: the next-move box (Done — set next /
// Release / Edit, per #148 — never a bare dismiss), inline role add, and the
// one minting modal (spec §5). Writes go through /api/org/[id]/people, which
// hits GHL first and mirrors after — errors surface, never silently drop.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const WARMTHS = ['hot', 'warm', 'steady', 'cooling', 'cold'] as const;
const ROLES = [
  { value: 'works_at', label: 'works at' },
  { value: 'board_of', label: 'board of' },
  { value: 'decides_for', label: 'decides for' },
  { value: 'opens_into', label: 'opens into' },
] as const;

// Mirror of PROJECT_CODE_OPTIONS + deskProjectLabel (server-side) — plain
// words for the mint modal and detail-pane project picker.
const PROJECTS: Array<{ code: string; label: string }> = [
  { code: 'ACT-GD', label: 'Goods' },
  { code: 'ACT-JH', label: 'JusticeHub' },
  { code: 'ACT-HV', label: 'Harvest' },
  { code: 'ACT-EL', label: 'Empathy Ledger' },
  { code: 'ACT-PI', label: 'Palm Island' },
  { code: 'ACT-MY', label: 'ACT' },
];

const inputCls ='w-full rounded-md border border-ql-border bg-ql-surface px-3 py-2 text-sm text-ql-ink placeholder:text-ql-muted focus:border-ql-accent focus:outline-none';
const btnPrimary = 'rounded-md bg-ql-bar px-4 py-2 text-xs font-semibold text-ql-inverse transition-colors hover:bg-ql-ink disabled:opacity-50';
const btnQuiet = 'rounded-md border border-ql-border bg-ql-surface px-4 py-2 text-xs font-semibold text-ql-ink transition-colors hover:bg-ql-surface2 disabled:opacity-50';

function defaultReviewBy(): string {
  const d = new Date(Date.now() + 14 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function usePatch(orgProfileId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/people`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || 'failed');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { patch, busy, error };
}

export function PersonNextMove({ orgProfileId, personId, nextAction, reviewBy }: {
  orgProfileId: string;
  personId: string;
  nextAction: string | null;
  reviewBy: string | null;
}) {
  const { patch, busy, error } = usePatch(orgProfileId);
  const [mode, setMode] = useState<'view' | 'edit' | 'next' | 'release'>('view');
  const [text, setText] = useState('');
  const [date, setDate] = useState(defaultReviewBy());

  useEffect(() => {
    setMode('view');
  }, [personId]);

  async function submit() {
    const ok = await patch(
      mode === 'next'
        ? { id: personId, done: true, next_action: text, review_by: date }
        : { id: personId, next_action: text, review_by: date }
    );
    if (ok) setMode('view');
  }

  return (
    <div className="mt-5 rounded-md bg-ql-warm px-4 py-3">
      <div className="font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-accent">Next move</div>
      {mode === 'view' ? (
        <>
          <p className="mt-1 text-sm font-medium leading-6">
            {nextAction ?? 'No next action — this Person is released (dateless tail).'}
            {reviewBy ? <span className="text-ql-text2"> · review by {reviewBy}</span> : null}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => { setText(''); setDate(defaultReviewBy()); setMode('next'); }}>
              Done — set next
            </button>
            <button type="button" className={btnQuiet} disabled={busy} onClick={() => { setText(nextAction ?? ''); setDate(reviewBy ?? defaultReviewBy()); setMode('edit'); }}>
              Edit
            </button>
            {nextAction ? (
              <button type="button" className={btnQuiet} disabled={busy} onClick={() => setMode('release')}>
                Release
              </button>
            ) : null}
          </div>
        </>
      ) : mode === 'release' ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm">Release this watch? The Person drops to the dateless tail — nothing will resurface them until you set a new next action.</p>
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={async () => { if (await patch({ id: personId, release: true })) setMode('view'); }}>
              {busy ? '…' : 'Release'}
            </button>
            <button type="button" className={btnQuiet} onClick={() => setMode('view')}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'next' ? 'The new next action' : 'Next action'} />
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy || !text.trim() || !date} onClick={submit}>
              {busy ? '…' : 'Save'}
            </button>
            <button type="button" className={btnQuiet} onClick={() => setMode('view')}>Cancel</button>
          </div>
        </div>
      )}
      {error ? <p className="mt-2 text-xs font-semibold text-ql-alert">{error}</p> : null}
    </div>
  );
}

export function AddRoleInline({ orgProfileId, personId }: { orgProfileId: string; personId: string }) {
  const { patch, busy, error } = usePatch(orgProfileId);
  const [open, setOpen] = useState(false);
  const [roleType, setRoleType] = useState<string>('works_at');
  const [orgName, setOrgName] = useState('');

  useEffect(() => setOpen(false), [personId]);

  if (!open) {
    return (
      <button type="button" className="mt-2 text-xs font-semibold text-ql-accent hover:underline" onClick={() => setOpen(true)}>
        + add role
      </button>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select className="rounded-md border border-ql-border bg-ql-surface px-2 py-2 text-xs" value={roleType} onChange={(e) => setRoleType(e.target.value)}>
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <input className="w-52 rounded-md border border-ql-border bg-ql-surface px-3 py-2 text-xs" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Org name" />
      <button
        type="button"
        className={btnPrimary}
        disabled={busy || !orgName.trim()}
        onClick={async () => {
          if (await patch({ id: personId, add_role: { role_type: roleType, org_name: orgName } })) {
            setOrgName('');
            setOpen(false);
          }
        }}
      >
        {busy ? '…' : 'Add'}
      </button>
      <button type="button" className={btnQuiet} onClick={() => setOpen(false)}>Cancel</button>
      {error ? <span className="text-xs font-semibold text-ql-alert">{error}</span> : null}
    </div>
  );
}

function ProjectChips({ value, onToggle }: { value: string[]; onToggle: (code: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PROJECTS.map((p) => (
        <button
          key={p.code}
          type="button"
          onClick={() => onToggle(p.code)}
          className={`rounded-full border px-3 py-1 text-[11px] font-medium ${value.includes(p.code) ? 'border-ql-bar bg-ql-bar text-ql-inverse' : 'border-ql-border text-ql-text2 hover:border-ql-muted'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Detail-pane project ties editor — set by humans, never derived. */
export function ProjectsInline({ orgProfileId, personId, projectCodes }: {
  orgProfileId: string;
  personId: string;
  projectCodes: string[];
}) {
  const { patch, busy, error } = usePatch(orgProfileId);
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState(projectCodes);

  useEffect(() => {
    setOpen(false);
    setCodes(projectCodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  return (
    <div className="mt-4">
      <div className="font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-muted">Projects</div>
      {open ? (
        <div className="mt-1.5 space-y-2">
          <ProjectChips value={codes} onToggle={(c) => setCodes((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} />
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={async () => { if (await patch({ id: personId, project_codes: codes })) setOpen(false); }}>
              {busy ? '…' : 'Save'}
            </button>
            <button type="button" className={btnQuiet} onClick={() => { setCodes(projectCodes); setOpen(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {projectCodes.map((c) => (
            <span key={c} className="rounded-full border border-ql-border px-2.5 py-0.5 font-ql-mono text-[9px] uppercase tracking-[0.06em] text-ql-text2">
              {PROJECTS.find((p) => p.code === c)?.label ?? c}
            </span>
          ))}
          <button type="button" className="text-xs font-semibold text-ql-accent hover:underline" onClick={() => setOpen(true)}>
            {projectCodes.length ? 'edit' : '+ add projects'}
          </button>
        </div>
      )}
      {error ? <p className="mt-1 text-xs font-semibold text-ql-alert">{error}</p> : null}
    </div>
  );
}

type AskSearchResult = { ghlOpportunityId: string; name: string; detail: string | null };

/** "Warms N Asks" — human-minted Ask↔Person links (act_ask_warmers). */
export function AskLinksInline({ orgProfileId, personId, askLinks }: {
  orgProfileId: string;
  personId: string;
  askLinks: Array<{ ghlOpportunityId: string; askName: string | null }>;
}) {
  const { patch, busy, error } = usePatch(orgProfileId);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AskSearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOpen(false);
    setQ('');
    setResults([]);
  }, [personId]);

  function onSearch(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/org/${orgProfileId}/people/search?type=ask&q=${encodeURIComponent(v.trim())}`);
        if (res.ok) setResults(((await res.json()) as { results: AskSearchResult[] }).results);
      } catch { /* best-effort */ }
    }, 250);
  }

  return (
    <div className="mt-4">
      <div className="font-ql-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ql-muted">
        Warms {askLinks.length > 0 ? `${askLinks.length} ask${askLinks.length === 1 ? '' : 's'}` : ''}
      </div>
      {askLinks.length > 0 ? (
        <ul className="mt-1.5 space-y-1 text-sm">
          {askLinks.map((l) => (
            <li key={l.ghlOpportunityId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{l.askName ?? l.ghlOpportunityId}</span>
              <button type="button" className="text-xs text-ql-muted hover:text-ql-alert" disabled={busy} onClick={() => patch({ id: personId, unlink_ask: l.ghlOpportunityId })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <div className="mt-2">
          <input className={inputCls} value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search open Asks by name" autoFocus />
          {results.length > 0 ? (
            <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-ql-border">
              {results
                .filter((r) => !askLinks.some((l) => l.ghlOpportunityId === r.ghlOpportunityId))
                .map((r) => (
                  <button
                    key={r.ghlOpportunityId}
                    type="button"
                    className="flex w-full items-center gap-2 border-t border-ql-border/60 px-3 py-1.5 text-left text-xs first:border-t-0 hover:bg-ql-surface2"
                    disabled={busy}
                    onClick={async () => {
                      if (await patch({ id: personId, link_ask: { ghl_opportunity_id: r.ghlOpportunityId, ask_name: r.name } })) {
                        setOpen(false);
                        setQ('');
                        setResults([]);
                      }
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{r.name}</span>
                      {r.detail ? <span className="text-ql-text2"> · {r.detail}</span> : null}
                    </span>
                  </button>
                ))}
            </div>
          ) : null}
          <button type="button" className="mt-1.5 text-xs font-semibold text-ql-text2 hover:underline" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="mt-1.5 text-xs font-semibold text-ql-accent hover:underline" onClick={() => setOpen(true)}>
          + link an Ask
        </button>
      )}
      {error ? <p className="mt-1 text-xs font-semibold text-ql-alert">{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minting (spec §5): one modal for every entry point. Mandatory at mint:
// warmth (+ via when indirect) AND a next action with a review-by date.

type SearchResult = { source: 'ghl' | 'civicgraph'; ghlContactId: string | null; name: string; detail: string | null };

export function MintPersonButton({ orgProfileId, prefill, small }: {
  orgProfileId: string;
  prefill?: { name: string; ghlContactId: string | null };
  small?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(prefill?.name ?? '');
  const [claimedId, setClaimedId] = useState<string | null>(prefill?.ghlContactId ?? null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [warmth, setWarmth] = useState('warm');
  const [warmVia, setWarmVia] = useState('');
  const [roleType, setRoleType] = useState('');
  const [roleOrg, setRoleOrg] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState('');
  const [reviewBy, setReviewBy] = useState(defaultReviewBy());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onNameChange(v: string) {
    setName(v);
    setClaimedId(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/org/${orgProfileId}/people/search?q=${encodeURIComponent(v.trim())}`);
        if (res.ok) setResults(((await res.json()) as { results: SearchResult[] }).results);
      } catch {
        /* search is best-effort */
      }
    }, 250);
  }

  async function mint() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ghl_contact_id: claimedId,
          warmth,
          warm_via: warmVia.trim() || null,
          next_action: nextAction.trim(),
          review_by: reviewBy,
          project_codes: projects,
          ...(roleType && roleOrg.trim() ? { role: { role_type: roleType, org_name: roleOrg.trim() } } : {}),
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'failed');
      setOpen(false);
      router.push(`?rec=${json.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={small ? 'rounded-md border border-ql-border px-2.5 py-1 font-ql-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-ql-accent hover:bg-ql-surface2' : btnPrimary} onClick={() => setOpen(true)}>
        {small ? 'mint' : '+ Mint a person'}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 pt-[8vh]" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-lg rounded-lg border border-ql-border bg-ql-surface p-6 text-ql-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-ql-display text-xl font-semibold">Mint a person</h3>
            <p className="mt-1 text-xs text-ql-text2">
              Minting creates or claims the GHL contact — GHL owns the relationship state from here.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <input className={inputCls} value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Name — searches GHL and CivicGraph" autoFocus />
                {claimedId ? (
                  <p className="mt-1 text-xs text-ql-moss">Claiming existing GHL contact.</p>
                ) : results.length > 0 ? (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-ql-border">
                    {results.map((r, i) => (
                      <button
                        key={`${r.source}-${r.ghlContactId ?? r.name}-${i}`}
                        type="button"
                        className="flex w-full items-center gap-2 border-t border-ql-border/60 px-3 py-1.5 text-left text-xs first:border-t-0 hover:bg-ql-surface2"
                        onClick={() => {
                          setName(r.name);
                          setClaimedId(r.ghlContactId);
                          setResults([]);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{r.name}</span>
                          {r.detail ? <span className="text-ql-text2"> · {r.detail}</span> : null}
                        </span>
                        <span className="font-ql-mono text-[8.5px] uppercase text-ql-muted">{r.source === 'ghl' ? 'claim' : 'create'}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {WARMTHS.map((w) => (
                  <button key={w} type="button" onClick={() => setWarmth(w)} className={`rounded-full border px-3 py-1 text-[11px] font-medium ${warmth === w ? 'border-ql-bar bg-ql-bar text-ql-inverse' : 'border-ql-border text-ql-text2 hover:border-ql-muted'}`}>
                    {w}
                  </button>
                ))}
              </div>
              <input className={inputCls} value={warmVia} onChange={(e) => setWarmVia(e.target.value)} placeholder="Warm via (leave empty when direct)" />

              <ProjectChips value={projects} onToggle={(c) => setProjects((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} />

              <div className="flex gap-2">
                <select className="rounded-md border border-ql-border bg-ql-surface px-2 py-2 text-xs" value={roleType} onChange={(e) => setRoleType(e.target.value)}>
                  <option value="">role (optional)</option>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <input className={inputCls} value={roleOrg} onChange={(e) => setRoleOrg(e.target.value)} placeholder="Org" disabled={!roleType} />
              </div>

              <input className={inputCls} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Next action (required)" />
              <input className={inputCls} type="date" value={reviewBy} onChange={(e) => setReviewBy(e.target.value)} />
            </div>

            {error ? <p className="mt-3 text-xs font-semibold text-ql-alert">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnQuiet} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className={btnPrimary} disabled={busy || !name.trim() || !nextAction.trim() || !reviewBy} onClick={mint}>
                {busy ? 'Minting…' : claimedId ? 'Claim + mint' : 'Mint'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
