'use client';

import { useState } from 'react';
import { money } from '@/lib/format';

interface MatchedGrant {
  id: string;
  name: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  closes_at: string | null;
  provider: string | null;
  categories: string[] | null;
  url: string | null;
}

export interface PipelineProjectOption {
  id: string;
  name: string;
  slug: string;
}

function formatDate(value: string | null) {
  if (!value) return 'Ongoing';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / 86400000);
}

function uniqueLabels(values: string[] | null | undefined) {
  const seen = new Set<string>();
  return (values || []).filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function MatchedGrantsTable({
  grants,
  orgProfileId,
  projectOptions = [],
  defaultProjectId = null,
}: {
  grants: MatchedGrant[];
  orgProfileId: string;
  projectOptions?: PipelineProjectOption[];
  defaultProjectId?: string | null;
}) {
  const [items, setItems] = useState(grants);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [projectByGrant, setProjectByGrant] = useState<Record<string, string>>({});

  function selectedProjectId(grantId: string) {
    return projectByGrant[grantId] ?? defaultProjectId ?? '';
  }

  async function addToPipeline(grant: MatchedGrant) {
    setAdding(grant.id);
    try {
      const amount = grant.amount_max || grant.amount_min;
      const projectId = selectedProjectId(grant.id);
      const res = await fetch(`/api/org/${orgProfileId}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: grant.name,
          amount_display: amount ? money(amount) : null,
          amount_numeric: amount,
          funder: grant.provider,
          deadline: grant.deadline || grant.closes_at,
          status: 'prospect',
          grant_opportunity_id: grant.id,
          funder_type: 'government',
          ...(projectId ? { project_id: projectId } : {}),
        }),
      });
      if (res.ok) {
        setAdded(prev => new Set(prev).add(grant.id));
        // Remove from list after a brief delay so user sees the confirmation
        setTimeout(() => {
          setItems(prev => prev.filter(g => g.id !== grant.id));
        }, 1500);
      }
    } catch {
      // silently fail — button will reset
    } finally {
      setAdding(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="grid gap-3">
      {items.map((g) => {
        const isAdded = added.has(g.id);
        const isAdding = adding === g.id;
        const amount = g.amount_max ? money(g.amount_max) : g.amount_min ? money(g.amount_min) : 'Amount not listed';
        const deadline = g.deadline ?? g.closes_at;
        const days = daysUntil(deadline);
        const urgent = days != null && days >= 0 && days <= 30;
        return (
          <article key={g.id} className="border border-gray-200 bg-white rounded-sm shadow-sm p-4 hover:border-bauhaus-blue/40 hover:shadow-md transition-all">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Fed match</span>
                  {urgent && (
                    <span className="rounded-sm bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                      {days === 0 ? 'Closes today' : `${days} days left`}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-base font-black leading-snug text-bauhaus-black">
                  {g.name}
                </h3>
                <div className="mt-1 text-sm font-semibold text-gray-500">{g.provider || 'Provider not listed'}</div>
                {g.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">{g.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {uniqueLabels(g.categories).slice(0, 5).map((category) => (
                    <span key={category} className="rounded-sm bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">{category}</span>
                  ))}
                </div>
              </div>

              <div className="w-full shrink-0 lg:w-72">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-sm border border-gray-200 bg-gray-50 p-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount</div>
                    <div className="mt-1 text-sm font-black text-bauhaus-black">{amount}</div>
                  </div>
                  <div className="rounded-sm border border-gray-200 bg-gray-50 p-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Deadline</div>
                    <div className="mt-1 text-sm font-black text-bauhaus-black">{formatDate(deadline)}</div>
                  </div>
                </div>
                <label className="mt-3 block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Send to lane</span>
                  <select
                    value={selectedProjectId(g.id)}
                    onChange={(event) =>
                      setProjectByGrant((prev) => ({ ...prev, [g.id]: event.target.value }))
                    }
                    className="mt-1 w-full border border-gray-200 bg-white px-2 py-2 text-xs font-bold text-gray-700"
                  >
                    <option value="">ACT-wide</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex gap-2">
                  {isAdded ? (
                    <span className="flex-1 rounded-sm bg-green-100 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-green-700">
                      Added
                    </span>
                  ) : (
                    <button
                      onClick={() => addToPipeline(g)}
                      disabled={isAdding}
                      className="flex-1 rounded-sm bg-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isAdding ? 'Adding...' : 'Add to pipeline'}
                    </button>
                  )}
                  {g.url && (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm border border-gray-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-blue hover:bg-blue-50"
                    >
                      Source
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
