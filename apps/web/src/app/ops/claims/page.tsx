'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Claim {
  id: string;
  abn: string;
  charity_name: string;
  contact_email: string;
  contact_name: string;
  status: string;
  message: string | null;
  organisation_name: string | null;
  admin_notes: string | null;
  created_at: string;
  verified_at: string | null;
  rejected_at: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-bauhaus-yellow text-bauhaus-black',
    verified: 'bg-green-600 text-white',
    rejected: 'bg-bauhaus-red text-white',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[status] ?? 'bg-gray-300 text-bauhaus-black'}`}>
      {status}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ClaimsAdminPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/ops/claims')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(d => { if (d && Array.isArray(d)) setClaims(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleAction(claimId: string, status: 'verified' | 'rejected') {
    setProcessing(true);
    const res = await fetch('/api/ops/claims', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, status, admin_notes: notes }),
    });

    if (res.ok) {
      const updated = await res.json();
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, ...updated, charity_name: c.charity_name } : c));
      setActionId(null);
      setNotes('');
    }
    setProcessing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading claims...</div>
      </div>
    );
  }

  const pending = claims.filter(c => c.status === 'pending');
  const resolved = claims.filter(c => c.status !== 'pending');

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">Charity Claims</h1>
        <div className="text-xs text-bauhaus-muted font-bold">
          {pending.length} pending
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
          <div className="text-sm text-bauhaus-muted font-medium">No claims yet.</div>
        </div>
      ) : (
        <div className="border-4 border-bauhaus-black overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Charity</th>
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">ABN</th>
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Claimant</th>
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">When</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...pending, ...resolved].map(claim => (
                <tr key={claim.id} className="border-t-2 border-bauhaus-black/10">
                  <td className="px-4 py-3 font-bold">
                    <a href={`/charities/${claim.abn}`} className="text-bauhaus-blue hover:text-bauhaus-red">
                      {claim.charity_name}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{claim.abn}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{claim.contact_name || '\u2014'}</div>
                    <div className="text-xs text-bauhaus-muted">{claim.contact_email}</div>
                    {claim.message && (
                      <div className="text-xs text-bauhaus-black/70 mt-1 italic max-w-[200px]">&ldquo;{claim.message}&rdquo;</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={claim.status} /></td>
                  <td className="px-4 py-3 text-right text-xs text-bauhaus-muted">{timeAgo(claim.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {claim.status === 'pending' && (
                      actionId === claim.id ? (
                        <div className="flex flex-col gap-2 items-end">
                          <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Admin notes (optional)"
                            rows={2}
                            className="w-48 border-2 border-bauhaus-black px-2 py-1 text-xs resize-none"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleAction(claim.id, 'verified')}
                              disabled={processing}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-black uppercase tracking-wider hover:bg-green-700 disabled:opacity-50"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleAction(claim.id, 'rejected')}
                              disabled={processing}
                              className="px-3 py-1 bg-bauhaus-red text-white text-xs font-black uppercase tracking-wider hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => { setActionId(null); setNotes(''); }}
                              className="px-3 py-1 bg-gray-200 text-bauhaus-black text-xs font-black uppercase tracking-wider hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActionId(claim.id)}
                          className="px-3 py-1 bg-bauhaus-black text-white text-xs font-black uppercase tracking-wider hover:bg-bauhaus-blue"
                        >
                          Review
                        </button>
                      )
                    )}
                    {claim.admin_notes && (
                      <div className="text-xs text-bauhaus-muted mt-1 text-right italic">{claim.admin_notes}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
