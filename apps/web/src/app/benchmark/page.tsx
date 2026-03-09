'use client';

import { useEffect, useState } from 'react';

interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  matchRate: number;
}

interface Counts {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  totalPairs: number;
}

interface FailureExample {
  donor_name: string;
  expected_abn?: string;
  expected_name?: string;
  expected?: string;
  got_abn?: string;
  got_name?: string;
  confidence?: number;
  method?: string;
  difficulty?: string;
}

interface AutoresearchEntry {
  iteration: number;
  timestamp: string;
  status: string;
  description: string;
  f1: number;
  precision?: number;
  recall?: number;
  delta?: number;
}

interface BenchmarkData {
  task: string;
  latest: { timestamp: string; metrics: Metrics; counts: Counts };
  failures: { falsePositives: FailureExample[]; falseNegatives: FailureExample[] };
  autoresearch?: AutoresearchEntry[];
}

function pct(v: number) { return (v * 100).toFixed(1) + '%'; }

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`border-4 border-bauhaus-black p-4 ${color}`}>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black/60">{label}</div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pctVal = max === 0 ? 0 : (value / max) * 100;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs font-bold mb-1">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="w-full bg-gray-200 h-3 border border-bauhaus-black">
        <div className="bg-bauhaus-blue h-full transition-all" style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'failures' | 'autoresearch'>('overview');

  useEffect(() => {
    fetch('/api/benchmark/results?task=entity-resolution&history=1')
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(setData)
      .catch(e => setError(e.error || 'Failed to load benchmark data'));
  }, []);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <h1 className="text-2xl font-black uppercase mb-4">Benchmark Dashboard</h1>
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow/20">
          <p className="font-bold">No benchmark data yet</p>
          <code className="block mt-2 text-sm bg-black text-white p-3">
            node scripts/benchmark/create-ground-truth.mjs<br />
            node scripts/benchmark/evaluate.mjs --save
          </code>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto mt-8">
        <h1 className="text-2xl font-black uppercase mb-4">Benchmark Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  const { metrics, counts } = data.latest;
  const positives = counts.truePositives + counts.falseNegatives;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black uppercase">Benchmark: {data.task}</h1>
          <p className="text-sm text-gray-500">
            Last run: {new Date(data.latest.timestamp).toLocaleString()} | {counts.totalPairs} test pairs
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 mb-6">
        {(['overview', 'failures', 'autoresearch'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-black uppercase text-sm border-2 border-bauhaus-black ${
              tab === t ? 'bg-bauhaus-black text-white' : 'bg-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <MetricCard label="F1 Score" value={pct(metrics.f1)} color="bg-bauhaus-yellow" />
            <MetricCard label="Precision" value={pct(metrics.precision)} color="bg-bauhaus-blue/20" />
            <MetricCard label="Recall" value={pct(metrics.recall)} color="bg-bauhaus-blue/20" />
            <MetricCard label="Accuracy" value={pct(metrics.accuracy)} color="bg-white" />
            <MetricCard label="Match Rate" value={pct(metrics.matchRate)} color="bg-white" />
          </div>

          {/* Confusion matrix */}
          <div className="border-4 border-bauhaus-black p-6 mb-8">
            <h2 className="font-black uppercase text-lg mb-4">Confusion Matrix</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <ProgressBar value={counts.truePositives} max={positives} label="True Positives" />
              <ProgressBar value={counts.falsePositives} max={counts.truePositives + counts.falsePositives || 1} label="False Positives" />
              <ProgressBar value={counts.falseNegatives} max={positives} label="False Negatives" />
              <ProgressBar value={counts.trueNegatives} max={counts.trueNegatives + counts.falsePositives || 1} label="True Negatives" />
            </div>
          </div>
        </>
      )}

      {tab === 'failures' && (
        <div className="space-y-8">
          {/* False Positives */}
          <div className="border-4 border-bauhaus-black">
            <div className="bg-red-100 px-4 py-2 border-b-4 border-bauhaus-black">
              <h2 className="font-black uppercase">False Positives ({data.failures.falsePositives.length})</h2>
              <p className="text-xs text-gray-600">Resolver matched incorrectly</p>
            </div>
            <div className="divide-y divide-gray-200">
              {data.failures.falsePositives.map((f, i) => (
                <div key={i} className="px-4 py-3 text-sm">
                  <div className="font-bold">&ldquo;{f.donor_name}&rdquo;</div>
                  <div className="text-red-700">
                    Got: {f.got_name} ({f.got_abn}) [{f.method}, {f.confidence?.toFixed(2)}]
                  </div>
                  <div className="text-green-700">
                    Expected: {f.expected_name || f.expected}
                    {f.expected_abn && ` (${f.expected_abn})`}
                  </div>
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{f.difficulty}</span>
                </div>
              ))}
              {data.failures.falsePositives.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">None</div>
              )}
            </div>
          </div>

          {/* False Negatives */}
          <div className="border-4 border-bauhaus-black">
            <div className="bg-orange-100 px-4 py-2 border-b-4 border-bauhaus-black">
              <h2 className="font-black uppercase">False Negatives ({data.failures.falseNegatives.length})</h2>
              <p className="text-xs text-gray-600">Resolver missed these matches</p>
            </div>
            <div className="divide-y divide-gray-200">
              {data.failures.falseNegatives.map((f, i) => (
                <div key={i} className="px-4 py-3 text-sm">
                  <div className="font-bold">&ldquo;{f.donor_name}&rdquo;</div>
                  <div className="text-green-700">
                    Should match: {f.expected_name} ({f.expected_abn})
                  </div>
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{f.difficulty}</span>
                </div>
              ))}
              {data.failures.falseNegatives.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">None</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'autoresearch' && (
        <div className="border-4 border-bauhaus-black">
          <div className="bg-bauhaus-blue/20 px-4 py-2 border-b-4 border-bauhaus-black">
            <h2 className="font-black uppercase">Autoresearch History</h2>
            <p className="text-xs text-gray-600">AI-driven improvement iterations</p>
          </div>
          {data.autoresearch && data.autoresearch.length > 0 ? (
            <>
              {/* F1 sparkline (simple text chart) */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="text-xs font-bold uppercase mb-2">F1 Over Iterations</div>
                <div className="flex items-end gap-1 h-16">
                  {data.autoresearch.map((entry, i) => {
                    const height = Math.max(4, entry.f1 * 100);
                    return (
                      <div
                        key={i}
                        className={`w-4 ${entry.status === 'improved' ? 'bg-green-500' : entry.status === 'reverted' ? 'bg-red-300' : 'bg-gray-300'}`}
                        style={{ height: `${height}%` }}
                        title={`#${entry.iteration}: F1=${pct(entry.f1)} (${entry.status})`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Log entries */}
              <div className="divide-y divide-gray-200">
                {data.autoresearch.slice().reverse().map((entry, i) => (
                  <div key={i} className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        entry.status === 'improved' ? 'bg-green-500' :
                        entry.status === 'reverted' ? 'bg-red-400' : 'bg-gray-400'
                      }`} />
                      <span className="font-bold">#{entry.iteration}</span>
                      <span className={`text-xs font-bold uppercase ${
                        entry.status === 'improved' ? 'text-green-700' :
                        entry.status === 'reverted' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {entry.status}
                      </span>
                      {entry.delta !== undefined && (
                        <span className="text-xs">
                          ({entry.delta > 0 ? '+' : ''}{(entry.delta * 100).toFixed(1)}%)
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        F1={pct(entry.f1)}
                      </span>
                    </div>
                    <div className="text-gray-600 mt-1 ml-4">{entry.description}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <p className="mb-2">No autoresearch runs yet.</p>
              <code className="text-sm bg-black text-white p-2 inline-block">
                node scripts/benchmark/autoresearch.mjs --task entity-resolution --budget 10
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
