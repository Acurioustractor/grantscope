'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { OrgContactWithEntity } from '@/lib/services/org-dashboard-service';
import { ContactTypeBadge } from '../../_components/ui';

type SortField = 'name' | 'contact_type' | 'organisation';
type SortDir = 'asc' | 'desc';

interface SyncResult {
  synced: number;
  errors: number;
  details: Array<{ contact_id: string; name: string; status: string; error?: string }>;
}

const ENGAGEMENT_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  responsive: 'bg-blue-50 text-blue-700 border-blue-200',
  dormant: 'bg-gray-100 text-gray-500 border-gray-200',
  new: 'bg-amber-50 text-amber-700 border-amber-200',
};

function EngagementBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const style = ENGAGEMENT_STYLES[status.toLowerCase()] ?? 'bg-gray-50 text-gray-500 border-gray-200';
  return (
    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border rounded-sm ${style}`}>
      {status}
    </span>
  );
}

function TagChip({ tag, onClick }: { tag: string; onClick?: () => void }) {
  const [prefix, ...rest] = tag.split(':');
  const value = rest.join(':');
  const colors: Record<string, string> = {
    role: 'bg-purple-50 text-purple-600',
    sector: 'bg-teal-50 text-teal-600',
    engagement: 'bg-blue-50 text-blue-600',
    topic: 'bg-orange-50 text-orange-600',
    priority: 'bg-red-50 text-red-600',
    source: 'bg-amber-50 text-amber-600',
    org: 'bg-indigo-50 text-indigo-600',
    ghl: 'bg-gray-100 text-gray-500',
  };
  const color = colors[prefix] ?? 'bg-gray-50 text-gray-500';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[9px] px-1.5 py-0.5 font-bold rounded-sm ${color} hover:opacity-80 transition-opacity cursor-pointer`}
      title={tag}
    >
      {value || tag}
    </button>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function ContactsClient({
  contacts,
  orgProfileId,
  orgSlug,
}: {
  contacts: OrgContactWithEntity[];
  orgProfileId: string;
  orgSlug: string;
}) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [linkFilter, setLinkFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const contactTypes = useMemo(() => {
    const types = new Set(contacts.map(c => c.contact_type));
    return Array.from(types).sort();
  }, [contacts]);

  // Collect all unique tags across contacts
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const c of contacts) {
      for (const t of c.unified_tags ?? []) tags.add(t);
    }
    return Array.from(tags).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;

    if (typeFilter !== 'all') {
      result = result.filter(c => c.contact_type === typeFilter);
    }

    if (linkFilter === 'linked') {
      result = result.filter(c => c.linked_entity_gs_id);
    } else if (linkFilter === 'person') {
      result = result.filter(c => c.person_id);
    } else if (linkFilter === 'email') {
      result = result.filter(c => c.email);
    } else if (linkFilter === 'ghl') {
      result = result.filter(c => c.ghl_contact_id);
    } else if (linkFilter === 'notion') {
      result = result.filter(c => c.notion_id);
    }

    if (tagFilter !== 'all') {
      result = result.filter(c => c.unified_tags?.includes(tagFilter));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.organisation?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.unified_tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const aVal = (a[sortField] ?? '').toLowerCase();
      const bVal = (b[sortField] ?? '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [contacts, typeFilter, linkFilter, tagFilter, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const handleSyncGHL = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/contacts/sync-ghl`, {
        method: 'POST',
      });
      const data = await res.json();
      setSyncResult(data);
    } catch {
      setSyncResult({ synced: 0, errors: 1, details: [{ contact_id: '', name: '', status: 'error', error: 'Network error' }] });
    } finally {
      setSyncing(false);
    }
  };

  const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none';
  const TH_STATIC = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
  const TD = 'py-3 pr-4';
  const emailCount = contacts.filter(c => c.email).length;
  const ghlCount = contacts.filter(c => c.ghl_contact_id).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search contacts or tags..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-sm text-sm w-64 focus:outline-none focus:border-bauhaus-black"
        />

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white focus:outline-none focus:border-bauhaus-black"
        >
          <option value="all">All types</option>
          {contactTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Link status filter */}
        <select
          value={linkFilter}
          onChange={e => setLinkFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white focus:outline-none focus:border-bauhaus-black"
        >
          <option value="all">All statuses</option>
          <option value="linked">Linked to entity</option>
          <option value="person">Linked to person</option>
          <option value="email">Has email</option>
          <option value="ghl">In GHL ({ghlCount})</option>
          <option value="notion">Has Notion page</option>
        </select>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white focus:outline-none focus:border-bauhaus-black"
          >
            <option value="all">All tags</option>
            {allTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        <div className="flex-1" />

        {/* Sync to GHL */}
        <button
          onClick={handleSyncGHL}
          disabled={syncing || emailCount === 0}
          className="px-4 py-2 bg-bauhaus-black text-white font-black uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? 'Syncing...' : `Sync to GHL (${emailCount})`}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`border-2 p-4 rounded-sm text-sm ${
          syncResult.errors > 0
            ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
            : 'bg-green-50 border-green-400 text-green-800'
        }`}>
          <strong>{syncResult.synced} synced</strong>
          {syncResult.errors > 0 && <>, <strong className="text-red-600">{syncResult.errors} errors</strong></>}
          {syncResult.errors > 0 && (
            <ul className="mt-2 text-xs space-y-1">
              {syncResult.details.filter(d => d.status === 'error').map((d, i) => (
                <li key={i}>{d.name}: {d.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {contacts.length} contacts
      </p>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                <th className={`${TH} pl-4`} onClick={() => toggleSort('name')}>
                  Name{sortArrow('name')}
                </th>
                <th className={TH_STATIC}>Role</th>
                <th className={TH} onClick={() => toggleSort('organisation')}>
                  Organisation{sortArrow('organisation')}
                </th>
                <th className={TH} onClick={() => toggleSort('contact_type')}>
                  Type{sortArrow('contact_type')}
                </th>
                <th className={TH_STATIC}>Engagement</th>
                <th className={TH_STATIC}>Tags</th>
                <th className={TH_STATIC}>Status</th>
                <th className={TH_STATIC}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className={`${TD} pl-4 font-medium`}>
                    <div className="flex items-center gap-2">
                      {c.linked_entity_gs_id ? (
                        <Link
                          href={`/entity/${encodeURIComponent(c.linked_entity_gs_id)}`}
                          className="text-bauhaus-blue hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        <span>{c.name}</span>
                      )}
                    </div>
                  </td>
                  <td className={`${TD} text-gray-500 text-xs`}>{c.role}</td>
                  <td className={`${TD} text-gray-500 text-xs`}>
                    {c.organisation && c.organisation !== c.name ? (
                      c.linked_entity_gs_id ? (
                        <Link
                          href={`/entity/${encodeURIComponent(c.linked_entity_gs_id)}`}
                          className="text-bauhaus-blue hover:underline"
                        >
                          {c.organisation}
                        </Link>
                      ) : (
                        c.organisation
                      )
                    ) : '\u2014'}
                  </td>
                  <td className={TD}>
                    <ContactTypeBadge type={c.contact_type} />
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col gap-1">
                      <EngagementBadge status={c.ghl_engagement_status} />
                      {c.ghl_last_contact_date && (
                        <span className="text-[10px] text-gray-400">
                          {formatDate(c.ghl_last_contact_date)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(c.unified_tags ?? []).slice(0, 5).map(t => (
                        <TagChip
                          key={t}
                          tag={t}
                          onClick={() => setTagFilter(t)}
                        />
                      ))}
                      {(c.unified_tags ?? []).length > 5 && (
                        <span className="text-[9px] text-gray-400">
                          +{c.unified_tags.length - 5}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-1.5">
                      {c.person_id && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" title="Linked to person record" />
                      )}
                      {c.linked_entity_gs_id && (
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" title="Linked to CivicGraph entity" />
                      )}
                      {c.ghl_contact_id && (
                        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" title="In GHL CRM" />
                      )}
                      {c.notion_id && (
                        <span className="w-2 h-2 rounded-full bg-gray-800 inline-block" title="Has Notion page" />
                      )}
                      {c.email && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Has email" />
                      )}
                      {!c.person_id && !c.linked_entity_gs_id && !c.email && (
                        <span className="text-[10px] text-gray-300">{'\u2014'}</span>
                      )}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-1.5">
                      {c.notion_id && (
                        <a
                          href={`https://notion.so/${c.notion_id.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-white rounded-sm hover:bg-gray-700 transition-colors"
                        >
                          Notion
                        </a>
                      )}
                      {c.linkedin_url && (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#0077B5] text-white rounded-sm hover:bg-[#005885] transition-colors"
                        >
                          LinkedIn
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-gray-300 text-gray-600 rounded-sm hover:bg-gray-50 transition-colors"
                        >
                          Email
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400 text-sm">
                    No contacts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          Person
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          CivicGraph Entity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          GHL CRM
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-800 inline-block" />
          Notion
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Email
        </span>
      </div>
    </div>
  );
}
