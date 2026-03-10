import { MissionControlClient } from './mission-control-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mission Control — CivicGraph',
  description: 'Unified data inventory, power concentration analysis, agent status, and live SQL playground.',
};

export default function MissionControlPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <MissionControlClient />
    </div>
  );
}
