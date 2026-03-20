import type { Metadata } from 'next';
import { AskClient } from './ask-client';

export const metadata: Metadata = {
  title: 'Ask CivicGraph — Natural Language Data Query',
  description: 'Ask questions in plain English and get answers from CivicGraph\'s cross-system database covering contracts, grants, donations, charities, and evidence data.',
};

export default function AskPage() {
  return <AskClient />;
}
