'use client';

import { useEffect, useRef, useCallback } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Width of the panel — default 420px */
  width?: number;
}

export function SlidePanel({ open, onClose, children, width = 420 }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
        className="fixed inset-0 z-40 bg-black/20 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col animate-slide-in-right shadow-xl"
        style={{
          width: `${width}px`,
          maxWidth: '90vw',
          background: 'var(--ws-surface-1)',
          borderLeft: '1px solid var(--ws-border)',
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
      className="flex items-center justify-between px-5 py-3 shrink-0 border-b"
      style={{ borderColor: 'var(--ws-border)' }}
    >
      <div className="flex-1 min-w-0">{children}</div>
      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        {href && (
          <a
            href={href}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
            style={{ color: 'var(--ws-accent)', background: 'rgba(37,99,235,0.06)' }}
          >
            Open Full &rarr;
          </a>
        )}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-[var(--ws-surface-2)]"
          style={{ color: 'var(--ws-text-tertiary)' }}
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
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {children}
    </div>
  );
}
