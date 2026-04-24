'use client';

import { trackProductEvent } from '@/lib/product-events-client';
import type { TierKey } from '@/lib/stripe';

type StartCheckoutResult =
  | { ok: true }
  | { ok: false; error: string };

export async function startCheckoutForTier(tier: TierKey, source = 'unknown'): Promise<StartCheckoutResult> {
  try {
    await trackProductEvent('upgrade_cta_clicked', {
      source,
      metadata: { tier },
    });

    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, billing: 'monthly', source }),
    });

    const data = await res.json().catch(() => null);

    if (data?.url) {
      window.location.href = data.url;
      return { ok: true };
    }

    if (res.status === 401) {
      window.location.href = `/register?plan=${tier}`;
      return { ok: true };
    }

    if (res.status === 400 && data?.error === 'Create an organisation profile first') {
      window.location.href = '/profile?next=/alerts';
      return { ok: true };
    }

    return { ok: false, error: data?.error || 'Could not start checkout.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not start checkout.',
    };
  }
}
