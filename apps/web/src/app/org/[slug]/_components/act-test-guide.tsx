'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'act-gold-standard-test-drive-v1';

interface TestStep {
  id: string;
  label: string;
  question: string;
  success: string;
  href: (slug: string) => string;
}

const TEST_STEPS: TestStep[] = [
  {
    id: 'whole-system',
    label: 'Whole system',
    question: 'What should ACT act on today, and why?',
    success: 'Name the move, relationship owner, evidence and missing information.',
    href: (slug) => `/org/${slug}?walkthrough=1`,
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    question: 'Which opening is verified, relevant and ready for a decision?',
    success: 'Compare grants, philanthropy and procurement; then record a path or gap.',
    href: (slug) => `/org/${slug}?view=opportunities&review=changes&walkthrough=1#opportunities`,
  },
  {
    id: 'relationships',
    label: 'Relationships',
    question: 'What has ACT tried, what happened and what is the next touch?',
    success: 'Find the person, history, connected work, outcome and follow-up.',
    href: (slug) => `/org/${slug}?view=relationships&walkthrough=1#relationships`,
  },
  {
    id: 'money',
    label: 'Money and value',
    question: 'Who paid ACT, what is owed and what work or relationship sits behind it?',
    success: 'Trace received, outstanding, project, people, exchanges and evidence gaps.',
    href: (slug) => `/org/${slug}?view=money&walkthrough=1#money`,
  },
  {
    id: 'communities',
    label: 'Communities',
    question: 'What does ACT know about Tennant Creek, and what can it not claim?',
    success: 'Check work, assets, authority, people, adjacent activity and the next move.',
    href: (slug) => `/org/${slug}/explore?q=Tennant+Creek&type=community&walkthrough=1`,
  },
  {
    id: 'connections',
    label: 'Cross-system trace',
    question: 'Can one project be followed across opportunity, people, money and place?',
    success: 'Trace Goods on Country through pipeline, funders, people, money and communities.',
    href: (slug) => `/org/${slug}/explore?q=Goods+on+Country&type=project&walkthrough=1`,
  },
];

function activeStep(pathname: string, searchParams: URLSearchParams): string {
  if (pathname.endsWith('/explore')) {
    return searchParams.get('type') === 'community' ? 'communities' : 'connections';
  }
  const view = searchParams.get('view');
  if (view === 'opportunities') return 'opportunities';
  if (view === 'relationships') return 'relationships';
  if (view === 'money') return 'money';
  return 'whole-system';
}

function readProgress(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

export function ActTestGuide({ slug }: { slug: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const walkthroughRequested = searchParams.get('walkthrough') === '1';
  const [open, setOpen] = useState(walkthroughRequested);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCompleted(readProgress());
  }, []);

  useEffect(() => {
    if (walkthroughRequested) setOpen(true);
  }, [walkthroughRequested]);

  const currentStep = activeStep(pathname, searchParams);
  const completeCount = useMemo(
    () => TEST_STEPS.filter((step) => completed[step.id]).length,
    [completed],
  );

  function setStepComplete(stepId: string, value: boolean) {
    setCompleted((current) => {
      const next = { ...current, [stepId]: value };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function reset() {
    setCompleted({});
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 min-h-11 rounded-md border border-[#315c45] bg-[#183426] px-4 text-xs font-semibold text-white shadow-lg transition hover:bg-[#24523b] focus:outline-none focus:ring-2 focus:ring-[#2f8f64] focus:ring-offset-2"
        data-testid="act-test-guide-launcher"
      >
        {completeCount > 0 ? `Resume test drive · ${completeCount}/${TEST_STEPS.length}` : 'Test the whole ACT system'}
      </button>
    );
  }

  const progress = Math.round((completeCount / TEST_STEPS.length) * 100);

  return (
    <aside
      className="fixed bottom-4 right-4 z-50 flex max-h-[calc(100vh-2rem)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-[#315c45] bg-[#fffdf8] shadow-2xl"
      aria-label="ACT gold-standard test drive"
      data-testid="act-test-guide"
    >
      <header className="shrink-0 border-b border-[#315c45] bg-[#183426] px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#b9ff66]">
              Live CivicGraph walkthrough
            </div>
            <h2 className="mt-2 text-lg font-semibold">Test the whole ACT system</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 shrink-0 rounded border border-white/25 px-3 text-xs font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#b9ff66]"
            aria-label="Close ACT test guide"
          >
            Close
          </button>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wide text-[#c7d3cb]">
            <span>Progress</span>
            <span>{completeCount} of {TEST_STEPS.length}</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={TEST_STEPS.length}
            aria-valuenow={completeCount}
            aria-label="ACT test drive progress"
          >
            <div className="h-full bg-[#b9ff66] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-[#d9d1c4] bg-[#edf3ee] px-5 py-3 text-[11px] leading-relaxed text-[#315c45]">
          These screens use live ACT data. Viewing and filtering are safe. Buttons labelled Save, Record or Complete write to CivicGraph; external systems still follow their existing confirmation gates.
        </div>

        <ol className="divide-y divide-[#d9d1c4]">
          {TEST_STEPS.map((step, index) => {
            const active = currentStep === step.id;
            const done = Boolean(completed[step.id]);
            return (
              <li key={step.id} className={active ? 'bg-[#f1f8f5]' : 'bg-[#fffdf8]'}>
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded font-mono text-[9px] font-semibold ${active ? 'bg-[#2f8f64] text-white' : 'bg-[#eee8de] text-[#655f57]'}`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#13251a]">{step.label}</div>
                          {active ? <div className="mt-1 font-mono text-[8px] font-semibold uppercase tracking-wide text-[#2f8f64]">Current screen</div> : null}
                        </div>
                        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-[10px] font-semibold text-[#4d5d52]">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(event) => setStepComplete(step.id, event.target.checked)}
                            className="h-4 w-4 accent-[#2f8f64]"
                            aria-label={`Mark ${step.label} test complete`}
                          />
                          Done
                        </label>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-[#24382b]">{step.question}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#655f57]">{step.success}</p>
                      <Link
                        href={step.href(slug)}
                        className="mt-3 inline-flex min-h-11 items-center rounded-md border border-[#315c45] px-3 text-xs font-semibold text-[#183426] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#2f8f64]"
                      >
                        Open live {step.label.toLowerCase()} screen
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#d9d1c4] bg-[#f7f3eb] px-5 py-3">
        <span className="text-[10px] leading-relaxed text-[#655f57]">Aim for a confident answer in 60–90 seconds.</span>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold text-[#8a3f22] hover:bg-[#f4e1d4] focus:outline-none focus:ring-2 focus:ring-[#c65d2e]"
        >
          Reset
        </button>
      </footer>
    </aside>
  );
}
