'use client';

import { useState } from 'react';

const EXAMPLES = [
  'Which community-controlled orgs in remote QLD receive both justice funding and NDIS contracts?',
  'Show me the top 10 entities by power score that are also political donors',
  'What are the worst funding deserts in Australia by desert score?',
  'How much does Australia spend on youth detention vs community diversion programs?',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResultData = { question: string; generated_sql: string; results: Record<string, any>[]; count: number; explanation: string };

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '\u2014';
  if (typeof v === 'number') return v.toLocaleString('en-AU');
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export function AskClient() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');
  const [showSql, setShowSql] = useState(false);

  async function handleSubmit(q?: string) {
    const queryText = q || question;
    if (!queryText.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setShowSql(false);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (data.generated_sql) setResult(data);
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  const columns = result?.results?.[0] ? Object.keys(result.results[0]) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Decision Tools</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">Ask CivicGraph</h1>
        <p className="text-bauhaus-muted text-base max-w-2xl font-medium leading-relaxed">
          Ask questions in plain English. CivicGraph translates your question into a cross-system
          database query spanning contracts, grants, donations, charities, and evidence data.
        </p>
      </div>

      {/* Input */}
      <div className="border-4 border-bauhaus-black mb-6">
        <div className="flex">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. How much does Queensland spend on youth justice vs community programs?"
            className="flex-1 px-4 py-4 text-base font-medium text-bauhaus-black placeholder:text-bauhaus-muted/50 outline-none"
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !question.trim()}
            className="px-6 py-4 bg-bauhaus-black text-white font-black uppercase tracking-widest text-xs hover:bg-bauhaus-red transition-colors disabled:opacity-40"
          >
            {loading ? 'Querying\u2026' : 'Ask'}
          </button>
        </div>
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-1">Try:</span>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setQuestion(ex); handleSubmit(ex); }}
            className="px-3 py-1.5 text-xs font-bold text-bauhaus-black border-2 border-bauhaus-black/20 hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
            disabled={loading}
          >
            {ex.length > 65 ? ex.slice(0, 62) + '\u2026' : ex}
          </button>
        ))}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="border-4 border-bauhaus-black/20 p-8 mb-6 flex items-center gap-4">
          <div className="w-4 h-4 bg-bauhaus-red animate-pulse" />
          <span className="text-sm font-bold text-bauhaus-muted">Generating SQL, querying database, analysing results&hellip;</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-4 border-bauhaus-red p-4 mb-6 bg-bauhaus-red/5">
          <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-1">Error</div>
          <p className="text-bauhaus-black font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && result.results && (
        <div>
          {/* Explanation */}
          {result.explanation && (
            <div className="border-4 border-bauhaus-blue p-6 mb-6 bg-bauhaus-blue/5">
              <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-2">Analysis</div>
              <p className="text-bauhaus-black font-medium text-base leading-relaxed">{result.explanation}</p>
            </div>
          )}

          {/* Stats bar */}
          <div className="flex gap-6 mb-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
            <span>{result.count} rows returned</span>
            <button onClick={() => setShowSql(!showSql)} className="text-bauhaus-blue hover:underline">
              {showSql ? 'Hide SQL' : 'Show SQL'}
            </button>
          </div>

          {/* SQL */}
          {showSql && result.generated_sql && (
            <div className="border-4 border-bauhaus-black/20 p-4 mb-6 bg-bauhaus-canvas">
              <pre className="text-xs font-mono text-bauhaus-black overflow-x-auto whitespace-pre-wrap">{result.generated_sql}</pre>
            </div>
          )}

          {/* Table */}
          {columns.length > 0 && (
            <div className="border-4 border-bauhaus-black overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    {columns.map(col => (
                      <th key={col} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                      {columns.map(col => (
                        <td key={col} className="px-3 py-2 font-medium text-bauhaus-black border-t border-bauhaus-black/10 whitespace-nowrap">
                          {formatValue(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
