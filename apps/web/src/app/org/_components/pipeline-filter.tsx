'use client';

import { Fragment, useState } from 'react';

interface PipelineItem {
  id: string;
  name: string;
  amount_display: string | null;
  funder: string | null;
  funder_type: string | null;
  funder_entity_gs_id: string | null;
  funder_entity_name: string | null;
  deadline: string | null;
  status: string;
  notes: string | null;
  grant_opportunity_id: string | null;
  grant_url: string | null;
  grant_name: string | null;
  grant_provider: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  awarded: 'bg-green-100 text-green-800 border-green-300',
  upcoming: 'bg-amber-50 text-amber-700 border-amber-200',
  drafting: 'bg-blue-50 text-blue-700 border-blue-200',
  prospect: 'bg-gray-50 text-gray-500 border-gray-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  'historical/past': 'bg-stone-50 text-stone-600 border-stone-200',
};

const FUNDER_TYPE_STYLES: Record<string, string> = {
  foundation: 'bg-amber-50 text-amber-600 border-amber-200',
  government: 'bg-blue-50 text-blue-600 border-blue-200',
};

const STATUS_ACTIONS: Record<string, { label: string; hint: string }> = {
  submitted: { label: 'Track Decision', hint: 'Awaiting response — follow up if no reply by deadline + 2 weeks' },
  awarded: { label: 'Set Up Reporting', hint: 'Congratulations! Set up reporting schedule and milestones' },
  upcoming: { label: 'Start Drafting', hint: 'Deadline approaching — begin application draft' },
  drafting: { label: 'Continue Draft', hint: 'Application in progress' },
  prospect: { label: 'Build Relationship', hint: 'Research the funder, find warm introductions, build the case' },
  rejected: { label: 'Review & Retry', hint: 'Review feedback, consider resubmission or similar grants' },
  'historical/past': {
    label: 'Close Or Reframe',
    hint: 'Deadline has passed - keep as historical context or update with the next round.',
  },
};

const TERMINAL_STATUSES = new Set(['submitted', 'awarded', 'rejected', 'closed', 'historical', 'historical_past', 'past']);

