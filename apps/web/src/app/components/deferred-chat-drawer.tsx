'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const ChatDrawer = dynamic(
  () => import('./chat-drawer').then(mod => mod.ChatDrawer),
  { ssr: false, loading: () => null }
);

type DeferredChatDrawerProps = {
  delayMs?: number;
};

export function DeferredChatDrawer({ delayMs = 1200 }: DeferredChatDrawerProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => setReady(true), { timeout: delayMs });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!ready) return null;
  return <ChatDrawer />;
}
