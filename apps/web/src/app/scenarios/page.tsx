import type { Metadata } from 'next';
import { ScenariosClient } from './scenarios-client';

export const metadata: Metadata = {
  title: 'Allocation Scenario Modelling — CivicGraph',
  description: 'What-if analysis: redirect funding from detention to community programs and see the projected impact on funding deserts and community organisations.',
};

export default function ScenariosPage() {
  return <ScenariosClient />;
}
