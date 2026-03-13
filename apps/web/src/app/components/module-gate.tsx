'use client';

import Link from 'next/link';
import type { Module, Tier } from '@/lib/subscription';
import { MODULE_LABELS, TIER_LABELS, minimumTier } from '@/lib/subscription';

export default function ModuleGate({ module, currentTier }: { module: Module; currentTier: Tier }) {
  const required = minimumTier(module);
  const moduleLabel = MODULE_LABELS[module];
  const tierLabel = TIER_LABELS[required];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
        style={{ background: 'var(--ws-surface-2)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ws-text-tertiary)' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ws-text)' }}>
        {moduleLabel}
      </h3>
      <p className="text-[13px] max-w-sm mb-6" style={{ color: 'var(--ws-text-secondary)' }}>
        This module requires a <span className="font-semibold">{tierLabel}</span> plan or above.
        {currentTier !== required && (
          <> You&apos;re currently on <span className="font-semibold">{TIER_LABELS[currentTier]}</span>.</>
        )}
      </p>
      <Link
        href="/pricing"
        className="px-5 py-2.5 text-[13px] font-semibold rounded-lg transition-colors"
        style={{
          background: 'var(--ws-text)',
          color: 'var(--ws-surface-0)',
        }}
      >
        View plans
      </Link>
    </div>
  );
}
