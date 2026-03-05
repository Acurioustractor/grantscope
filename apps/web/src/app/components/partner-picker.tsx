'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  tags?: string[] | null;
}

interface GrantInfo {
  name: string;
  amount: string;
  closes: string;
  description: string;
  url: string;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

function contactName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Unknown';
}

function isCorePartner(c: Contact): boolean {
  return c.tags?.includes('core-partner') ?? false;
}

export function PartnerPicker({ grantId, grant }: { grantId: string; grant: GrantInfo }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [partners, setPartners] = useState<Contact[]>([]);
  const [corePartners, setCorePartners] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendStatuses, setSendStatuses] = useState<Record<string, SendStatus>>({});
  const [sendAllStatus, setSendAllStatus] = useState<SendStatus>('idle');
  const [taggingIds, setTaggingIds] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) return;
      // Load existing partner_contact_ids + core partners in parallel
      Promise.all([
        fetch('/api/tracker')
          .then((r) => (r.ok ? r.json() : []))
          .then((all: Array<{ grant_id: string; partner_contact_ids: string[] | null }>) => {
            const match = all.find((s) => s.grant_id === grantId);
            if (match?.partner_contact_ids?.length) {
              return loadPartnerDetails(match.partner_contact_ids);
            }
          })
          .catch(() => {}),
        fetch('/api/contacts/search?tag=core-partner')
          .then((r) => (r.ok ? r.json() : []))
          .then((data: Contact[]) => {
            if (Array.isArray(data)) setCorePartners(data);
          })
          .catch(() => {}),
      ]).finally(() => setLoaded(true));
    });
  }, [grantId]);

  const loadPartnerDetails = useCallback(async (ids: string[]) => {
    try {
      const res = await fetch('/api/contacts/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (Array.isArray(data)) setPartners(data);
    } catch { /* skip */ }
  }, []);

  const savePartners = useCallback(
    async (contactIds: string[]) => {
      await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_contact_ids: contactIds }),
      }).catch(() => {});
    },
    [grantId]
  );

  const searchContacts = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Contact[]) => setResults(data))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => searchContacts(q), 300);
    },
    [searchContacts]
  );

  const addPartner = useCallback(
    (contact: Contact) => {
      if (partners.some((p) => p.id === contact.id)) return;
      const next = [...partners, contact];
      setPartners(next);
      savePartners(next.map((p) => p.id));
      setQuery('');
      setResults([]);
    },
    [partners, savePartners]
  );

  const removePartner = useCallback(
    (contactId: string) => {
      const next = partners.filter((p) => p.id !== contactId);
      setPartners(next);
      savePartners(next.map((p) => p.id));
    },
    [partners, savePartners]
  );

  const toggleCorePartner = useCallback(
    async (contact: Contact) => {
      const isCore = isCorePartner(contact);
      setTaggingIds((prev) => new Set(prev).add(contact.id));
      try {
        const res = await fetch('/api/contacts/tag', {
          method: isCore ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: contact.id, tag: 'core-partner' }),
        });
        if (res.ok) {
          const updatedTags = isCore
            ? (contact.tags || []).filter((t) => t !== 'core-partner')
            : [...(contact.tags || []), 'core-partner'];
          const updatedContact = { ...contact, tags: updatedTags };

          // Update in all lists
          setPartners((prev) => prev.map((p) => (p.id === contact.id ? updatedContact : p)));
          setResults((prev) => prev.map((r) => (r.id === contact.id ? updatedContact : r)));
          if (isCore) {
            setCorePartners((prev) => prev.filter((c) => c.id !== contact.id));
          } else {
            setCorePartners((prev) => {
              if (prev.some((c) => c.id === contact.id)) return prev.map((c) => (c.id === contact.id ? updatedContact : c));
              return [...prev, updatedContact];
            });
          }
        }
      } catch { /* skip */ }
      setTaggingIds((prev) => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
    },
    []
  );

  const sendToContact = useCallback(
    async (contactId: string) => {
      setSendStatuses((prev) => ({ ...prev, [contactId]: 'sending' }));
      try {
        const res = await fetch('/api/grants/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grantId, contactIds: [contactId] }),
        });
        const data = await res.json();
        setSendStatuses((prev) => ({
          ...prev,
          [contactId]: data.sent?.includes(contactId) ? 'sent' : 'error',
        }));
      } catch {
        setSendStatuses((prev) => ({ ...prev, [contactId]: 'error' }));
      }
    },
    [grantId]
  );

  const sendToAll = useCallback(async () => {
    const ids = partners.filter((p) => p.email).map((p) => p.id);
    if (ids.length === 0) return;
    setSendAllStatus('sending');
    try {
      const res = await fetch('/api/grants/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId, contactIds: ids }),
      });
      const data = await res.json();
      // Update individual statuses too
      const newStatuses: Record<string, SendStatus> = {};
      for (const id of ids) {
        newStatuses[id] = data.sent?.includes(id) ? 'sent' : 'error';
      }
      setSendStatuses((prev) => ({ ...prev, ...newStatuses }));
      setSendAllStatus(data.failed?.length > 0 ? 'error' : 'sent');
    } catch {
      setSendAllStatus('error');
    }
  }, [grantId, partners]);

  if (!loaded || !user) return null;

  const partnersWithEmail = partners.filter((p) => p.email);
  // Core partners not already tagged on this grant
  const availableCorePartners = corePartners.filter((cp) => !partners.some((p) => p.id === cp.id));

  const BookmarkIcon = ({ filled, loading }: { filled: boolean; loading: boolean }) => (
    <svg
      className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''} ${filled ? 'text-bauhaus-yellow' : 'text-bauhaus-muted/40 hover:text-bauhaus-yellow'}`}
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
    >
      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </svg>
  );

  const SendIcon = ({ status }: { status: SendStatus }) => {
    if (status === 'sending') return <span className="text-[10px] animate-pulse">...</span>;
    if (status === 'sent') return <span className="text-green-600 text-xs">&#10003;</span>;
    if (status === 'error') return <span className="text-bauhaus-red text-xs">&#10007;</span>;
    return (
      <svg className="w-3.5 h-3.5 text-bauhaus-blue hover:text-bauhaus-red" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
      </svg>
    );
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black flex items-center gap-1"
      >
        <span>{expanded ? '\u25BC' : '\u25B6'}</span>
        Tag Partners {partners.length > 0 && `(${partners.length})`}
      </button>

      {expanded && (
        <div className="mt-2">
          {/* Core Partners quick-add */}
          {availableCorePartners.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Core Partners</div>
              <div className="flex flex-wrap gap-1.5">
                {availableCorePartners.map((cp) => (
                  <button
                    key={cp.id}
                    onClick={() => addPartner(cp)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-bauhaus-yellow/10 border-2 border-bauhaus-yellow/40 text-sm font-bold text-bauhaus-black hover:border-bauhaus-yellow hover:bg-bauhaus-yellow/20"
                  >
                    <svg className="w-3 h-3 text-bauhaus-yellow" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                    </svg>
                    {contactName(cp)}
                    {cp.company_name && (
                      <span className="text-bauhaus-muted text-xs font-medium">({cp.company_name})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tagged partners */}
          {partners.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {partners.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-bauhaus-canvas border-2 border-bauhaus-black/20 text-sm font-bold text-bauhaus-black"
                >
                  {contactName(p)}
                  {p.company_name && (
                    <span className="text-bauhaus-muted text-xs font-medium">({p.company_name})</span>
                  )}
                  <button
                    onClick={() => toggleCorePartner(p)}
                    title={isCorePartner(p) ? 'Remove from core partners' : 'Mark as core partner'}
                    className="ml-0.5"
                  >
                    <BookmarkIcon filled={isCorePartner(p)} loading={taggingIds.has(p.id)} />
                  </button>
                  {p.email && (
                    <button
                      onClick={() => sendToContact(p.id)}
                      disabled={sendStatuses[p.id] === 'sending' || sendStatuses[p.id] === 'sent'}
                      title={`Send grant to ${contactName(p)}`}
                      className="ml-0.5"
                    >
                      <SendIcon status={sendStatuses[p.id] || 'idle'} />
                    </button>
                  )}
                  <button
                    onClick={() => removePartner(p.id)}
                    className="text-bauhaus-muted hover:text-bauhaus-red ml-0.5"
                    title="Remove"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Send to All button */}
          {partnersWithEmail.length >= 2 && (
            <button
              onClick={sendToAll}
              disabled={sendAllStatus === 'sending' || sendAllStatus === 'sent'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 bg-bauhaus-blue text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black border-2 border-bauhaus-black disabled:opacity-50"
            >
              {sendAllStatus === 'sending' ? (
                <span className="animate-pulse">Sending...</span>
              ) : sendAllStatus === 'sent' ? (
                <>
                  <span className="text-green-300">&#10003;</span>
                  Sent ({partnersWithEmail.length})
                </>
              ) : sendAllStatus === 'error' ? (
                <>
                  <span className="text-red-300">&#10007;</span>
                  Retry Send All ({partnersWithEmail.length})
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Send to All ({partnersWithEmail.length})
                </>
              )}
            </button>
          )}

          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search contacts by name, email, or company..."
              className="w-full px-3 py-2 border-4 border-bauhaus-black/20 bg-white text-sm font-medium text-bauhaus-black focus:border-bauhaus-black focus:outline-none placeholder:text-bauhaus-muted/40"
            />
            {searching && (
              <span className="absolute right-3 top-2.5 text-[10px] font-bold text-bauhaus-muted animate-pulse">Searching...</span>
            )}

            {/* Results dropdown */}
            {results.length > 0 && (
              <div className="absolute z-20 w-full mt-0 bg-white border-4 border-t-0 border-bauhaus-black/20 max-h-48 overflow-y-auto">
                {results
                  .filter((r) => !partners.some((p) => p.id === r.id))
                  .map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-bauhaus-canvas border-b border-bauhaus-black/10 last:border-0"
                    >
                      <button
                        onClick={() => toggleCorePartner(contact)}
                        title={isCorePartner(contact) ? 'Remove from core partners' : 'Mark as core partner'}
                      >
                        <BookmarkIcon filled={isCorePartner(contact)} loading={taggingIds.has(contact.id)} />
                      </button>
                      <button
                        onClick={() => addPartner(contact)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-bold text-bauhaus-black">{contactName(contact)}</div>
                        <div className="text-xs text-bauhaus-muted font-medium">
                          {[contact.email, contact.company_name].filter(Boolean).join(' \u2022 ')}
                        </div>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
