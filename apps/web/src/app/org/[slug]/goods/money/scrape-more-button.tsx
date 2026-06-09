'use client';

import { useState } from 'react';

/**
 * Queues the Goods-scoped discovery agent via the Mission Control tasks API
 * (/api/mission-control/tasks, admin-guarded by requireAdminApi). The orchestrator
 * picks the task up and the new opportunities flow into alma_funding_opportunities,
 * which this page reads. 409 means a run is already pending/in-flight.
 */
export function ScrapeMoreButton({ agentId, label }: { agentId: string; label: string }) {
  const [state, setState] = useState<'idle' | 'queuing' | 'queued' | 'running' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');

  async function queue() {
    setState('queuing');
    setMsg('');
    try {
      const res = await fetch('/api/mission-control/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      if (res.status === 201) {
        setState('queued');
        setMsg(`Queued. New ${label} opportunities will appear after the run.`);
        return;
      }
      if (res.status === 409) {
        setState('running');
        setMsg('Already running — a discovery sweep is in flight.');
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setState('error');
        setMsg('Sign in as an admin to queue a scrape.');
        return;
      }
      const body = await res.json().catch(() => null);
      setState('error');
      setMsg(body?.error ?? `Failed (${res.status}).`);
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Network error.');
    }
  }

  const done = state === 'queued' || state === 'running';

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={queue}
        disabled={state === 'queuing' || done}
        className="border-4 border-bauhaus-black bg-bauhaus-yellow px-4 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black transition hover:bg-bauhaus-black hover:text-bauhaus-yellow disabled:opacity-50"
      >
        {state === 'queuing' ? 'Queuing…' : done ? 'Queued ✓' : 'Scrape more →'}
      </button>
      {msg && (
        <span
          className={`text-[11px] font-bold ${state === 'error' ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
