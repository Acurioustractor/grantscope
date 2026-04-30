import { redirect } from 'next/navigation';

/**
 * Pricing was the v0 conversion endpoint; we've since switched to a structured
 * feedback form at /feedback to learn what's valuable before committing to a
 * pricing structure. Permanent redirect for any old links / shares still
 * pointing here.
 */
export default function PricingRedirect() {
  redirect('/feedback');
}
