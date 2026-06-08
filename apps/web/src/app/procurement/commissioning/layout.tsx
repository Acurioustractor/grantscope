import type { Metadata } from 'next';

// /procurement/commissioning leads with static value content; metadata lives here
// so it overrides the generic procurement layout title.
export const metadata: Metadata = {
  title: 'Commissioning Intelligence — CivicGraph',
  description:
    'Place-based health and social care commissioning for Primary Health Networks — map provider capabilities against population needs, identify thin markets and match evidence-based interventions, built on the CivicGraph entity graph and ALMA.',
};

export default function CommissioningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
