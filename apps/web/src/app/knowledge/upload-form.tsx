'use client';

import { useState, useRef } from 'react';

export function UploadForm() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/knowledge/ingest', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessage({ text: `"${file.name}" queued for processing`, type: 'success' });
      if (fileRef.current) fileRef.current.value = '';
      // Trigger refresh of document list
      window.dispatchEvent(new CustomEvent('knowledge-refresh'));
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('url', url.trim());

    try {
      const res = await fetch('/api/knowledge/ingest', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessage({ text: 'URL queued for processing', type: 'success' });
      setUrl('');
      window.dispatchEvent(new CustomEvent('knowledge-refresh'));
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-4 border-bauhaus-black p-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setUrlMode(false)}
          className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
            !urlMode ? 'bg-bauhaus-black text-white' : 'text-bauhaus-black hover:bg-bauhaus-black/10'
          }`}
        >
          File Upload
        </button>
        <button
          onClick={() => setUrlMode(true)}
          className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
            urlMode ? 'bg-bauhaus-black text-white' : 'text-bauhaus-black hover:bg-bauhaus-black/10'
          }`}
        >
          URL
        </button>
      </div>

      {urlMode ? (
        <form onSubmit={handleUrlSubmit} className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/annual-report"
            className="flex-1 px-3 py-2 border-2 border-bauhaus-black text-sm font-medium focus:outline-none focus:ring-2 focus:ring-bauhaus-blue"
            disabled={uploading}
          />
          <button
            type="submit"
            disabled={uploading || !url.trim()}
            className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50"
          >
            {uploading ? 'Importing...' : 'Import'}
          </button>
        </form>
      ) : (
        <div
          className="border-2 border-dashed border-bauhaus-black/30 p-8 text-center cursor-pointer hover:border-bauhaus-blue hover:bg-bauhaus-blue/5 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload(file);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.md,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          {uploading ? (
            <p className="text-sm font-bold text-bauhaus-muted">Uploading...</p>
          ) : (
            <>
              <p className="text-sm font-bold text-bauhaus-black">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-bauhaus-muted mt-1">
                PDF, DOCX, Markdown, or plain text (max 10MB)
              </p>
            </>
          )}
        </div>
      )}

      {message && (
        <div className={`mt-3 px-3 py-2 text-xs font-bold ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border-l-4 border-green-500'
            : 'bg-red-50 text-red-800 border-l-4 border-bauhaus-red'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
