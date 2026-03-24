'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Hover tooltip for metric labels — shows definition, source, methodology.
 * Uses the source and notes fields from outcomes_metrics.
 */
export function MetricTooltip({
  label,
  source,
  notes,
  period,
  children,
}: {
  label: string;
  source?: string | null;
  notes?: string | null;
  period?: string | null;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(true), 300);
  };

  const handleLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(false), 150);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // Don't render tooltip trigger if no metadata
  if (!source && !notes) return <>{children}</>;

  return (
    <span
      ref={ref}
      className="relative cursor-help border-b border-dotted border-bauhaus-muted/40"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-0 mb-1 w-64 p-3 bg-white border-2 border-bauhaus-black shadow-lg text-left">
          <span className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
            {label}
          </span>
          {notes && (
            <span className="block text-xs text-bauhaus-black leading-snug mb-1.5">
              {notes}
            </span>
          )}
          {source && (
            <span className="block text-[10px] text-bauhaus-muted">
              Source: {source}
            </span>
          )}
          {period && (
            <span className="block text-[10px] text-bauhaus-muted">
              Period: {period}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
