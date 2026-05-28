'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type DecisionKey = 'no' | 'later' | 'research' | 'apply';

type SavedGrant = {
  stage: string;
  notes: string | null;
};

const DECISIONS: Record<
  DecisionKey,
  {
    label: string;
    stage: string;
    reason: string;
    context: string;
    helper: string;
    className: string;
  }
> = {
  no: {
    label: 'No',
    stage: 'lost',
    reason: 'Not for us',
    context: 'grant_detail_no_button',
    helper: 'Hide this from active review and teach the matcher.',
    className: 'border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white',
  },
  later: {
    label: 'Later',
    stage: 'parked',
    reason: 'Parked for later',
    context: 'grant_detail_later_button',
    helper: 'Keep it out of today without saying it is bad.',
    className: 'border-bauhaus-black/30 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black',
  },
  research: {
    label: 'Research',
    stage: 'researching',
    reason: 'Worth research',
    context: 'grant_detail_research_button',
    helper: 'Make it a real evidence and eligibility task.',
    className: 'border-bauhaus-black bg-bauhaus-black text-white hover:bg-white hover:text-bauhaus-black',
  },
  apply: {
    label: 'Apply',
    stage: 'pursuing',
    reason: 'Apply path',
    context: 'grant_detail_apply_button',
    helper: 'Move it into active application work. This does not submit.',
    className: 'border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white',
  },
};

function stageLabel(stage: string | null | undefined) {
  if (!stage) return 'Not tracked yet';
  if (stage === 'lost') return 'No-go';
  if (stage === 'parked') return 'Later';
  return stage.replace(/_/g, ' ');
}

export function GrantDecisionPanel({
  grantId,
  grantName,
  provider,
  deadline,
  amount,
}: {
  grantId: string;
  grantName: string;
  provider: string;
  deadline: string;
  amount: string;
}) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [saved, setSaved] = useState<SavedGrant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<DecisionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowser();

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (!data.user) {
        setLoading(false);
        return;
      }

      fetch('/api/tracker')
        .then((response) => (response.ok ? response.json() : []))
        .then((all: Array<{ grant_id: string; stage: string; notes: string | null }>) => {
          if (!mounted) return;
          const match = all.find((item) => item.grant_id === grantId);
          if (match) setSaved({ stage: match.stage, notes: match.notes });
        })
        .catch(() => {})
        .finally(() => {
          if (mounted) setLoading(false);
        });
    });

    return () => {
      mounted = false;
    };
  }, [grantId]);

  const currentStage = saved?.stage ?? null;
  const currentDecision = useMemo(() => {
    if (currentStage === 'lost') return 'No';
    if (currentStage === 'parked') return 'Later';
    if (currentStage === 'researching') return 'Research';
    if (currentStage === 'pursuing') return 'Apply';
    return null;
  }, [currentStage]);

  const recordFeedback = useCallback(
    async (decision: DecisionKey) => {
      if (decision === 'later') return;
      const config = DECISIONS[decision];
      const vote = decision === 'no' ? -1 : 1;

      await fetch(`/api/grants/${grantId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote,
          reason: config.reason,
          source_context: config.context,
        }),
      });
    },
    [grantId]
  );

  const decide = useCallback(
    async (decision: DecisionKey) => {
      const config = DECISIONS[decision];
      const previous = saved;

      setSaving(decision);
      setError(null);
      setMessage(null);
      setSaved({ stage: config.stage, notes: previous?.notes ?? null });

      try {
        const response = await fetch(`/api/tracker/${grantId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: config.stage }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || 'Could not save decision.');
        }

        await recordFeedback(decision).catch(() => {});

        window.dispatchEvent(
          new CustomEvent('grant-decision-updated', {
            detail: { grantId, stage: config.stage },
          })
        );
        setMessage(`${config.label} saved. ${config.helper}`);
      } catch (err) {
        setSaved(previous);
        setError(err instanceof Error ? err.message : 'Could not save decision.');
      } finally {
        setSaving(null);
      }
    },
    [grantId, recordFeedback, saved]
  );

  if (loading) {
    return (
      <div className="mb-6 border-4 border-bauhaus-black/20 bg-white p-4">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">Loading decision controls...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <section className="mb-8 border-4 border-bauhaus-black bg-white">
      <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
        <div className="border-b-4 border-bauhaus-black p-4 lg:border-b-0 lg:border-r-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-red">Decide this grant</div>
              <h2 className="mt-2 text-xl font-black leading-tight text-bauhaus-black">{grantName}</h2>
              <p className="mt-1 text-sm font-medium text-bauhaus-muted">{provider}</p>
            </div>
            <span className="border-2 border-bauhaus-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
              {stageLabel(currentStage)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-0 border-2 border-bauhaus-black/20 sm:grid-cols-4">
            <div className="border-b-2 border-r-2 border-bauhaus-black/20 p-3 sm:border-b-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Amount</div>
              <div className="mt-1 text-sm font-black text-bauhaus-blue">{amount}</div>
            </div>
            <div className="border-b-2 border-bauhaus-black/20 p-3 sm:border-b-0 sm:border-r-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Deadline</div>
              <div className="mt-1 text-sm font-black text-bauhaus-red">{deadline}</div>
            </div>
            <div className="border-r-2 border-bauhaus-black/20 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Decision</div>
              <div className="mt-1 text-sm font-black text-bauhaus-black">{currentDecision || 'Choose one'}</div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">CRM</div>
              <div className="mt-1 text-sm font-black text-bauhaus-black">No auto-send</div>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-bauhaus-muted">
            This is only a pipeline decision. It does not submit the grant, email anyone, or send SMS.
          </p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(DECISIONS) as DecisionKey[]).map((key) => {
              const config = DECISIONS[key];
              const active = currentStage === config.stage;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => decide(key)}
                  disabled={saving !== null}
                  className={`min-h-20 border-2 px-3 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${config.className} ${
                    active ? 'ring-4 ring-bauhaus-yellow/60' : ''
                  }`}
                >
                  <span className="block text-xs font-black uppercase tracking-[0.25em]">
                    {saving === key ? 'Saving...' : config.label}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 opacity-80">{config.helper}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-2 border-bauhaus-black/10 bg-bauhaus-canvas p-3">
            <Link href="/tracker" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red">
              Back to tracker &rarr;
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
              No CRM write unless explicitly requested
            </span>
          </div>

          {message && <p className="mt-3 text-sm font-bold text-money">{message}</p>}
          {error && <p className="mt-3 text-sm font-bold text-bauhaus-red">{error}</p>}
        </div>
      </div>
    </section>
  );
}
