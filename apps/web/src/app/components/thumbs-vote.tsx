'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const UP_REASONS = [
  'Right sector',
  'Right size',
  'Right location',
  'Strong fit',
] as const;

const DOWN_REASONS = [
  'Wrong sector',
  'Too small',
  'Wrong location',
  'Not relevant',
  'Already applied',
  'Not a grant',
] as const;

interface ThumbsVoteProps {
  grantId: string;
  initialVote?: 1 | -1 | null;
  sourceContext?: string;
  projectCode?: string;
  onVote?: (vote: 1 | -1) => void;
}

export function ThumbsVote({ grantId, initialVote = null, sourceContext, projectCode, onVote }: ThumbsVoteProps) {
  const [vote, setVote] = useState<1 | -1 | null>(initialVote);
  const [showReasons, setShowReasons] = useState<'up' | 'down' | null>(null);
  const [saving, setSaving] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const upBtnRef = useRef<HTMLButtonElement>(null);
  const downBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function submitVote(v: 1 | -1, reason?: string) {
    setSaving(true);
    setVote(v);
    setShowReasons(null);
    onVote?.(v);

    try {
      await fetch(`/api/grants/${grantId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: v, reason, source_context: sourceContext, project_code: projectCode }),
      });
    } catch {
      // Optimistic — don't revert on failure
    } finally {
      setSaving(false);
    }
  }

  function handleDown() {
    if (vote === -1) return;
    if (downBtnRef.current) {
      const rect = downBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.right - 160 });
    }
    setShowReasons('down');
  }

  function handleUp() {
    if (vote === 1) return;
    if (upBtnRef.current) {
      const rect = upBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowReasons('up');
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
      upBtnRef.current && !upBtnRef.current.contains(e.target as Node) &&
      downBtnRef.current && !downBtnRef.current.contains(e.target as Node)
    ) {
      setShowReasons(null);
    }
  }, []);

  useEffect(() => {
    if (showReasons) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReasons, handleClickOutside]);

  const reasons = showReasons === 'up' ? UP_REASONS : DOWN_REASONS;
  const voteValue = showReasons === 'up' ? 1 : -1;
  const headerText = showReasons === 'up' ? 'Why?' : 'Why not?';

  return (
    <div className="inline-flex items-center gap-1">
      <button
        ref={upBtnRef}
        onClick={handleUp}
        disabled={saving}
        className={`p-1.5 border-2 transition-colors ${
          vote === 1
            ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
            : 'border-bauhaus-black/20 hover:border-bauhaus-blue text-bauhaus-black/40 hover:text-bauhaus-blue'
        }`}
        title="Good match"
        aria-label="Thumbs up"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        ref={downBtnRef}
        onClick={handleDown}
        disabled={saving}
        className={`p-1.5 border-2 transition-colors ${
          vote === -1
            ? 'border-bauhaus-red bg-bauhaus-red text-white'
            : 'border-bauhaus-black/20 hover:border-bauhaus-red text-bauhaus-black/40 hover:text-bauhaus-red'
        }`}
        title="Not a good match"
        aria-label="Thumbs down"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      </button>

      {showReasons && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] border-3 border-bauhaus-black bg-white shadow-lg min-w-[160px]"
          style={{ top: dropdownPos.top, left: Math.max(8, dropdownPos.left) }}
        >
          <div className="px-3 py-1.5 border-b-2 border-bauhaus-black/10">
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{headerText}</span>
          </div>
          {reasons.map(reason => (
            <button
              key={reason}
              onClick={() => submitVote(voteValue as 1 | -1, reason)}
              className="block w-full text-left px-3 py-1.5 text-xs text-bauhaus-black hover:bg-bauhaus-black/5 transition-colors"
            >
              {reason}
            </button>
          ))}
          <button
            onClick={() => submitVote(voteValue as 1 | -1)}
            className="block w-full text-left px-3 py-1.5 text-xs text-bauhaus-muted hover:bg-bauhaus-black/5 border-t border-bauhaus-black/10 transition-colors"
          >
            Skip reason
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
