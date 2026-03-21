'use client';

import { useState, useCallback } from 'react';

const PRESETS = [
  { label: 'Search: Commonwealth Bank', body: { action: 'search', query: 'Commonwealth Bank' } },
  { label: 'Power Index: Top 5 (3+ systems)', body: { action: 'power_index', limit: 5, min_systems: 3 } },
  { label: 'Funding Deserts: NT', body: { action: 'funding_deserts', state: 'NT', limit: 5 } },
  { label: 'Revolving Door: Top 5', body: { action: 'revolving_door', limit: 5 } },
  { label: 'Ask: QLD youth justice spend', body: { action: 'ask', query: 'How much does QLD spend on youth justice?' } },
];

export function AgentPlayground() {
  const [input, setInput] = useState(JSON.stringify(PRESETS[0].body, null, 2));
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);

  const handleSubmit = useCallback(async (bodyOverride?: string) => {
    const bodyStr = bodyOverride || input;
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyStr);
    } catch {
      setError('Invalid JSON');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setElapsed(null);

    const start = Date.now();
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setElapsed(Date.now() - start);
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        setResult(JSON.stringify(data, null, 2));
      } else {
        setResult(JSON.stringify(data, null, 2));
      }
    } catch {
      setElapsed(Date.now() - start);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handlePreset = useCallback((body: object) => {
    const str = JSON.stringify(body, null, 2);
    setInput(str);
    handleSubmit(str);
  }, [handleSubmit]);

  return (
    <section className="mb-12">
      <h2 className="text-xl font-black text-bauhaus-black mb-4">Try It Now</h2>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.body)}
            disabled={loading}
            className="text-xs font-bold px-3 py-1.5 border-2 border-bauhaus-black/15 hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input + submit */}
      <div className="border-4 border-bauhaus-black">
        <div className="flex items-center justify-between px-4 py-2 bg-bauhaus-black text-white">
          <span className="text-[10px] font-black uppercase tracking-widest">POST /api/agent</span>
          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-1 bg-bauhaus-red text-white border-2 border-white/20 hover:bg-white hover:text-bauhaus-black transition-colors disabled:opacity-40"
          >
            {loading ? 'Running\u2026' : 'Send'}
          </button>
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 font-mono text-sm text-bauhaus-black bg-bauhaus-canvas outline-none resize-y"
          spellCheck={false}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 border-4 border-bauhaus-red p-3 bg-bauhaus-red/5">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-3 border-4 border-bauhaus-black">
          <div className="flex items-center justify-between px-4 py-2 bg-bauhaus-canvas border-b-2 border-bauhaus-black/10">
            <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Response</span>
            {elapsed !== null && (
              <span className="text-[10px] font-bold text-bauhaus-muted">{elapsed}ms</span>
            )}
          </div>
          <pre className="px-4 py-3 font-mono text-xs text-bauhaus-black overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}
    </section>
  );
}
