'use client';

import { useState, type ReactNode, type MouseEvent } from 'react';
import { GrantPreviewPanel } from './grant-preview-panel';

/**
 * Wraps a list of grant cards. Each card's <a> link is intercepted on
 * plain left-click to open the preview panel instead. Cmd/Ctrl+click and
 * middle-click still open in a new tab (native browser behaviour preserved).
 */
export function GrantListWithPreview({ children }: { children: ReactNode }) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    // Walk up from the click target to find the nearest <a> with an href matching /grants/<id>
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.tagName === 'A') {
        const href = (el as HTMLAnchorElement).getAttribute('href');
        if (href) {
          const match = href.match(/^\/grants\/([a-f0-9-]+)$/i);
          if (match) {
            // Let cmd+click / ctrl+click / middle-click open normally
            if (e.metaKey || e.ctrlKey || e.button === 1) return;
            e.preventDefault();
            setPreviewId(match[1]);
            return;
          }
        }
        // Non-grant link — let it through
        return;
      }
      // If we hit a button or interactive element first, don't intercept
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
      el = el.parentElement;
    }
  }

  return (
    <>
      <div onClick={handleClick}>
        {children}
      </div>
      <GrantPreviewPanel grantId={previewId} onClose={() => setPreviewId(null)} />
    </>
  );
}
