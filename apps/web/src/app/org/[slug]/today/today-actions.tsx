'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Decision = 'pursuing' | 'watching' | 'passed';

interface GrantActionsProps {
  projectCode: string;
  opportunityId: string;
  funderName: string | null;
  opportunityName: string;
}

export function TodayGrantActions({ projectCode, opportunityId, funderName, opportunityName }: GrantActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Decision) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ops/grant-recommendations/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_code: projectCode,
            opportunity_id: opportunityId,
            decision,
            notes: `[via today surface · ${new Date().toISOString().slice(0, 10)}]`,
          }),
        });
        if (!res.ok) throw new Error((await res.text()).slice(0, 200));
        setDone(decision);
        // Refresh server data so the row disappears from urgent list
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Decision failed');
      }
    });
  }

  if (done) {
    return (
      <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-green-600 text-white">
        {done} ✓
      </span>
    );
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => decide('passed')}
        disabled={isPending}
        className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black px-2 py-1 hover:bg-bauhaus-black hover:text-white disabled:opacity-40"
        title={`Pass on ${opportunityName}`}
      >
        Pass
      </button>
      <button
        type="button"
        onClick={() => decide('watching')}
        disabled={isPending}
        className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black px-2 py-1 hover:bg-bauhaus-black hover:text-bauhaus-yellow disabled:opacity-40"
        title={`Watch ${opportunityName}`}
      >
        Watch
      </button>
      <button
        type="button"
        onClick={() => decide('pursuing')}
        disabled={isPending}
        className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-red text-white px-2 py-1 hover:bg-bauhaus-black disabled:opacity-40"
        title={`Pursue ${opportunityName}`}
      >
        Pursue
      </button>
      {error && (
        <span className="text-[10px] font-mono text-bauhaus-red" title={error}>
          err
        </span>
      )}
    </div>
  );
}

interface NudgeProps {
  funderName: string;
  projectCodes: string[];
}

export function TodayFoundationNudge({ funderName, projectCodes }: NudgeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildMailto(): string {
    const subject = encodeURIComponent(`Catching up — A Curious Tractor`);
    const body = encodeURIComponent(
      `Hi ${funderName.split(' ')[0]} team,\n\n` +
      `Wanted to share a quick update from the ACT side${projectCodes.length > 0 ? ` (we're moving on ${projectCodes.join(', ')})` : ''}.\n\n` +
      `Quick line if there's a good time for a chat over the next fortnight?\n\n` +
      `— Ben\n`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  async function nudge() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/foundations/nudge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funder_name: funderName,
            project_code: projectCodes[0] ?? null,
            nudge_type: 'email',
            subject: 'Catching up — A Curious Tractor',
          }),
        });
        if (!res.ok) throw new Error((await res.text()).slice(0, 200));
        setLogged(true);
        // Open the mailto in a new window — user composes the email manually
        window.open(buildMailto(), '_blank');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nudge failed');
      }
    });
  }

  if (logged) {
    return (
      <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-green-600 text-white">
        nudged ✓
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={nudge}
      disabled={isPending}
      className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black px-2 py-1 hover:bg-bauhaus-black hover:text-bauhaus-yellow disabled:opacity-40"
      title={`Log nudge + open email draft for ${funderName}`}
    >
      {error ? 'err — retry' : 'Nudge ✉'}
    </button>
  );
}

interface AddBuyerProps {
  buyerName: string;
  projects: Array<{ project_code: string; project_label: string }>;
}

export function TodayBuyerAdd({ buyerName, projects }: AddBuyerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(projects[0]?.project_code ?? 'ACT-CS');
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/procurement/add-to-pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyer_name: buyerName,
            project_code: selectedProject,
            recommended_role: 'lead',
            pathway: 'procurement',
            notes: `Added from Today digest. Buyer has hot procurement history (3+ relevant contracts last 6mo).`,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; created?: boolean; message?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setAdded(true);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Add failed');
      }
    });
  }

  if (added) {
    return (
      <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-green-600 text-white">
        added ✓
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black px-2 py-1 hover:bg-bauhaus-black hover:text-white"
        title={`Add ${buyerName} to procurement pipeline`}
      >
        + Pipeline
      </button>
    );
  }

  return (
    <div className="flex gap-1 items-center">
      <select
        value={selectedProject}
        onChange={(e) => setSelectedProject(e.target.value)}
        className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white px-1 py-1"
        disabled={isPending}
      >
        {projects.map((p) => (
          <option key={p.project_code} value={p.project_code}>
            {p.project_code}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={isPending}
        className="text-[9px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-red text-white px-2 py-1 hover:bg-bauhaus-black disabled:opacity-40"
      >
        {isPending ? '...' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={isPending}
        className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
      >
        ×
      </button>
      {error && (
        <span className="text-[9px] font-mono text-bauhaus-red" title={error}>
          err
        </span>
      )}
    </div>
  );
}