function parseDeadline(value: string | null) {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isPastOpenDeadline(item: PipelineItem) {
  const deadline = parseDeadline(item.deadline);
  if (!deadline || TERMINAL_STATUSES.has(item.status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}

function displayStatus(item: PipelineItem) {
  return isPastOpenDeadline(item) ? 'historical/past' : item.status;
}

function displayDeadline(item: PipelineItem) {
  if (!item.deadline) return null;
  return isPastOpenDeadline(item) ? `${item.deadline} (past)` : item.deadline;
}

export function PipelineTable({ items, orgSlug, orgProfileId }: { items: PipelineItem[]; orgSlug: string; orgProfileId?: string }) {
  const funderTypes = [...new Set(items.map(p => p.funder_type).filter(Boolean))] as string[];
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter ? items.filter(p => p.funder_type === filter) : items;

  return (
    <>
      {funderTypes.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">Type:</span>
          <button
            onClick={() => setFilter(null)}
            className={`text-[10px] px-2.5 py-1 rounded-sm border font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              !filter
                ? 'bg-bauhaus-black text-white border-bauhaus-black'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {funderTypes.map(ft => (
            <button
              key={ft}
              onClick={() => setFilter(ft)}
              className={`text-[10px] px-2.5 py-1 rounded-sm border font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                filter === ft
                  ? 'bg-bauhaus-black text-white border-bauhaus-black'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {ft}
            </button>
          ))}
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                <th className="text-left py-3 pr-4 pl-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Opportunity</th>
                <th className="text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Amount</th>
                <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Funder</th>
                <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Deadline</th>
                <th className="text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => {
                const isExpanded = expandedId === g.id;
                const status = displayStatus(g);
                const action = STATUS_ACTIONS[status] ?? STATUS_ACTIONS.prospect;
                return (
                  <Fragment key={g.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : g.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-blue-50/50' : i % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-gray-50/30 hover:bg-blue-50/30'
                      }`}
                    >
                      <td className="py-3 pr-4 pl-4 font-medium">
                        <span className="flex items-center gap-2">
                          <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                          {g.grant_url ? (
                            <a href={g.grant_url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:underline" onClick={e => e.stopPropagation()}>
                              {g.name} <span className="text-[10px]">&#8599;</span>
                            </a>
                          ) : g.name}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">{g.amount_display}</td>
                      <td className="py-3 pr-4">
                        {g.funder_entity_gs_id ? (
                          <a
                            href={`/entity/${encodeURIComponent(g.funder_entity_gs_id)}`}
                            className="text-bauhaus-blue hover:underline text-sm"
                            onClick={e => e.stopPropagation()}
                          >
                            {g.funder}
                          </a>
                        ) : (
                          <span className="text-gray-500">{g.funder}</span>
                        )}
                        {g.funder_type && (
                          <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-sm border font-bold uppercase tracking-wider ${
                            FUNDER_TYPE_STYLES[g.funder_type] ?? 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>
                            {g.funder_type}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs">{displayDeadline(g)}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-[10px] px-2 py-0.5 font-bold border rounded-sm uppercase ${STATUS_STYLES[status] ?? STATUS_STYLES.prospect}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${g.id}-detail`} className="border-b border-gray-200">
                        <td colSpan={5} className="p-0">
                          <div className="bg-gray-50 border-l-4 border-bauhaus-blue px-6 py-5">
                            <div className="grid md:grid-cols-3 gap-6">
                              {/* Strategy & Notes */}
                              <div className="md:col-span-2">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Strategy & Notes</h4>
                                {g.notes ? (
                                  <p className="text-sm text-gray-700 leading-relaxed">{g.notes}</p>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No notes yet — add strategic context for this opportunity.</p>
                                )}

                                {/* Next Action */}
                                <div className="mt-4 p-3 bg-white border border-gray-200 rounded-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-bauhaus-red" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Next Action</span>
                                  </div>
                                  <p className="text-sm font-medium">{action.label}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{action.hint}</p>
                                </div>
                              </div>

                              {/* Quick Links */}
                              <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quick Links</h4>
                                <div className="space-y-2">
                                  {g.funder_entity_gs_id && (
                                    <a
                                      href={`/entity/${encodeURIComponent(g.funder_entity_gs_id)}`}
                                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-sm hover:border-bauhaus-blue hover:bg-blue-50/30 transition-colors text-sm"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                      <span className="font-medium">
                                        {g.funder_entity_name || g.funder} Profile
                                      </span>
                                      <span className="text-gray-400 ml-auto text-xs">&rarr;</span>
                                    </a>
                                  )}
                                  {!g.funder_entity_gs_id && g.funder && (
                                    <div className="px-3 py-2 bg-white border border-dashed border-gray-300 rounded-sm text-sm">
                                      <span className="text-gray-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block mr-2" />
                                        {g.funder} — not yet in CivicGraph
                                      </span>
                                    </div>
                                  )}
                                  <a
                                    href={`/org/${orgSlug}`}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-sm hover:border-bauhaus-blue hover:bg-blue-50/30 transition-colors text-sm"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    <span className="font-medium">Organisation Dashboard</span>
                                    <span className="text-gray-400 ml-auto text-xs">&rarr;</span>
                                  </a>
                                  {g.funder_type === 'foundation' && (
                                    <a
                                      href={`/api/data?type=foundations`}
                                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-sm hover:border-amber-400 hover:bg-amber-50/30 transition-colors text-sm"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      <span className="font-medium">Browse All Foundations</span>
                                      <span className="text-gray-400 ml-auto text-xs">&rarr;</span>
                                    </a>
                                  )}
                                  {g.grant_url && (
                                    <a
                                      href={g.grant_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-sm hover:border-green-400 hover:bg-green-50/30 transition-colors text-sm"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                      <span className="font-medium truncate">
                                        {g.grant_name || 'View Grant'} {g.grant_provider ? `— ${g.grant_provider}` : ''}
                                      </span>
                                      <span className="text-gray-400 ml-auto text-xs shrink-0">&#8599;</span>
                                    </a>
                                  )}
                                  {g.grant_opportunity_id && !g.grant_url && (
                                    <div className="px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-2" />
                                      <span className="font-medium">{g.grant_name || 'Linked Grant'}</span>
                                      <span className="text-gray-400 text-xs ml-1">(no external URL)</span>
                                    </div>
                                  )}
                                  {orgProfileId && (
                                    <a
                                      href={`/api/org/${orgProfileId}/pipeline/export?id=${g.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-sm hover:border-bauhaus-red hover:bg-red-50/30 transition-colors text-sm"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-bauhaus-red" />
                                      <span className="font-medium">Export One-Pager</span>
                                      <span className="text-gray-400 ml-auto text-xs">PDF &rarr;</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
