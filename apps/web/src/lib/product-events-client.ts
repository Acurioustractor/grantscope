'use client';

import type { ProductEventType } from '@/lib/product-events';

type TrackOptions = {
  source: string;
  metadata?: Record<string, unknown>;
  onceKey?: string;
};

export async function trackProductEvent(eventType: ProductEventType, options: TrackOptions) {
  const { source, metadata, onceKey } = options;

  if (typeof window !== 'undefined' && onceKey) {
    const storageKey = `cg:product-event:${onceKey}`;
    if (window.sessionStorage.getItem(storageKey)) {
      return;
    }
    window.sessionStorage.setItem(storageKey, '1');
  }

  try {
    await fetch('/api/product-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        source,
        metadata: metadata || {},
      }),
    });
  } catch {
    // Best-effort only.
  }
}
