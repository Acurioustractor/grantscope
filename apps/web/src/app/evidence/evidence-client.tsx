'use client';

import { useState, useRef } from 'react';

const TOPICS = [
  { value: 'youth-justice', label: 'Youth Justice' },
  { value: 'child-protection', label: 'Child Protection' },
  { value: 'indigenous', label: 'Indigenous Justice' },
  { value: 'diversion', label: 'Diversion Programs' },
  { value: 'prevention', label: 'Prevention' },
  { value: 'family-services', label: 'Family Services' },
  { value: 'ndis', label: 'NDIS / Disability' },
  { value: 'legal-services', label: 'Legal Services' },
];

const STATES = ['All', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

type Stats = { interventions: number; evidence: number; outcomes: number };

export function EvidenceClient() {
  const [topic, setTopic] = useState('youth-justice');
  const [state, setState] = useState('All');
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit() {
    if (loading) {
      abortRef.current?.abort();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setText('');
    setStats(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, state: state === 'All' ? undefined : state }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Read stats from response header
      const statsHeader = res.headers.get('x-evidence-stats');
      if (statsHeader) {
        try { setStats(JSON.parse(statsHeader)); } catch { /* ignore */ }
      }

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError('Network error \u2014 please try again');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Decision Tools</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">Evidence Synthesis</h1>
        <p className="text-bauhaus-muted text-base max-w-2xl font-medium leading-relaxed">
          Synthesis of the Australian Living Map of Alternatives (ALMA) evidence database.
          Select a topic to get an analyst-grade summary of what works, evidence gaps, and funding alignment.
        </p>
      </div>

      {/* Controls */}
      <div className="border-4 border-bauhaus-black p-6 mb-8">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Topic</label>
            <select
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-bauhaus-black text-sm font-bold text-bauhaus-black bg-white"
              disabled={loading}
            >
              {TOPICS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-32">
            <label className="block text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">State</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-bauhaus-black text-sm font-bold text-bauhaus-black bg-white"
              disabled={loading}
            >
              {STATES.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-bauhaus-black text-white font-black uppercase tracking-widest text-xs hover:bg-bauhaus-red transition-colors"
          >
            {loading ? 'Stop' : 'Synthesise'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-0 mb-6">
          <div className="border-4 border-bauhaus-black p-4 bg-bauhaus-black text-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-yellow-300 mb-1">Interventions</div>
            <div className="text-2xl font-black">{stats.interventions.toLocaleString()}</div>
          </div>
          <div className="border-4 border-l-0 border-bauhaus-black p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Evidence Records</div>
            <div className="text-2xl font-black text-bauhaus-black">{stats.evidence.toLocaleString()}</div>
          </div>
          <div className="border-4 border-l-0 border-bauhaus-black p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Outcomes Measured</div>
            <div className="text-2xl font-black text-bauhaus-black">{stats.outcomes.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-4 border-bauhaus-red p-4 mb-6 bg-bauhaus-red/5">
          <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-1">Error</div>
          <p className="text-bauhaus-black font-medium">{error}</p>
        </div>
      )}

      {/* Streaming output */}
      {text && (
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <SimpleMarkdown text={text} />
          {loading && <span className="inline-block w-2 h-4 bg-bauhaus-red animate-pulse ml-1" />}
        </div>
      )}
    </div>
  );
}

/* Lightweight markdown renderer for streaming text */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-black text-bauhaus-black uppercase tracking-wider mt-6 mb-3 first:mt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-black text-bauhaus-black mt-4 mb-2">{line.slice(4)}</h3>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 mb-1.5">
          <span className="text-bauhaus-red font-black mt-0.5 shrink-0">&#9632;</span>
          <span className="text-bauhaus-black font-medium leading-relaxed">
            <BoldText text={line.slice(2)} />
          </span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^\d+/)![0];
      const content = line.replace(/^\d+\.\s*/, '');
      elements.push(
        <div key={i} className="flex gap-2 ml-2 mb-1.5">
          <span className="text-bauhaus-muted font-black shrink-0">{num}.</span>
          <span className="text-bauhaus-black font-medium leading-relaxed">
            <BoldText text={content} />
          </span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-bauhaus-black font-medium leading-relaxed mb-2">
          <BoldText text={line} />
        </p>
      );
    }
  });

  return <>{elements}</>;
}

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-black">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
