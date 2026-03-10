'use client';

import { useState, useEffect, useCallback } from 'react';

interface Source {
  id: string;
  source_name: string;
  source_type: string;
  source_url: string | null;
  created_at: string;
  status: string;
  chunk_count: number;
}

const TYPE_ICONS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOC',
  markdown: 'MD',
  text: 'TXT',
  url: 'URL',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-600',
};

export function DocumentList() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/ingest');
      const data = await res.json();
      if (data.sources) setSources(data.sources);
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();

    // Listen for refresh events from upload form
    const handler = () => fetchSources();
    window.addEventListener('knowledge-refresh', handler);
    return () => window.removeEventListener('knowledge-refresh', handler);
  }, [fetchSources]);

  // Poll for status updates if any items are processing/pending
  useEffect(() => {
    const hasPending = sources.some(s => s.status === 'pending' || s.status === 'processing');
    if (!hasPending) return;

    const interval = setInterval(fetchSources, 5000);
    return () => clearInterval(interval);
  }, [sources, fetchSources]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its extracted knowledge?')) return;
    setDeleting(id);
    try {
      await fetch(`/api/knowledge/ingest?id=${id}`, { method: 'DELETE' });
      setSources(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleProcess() {
    try {
      const res = await fetch('/api/knowledge/process', { method: 'POST' });
      const data = await res.json();
      if (data.processed) {
        fetchSources();
      }
    } catch (err) {
      console.error('Process failed:', err);
    }
  }

  if (loading) {
    return (
      <div className="border-4 border-bauhaus-black p-6">
        <p className="text-sm text-bauhaus-muted font-medium">Loading documents...</p>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="border-4 border-bauhaus-black/20 border-dashed p-8 text-center">
        <p className="text-sm text-bauhaus-muted font-bold">No documents yet</p>
        <p className="text-xs text-bauhaus-muted mt-1">Upload a PDF, DOCX, or import a URL to get started</p>
      </div>
    );
  }

  const hasPending = sources.some(s => s.status === 'pending');

  return (
    <div className="border-4 border-bauhaus-black">
      {hasPending && (
        <div className="px-4 py-2 bg-yellow-50 border-b-2 border-bauhaus-black/20 flex items-center justify-between">
          <span className="text-xs font-bold text-yellow-800">
            {sources.filter(s => s.status === 'pending').length} document(s) pending processing
          </span>
          <button
            onClick={handleProcess}
            className="px-3 py-1 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-blue transition-colors"
          >
            Process Now
          </button>
        </div>
      )}

      <div className="divide-y-2 divide-bauhaus-black/10">
        {sources.map((source) => (
          <div key={source.id} className="px-4 py-3 flex items-center gap-4 hover:bg-bauhaus-canvas/50 transition-colors">
            <span className="w-10 h-10 flex items-center justify-center bg-bauhaus-black/5 text-[10px] font-black text-bauhaus-black tracking-wider shrink-0">
              {TYPE_ICONS[source.source_type] || '???'}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-bauhaus-black truncate">
                {source.source_name}
              </p>
              <p className="text-xs text-bauhaus-muted">
                {new Date(source.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                {source.chunk_count > 0 && ` · ${source.chunk_count} chunks`}
              </p>
            </div>

            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[source.status] || STATUS_STYLES.unknown}`}>
              {source.status}
            </span>

            <button
              onClick={() => handleDelete(source.id)}
              disabled={deleting === source.id}
              className="text-bauhaus-muted hover:text-bauhaus-red transition-colors p-1 shrink-0"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
