'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { decisionTagBadgeClass, decisionTagLabel, SHORTLIST_DECISIONS } from '@/lib/procurement-shortlist';

type ShortlistOption = {
  id: string;
  name: string;
  is_default: boolean;
};

type WorkspaceMembership = {
  id: string;
  shortlist_id: string;
  shortlist_name: string;
  shortlist_is_default: boolean;
  shortlist_owner_name: string | null;
  shortlist_decision_due_at: string | null;
  shortlist_next_action: string | null;
  note: string | null;
  decision_tag: string | null;
  updated_at: string;
  contract_count: number;
  contract_total_value: number;
};

type WorkspaceTask = {
  id: string;
  shortlist_id: string;
  shortlist_item_id: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'done';
  due_at: string | null;
  assignee_label: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

type SupplierSeed = {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  lga_name: string | null;
  seifa_irsd_decile: number | null;
  latest_revenue: number | null;
  is_community_controlled: boolean;
  contracts: {
    count: number;
    total_value: number;
  };
};

function formatMoney(amount: number) {
  if (!amount) return '$0';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ProcurementWorkspaceCard({
  orgName,
  shortlists,
  initialMemberships,
  initialTasks,
  supplier,
  canEdit,
}: {
  orgName: string;
  shortlists: ShortlistOption[];
  initialMemberships: WorkspaceMembership[];
  initialTasks: WorkspaceTask[];
  supplier: SupplierSeed;
  canEdit: boolean;
}) {
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>(initialMemberships);
  const [tasks] = useState<WorkspaceTask[]>(initialTasks);
  const [addShortlistId, setAddShortlistId] = useState<string>(() => {
    const taken = new Set(initialMemberships.map((membership) => membership.shortlist_id));
    return shortlists.find((shortlist) => !taken.has(shortlist.id))?.id || '';
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [statusByItem, setStatusByItem] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialMemberships.map((membership) => [membership.id, membership.note || ''])),
  );

  const sortedMemberships = useMemo(
    () => [...memberships].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [memberships],
  );
  const availableShortlists = useMemo(() => {
    const taken = new Set(memberships.map((membership) => membership.shortlist_id));
    return shortlists.filter((shortlist) => !taken.has(shortlist.id));
  }, [memberships, shortlists]);
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => new Date(a.due_at || a.updated_at).getTime() - new Date(b.due_at || b.updated_at).getTime()),
    [tasks],
  );
  const openTasks = useMemo(
    () => sortedTasks.filter((task) => task.status !== 'done'),
    [sortedTasks],
  );
  const leadMembership = sortedMemberships[0] || null;

  function syncMembership(updated: WorkspaceMembership) {
    setMemberships((prev) => {
      const existing = prev.some((membership) => membership.id === updated.id);
      const next = existing
        ? prev.map((membership) => (membership.id === updated.id ? updated : membership))
        : [...prev, updated];
      return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });
    setNoteDrafts((prev) => ({ ...prev, [updated.id]: updated.note || '' }));
  }

  async function addToShortlist() {
    if (!addShortlistId) return;
    setBusyKey(`add:${addShortlistId}`);
    setError('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortlistId: addShortlistId,
          supplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to add organisation to shortlist');
        return;
      }

      const shortlist = shortlists.find((option) => option.id === addShortlistId);
      if (!shortlist) return;
      syncMembership({
        id: data.item.id,
        shortlist_id: addShortlistId,
        shortlist_name: shortlist.name,
        shortlist_is_default: shortlist.is_default,
        shortlist_owner_name: null,
        shortlist_decision_due_at: null,
        shortlist_next_action: null,
        note: data.item.note || null,
        decision_tag: data.item.decision_tag || null,
        updated_at: data.item.updated_at,
        contract_count: data.item.contract_count || 0,
        contract_total_value: Number(data.item.contract_total_value || 0),
      });
      setStatusByItem((prev) => ({ ...prev, [data.item.id]: 'Saved' }));
      const nextAvailable = availableShortlists.filter((option) => option.id !== addShortlistId);
      setAddShortlistId(nextAvailable[0]?.id || '');
    } catch {
      setError('Unable to add organisation to shortlist');
    } finally {
      setBusyKey(null);
    }
  }

  async function saveMembership(item: WorkspaceMembership, payload: { note?: string; decisionTag?: string | null }) {
    setBusyKey(item.id);
    setError('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          shortlistId: item.shortlist_id,
          note: payload.note,
          decisionTag: payload.decisionTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to update shortlist item');
        setStatusByItem((prev) => ({ ...prev, [item.id]: 'Unable to save' }));
        return;
      }

      const updated = {
        ...item,
        note: data.item.note || null,
        decision_tag: data.item.decision_tag || null,
        updated_at: data.item.updated_at,
        contract_count: data.item.contract_count || item.contract_count,
        contract_total_value: Number(data.item.contract_total_value ?? item.contract_total_value),
      };
      syncMembership(updated);
      setStatusByItem((prev) => ({ ...prev, [item.id]: payload.note !== undefined ? 'Note saved' : 'Decision saved' }));
    } catch {
      setError('Unable to update shortlist item');
      setStatusByItem((prev) => ({ ...prev, [item.id]: 'Unable to save' }));
    } finally {
      setBusyKey(null);
    }
  }

  async function removeMembership(item: WorkspaceMembership) {
    setBusyKey(item.id);
    setError('');
    try {
      const res = await fetch('/api/tender-intelligence/shortlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          shortlistId: item.shortlist_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to remove organisation from shortlist');
        return;
      }
      setMemberships((prev) => prev.filter((membership) => membership.id !== item.id));
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setStatusByItem((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (!addShortlistId) {
        setAddShortlistId(item.shortlist_id);
      }
    } catch {
      setError('Unable to remove organisation from shortlist');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="bg-white border-4 border-bauhaus-red p-4">
      <div className="flex flex-col gap-3 pb-3 border-b-4 border-bauhaus-red">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-bauhaus-red uppercase tracking-widest">
              Procurement Workspace
            </h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mt-1">
              {orgName}
            </p>
          </div>
          {memberships.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-red/20 bg-error-light text-bauhaus-red">
              Saved in {memberships.length} shortlist{memberships.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {canEdit ? (
          shortlists.length === 0 ? (
            <p className="text-sm font-medium text-bauhaus-muted">
              No shortlists exist yet for this workspace. Open Tender Intelligence to create one first.
            </p>
          ) : availableShortlists.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={addShortlistId}
                onChange={(event) => setAddShortlistId(event.target.value)}
                className="border-2 border-bauhaus-red px-3 py-3 text-sm font-bold bg-white"
              >
                {availableShortlists.map((shortlist) => (
                  <option key={shortlist.id} value={shortlist.id}>
                    Add to {shortlist.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addToShortlist}
                disabled={!addShortlistId || busyKey?.startsWith('add:')}
                className="px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-40"
              >
                {busyKey?.startsWith('add:') ? 'Adding...' : 'Add To Shortlist'}
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-bauhaus-muted">
              This organisation is already in every shortlist you can edit.
            </p>
          )
        ) : (
          <p className="text-sm font-medium text-bauhaus-muted">
            View only. You can see shortlist decisions here but cannot edit them.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4 border-2 border-bauhaus-red bg-red-50 px-3 py-2 text-sm font-bold text-bauhaus-black">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {(leadMembership || openTasks.length > 0) && (
          <div className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Current Decision</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${decisionTagBadgeClass(leadMembership?.decision_tag || null)}`}>
                    {decisionTagLabel(leadMembership?.decision_tag || null)}
                  </span>
                  {leadMembership && (
                    <span className="text-xs font-bold text-bauhaus-muted">
                      {leadMembership.shortlist_name}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Owner / Due</p>
                <p className="text-sm font-black text-bauhaus-black mt-2">
                  {leadMembership?.shortlist_owner_name || 'Unassigned'}
                </p>
                <p className="text-xs font-medium text-bauhaus-muted mt-1">
                  {leadMembership?.shortlist_decision_due_at ? `Due ${formatDateTime(leadMembership.shortlist_decision_due_at)}` : 'No decision due date set'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Open Tasks</p>
                <p className="text-2xl font-black text-bauhaus-black mt-2">{openTasks.length}</p>
                {leadMembership?.shortlist_next_action && (
                  <p className="text-xs font-medium text-bauhaus-muted mt-1">
                    Next: {leadMembership.shortlist_next_action}
                  </p>
                )}
              </div>
            </div>
            {leadMembership?.note && (
              <div className="mt-3 border-t border-bauhaus-black/10 pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Latest Note</p>
                <p className="text-sm font-medium text-bauhaus-black mt-2">{leadMembership.note}</p>
              </div>
            )}
          </div>
        )}

        {sortedMemberships.length === 0 ? (
          <p className="text-sm font-medium text-bauhaus-muted">
            This organisation is not currently saved in your procurement workspace.
          </p>
        ) : (
          sortedMemberships.map((membership) => {
            const noteDraft = noteDrafts[membership.id] ?? membership.note ?? '';
            const hasUnsavedNote = noteDraft !== (membership.note || '');
            const status = busyKey === membership.id
              ? 'Saving...'
              : statusByItem[membership.id] || (hasUnsavedNote ? 'Unsaved changes' : 'Saved');

            return (
              <div key={membership.id} className="border-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-red/20 bg-white text-bauhaus-red">
                        {membership.shortlist_name}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border ${decisionTagBadgeClass(membership.decision_tag)}`}>
                        {decisionTagLabel(membership.decision_tag)}
                      </span>
                      <span className="text-xs font-bold text-bauhaus-muted">
                        Updated {formatDateTime(membership.updated_at)}
                      </span>
                    </div>
                    {(membership.contract_count > 0 || membership.contract_total_value > 0) && (
                      <p className="text-xs font-bold text-bauhaus-black mt-2">
                        Snapshot: {membership.contract_count} contract{membership.contract_count === 1 ? '' : 's'} • {formatMoney(membership.contract_total_value)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/tender-intelligence?shortlistId=${membership.shortlist_id}#procurement-workspace`}
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-white transition-colors"
                    >
                      Open Shortlist
                    </Link>
                    {canEdit && (
                      <button
                        onClick={() => removeMembership(membership)}
                        disabled={busyKey === membership.id}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-40"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Decision Tag</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SHORTLIST_DECISIONS.map((option) => {
                      const optionKey = option.value || 'untriaged';
                      const isActive = (membership.decision_tag || 'untriaged') === optionKey;
                      return (
                        <button
                          key={`${membership.id}-${optionKey}`}
                          onClick={() => saveMembership(membership, { decisionTag: option.value })}
                          disabled={!canEdit || busyKey === membership.id}
                          className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-colors disabled:opacity-40 ${
                            isActive
                              ? decisionTagBadgeClass(option.value)
                              : 'border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Procurement Notes</p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {status}
                    </span>
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={(event) => {
                      setNoteDrafts((prev) => ({ ...prev, [membership.id]: event.target.value }));
                      setStatusByItem((prev) => ({
                        ...prev,
                        [membership.id]: event.target.value === (membership.note || '') ? 'Saved' : 'Unsaved changes',
                      }));
                    }}
                    disabled={!canEdit}
                    rows={4}
                    placeholder="Record the procurement note, risk, owner, or next action."
                    className="mt-2 w-full border-2 border-bauhaus-black px-3 py-3 text-sm font-medium bg-white placeholder:text-bauhaus-muted disabled:opacity-40"
                  />
                  {canEdit && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => saveMembership(membership, { note: noteDraft })}
                        disabled={busyKey === membership.id || !hasUnsavedNote}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-blue hover:text-white hover:border-bauhaus-blue transition-colors disabled:opacity-40"
                      >
                        {busyKey === membership.id ? 'Saving...' : hasUnsavedNote ? 'Save Note' : 'Saved'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {sortedTasks.length > 0 && (
          <div className="border-2 border-bauhaus-black bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Open Review Tasks</p>
            <div className="mt-3 space-y-3">
              {sortedTasks.map((task) => (
                <div key={task.id} className="border-t border-bauhaus-black/10 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black">
                      {task.priority}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-bauhaus-black/20 bg-white text-bauhaus-muted">
                      {task.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm font-black text-bauhaus-black mt-2">{task.title}</p>
                  {task.description && (
                    <p className="text-xs font-medium text-bauhaus-muted mt-1">{task.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-bauhaus-muted">
                    {task.assignee_label && <span>Owner {task.assignee_label}</span>}
                    {task.due_at && <span>Due {formatDateTime(task.due_at)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
