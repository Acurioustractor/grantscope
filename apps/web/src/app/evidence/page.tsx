import type { Metadata } from 'next';
import { EvidenceClient } from './evidence-client';

export const metadata: Metadata = {
  title: 'Evidence Synthesis — CivicGraph',
  description: 'Synthesis of the Australian Living Map of Alternatives (ALMA) evidence database for policy-makers and commissioners.',
};

export default function EvidencePage() {
  return <EvidenceClient />;
}
