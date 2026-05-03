'use client';

import { useEffect, useRef, useCallback, type CSSProperties } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Width of the panel — default 420px */
  width?: number;
}

export function SlidePanel({ open, onClose, children, width = 420 }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const panelTheme = {
    '--ws-surface-0': '#FDFCFB',
    '--ws-surface-1': '#FFFFFF',
    '--ws-surface-2': '#F5F3F0',
    '--ws-border': '#D6D3D1',
    '--ws-border-strong': '#111111',
    '--ws-text': '#111111',
    '--ws-text-secondary': '#57534E',
    '--ws-text-tertiary': '#78716C',
    '--ws-accent': '#1D4ED8',
    '--ws-red': '#DC2626',
    '--ws-amber': '#D97706',
    '--ws-green': '#16A34A',
  } as CSSProperties & Record<string, string>;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col animate-slide-in-right"
        style={{
          ...panelTheme,
          width: `${width}px`,
          maxWidth: 'calc(100vw - 16px)',
          background: '#FFFFFF',
          borderLeft: '4px solid #111111',
          boxShadow: '-18px 0 48px rgba(17, 17, 17, 0.24)',
        }}
      >
        {children}
      </div>
    </>
  );
}

/* ── Panel sub-components for consistent layout ── */

export function SlidePanelHeader({
  onClose,
  href,
  children,
}: {
  onClose: () => void;
  /** Full-page link */
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3 shrink-0 border-b-2"
      style={{ borderColor: 'var(--ws-border-strong)', background: 'var(--ws-surface-1)' }}
    >
      <div className="flex-1 min-w-0">{children}</div>
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        {href && (
          <a
            href={href}
            className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 border transition-colors hover:bg-[var(--ws-border-strong)] hover:text-white"
            style={{ color: 'var(--ws-border-strong)', background: 'var(--ws-surface-2)', borderColor: 'var(--ws-border)' }}
          >
            Open Full &rarr;
          </a>
        )}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center border transition-colors hover:bg-[var(--ws-border-strong)] hover:text-white"
          style={{ color: 'var(--ws-text)', borderColor: 'var(--ws-border)' }}
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function SlidePanelBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-5" style={{ background: 'var(--ws-surface-1)' }}>
      {children}
    </div>
  );
}
