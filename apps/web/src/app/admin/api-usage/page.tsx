import { Metadata } from 'next';
import { ApiUsageDashboard } from './dashboard';

export const metadata: Metadata = {
  title: 'API Usage — Admin — CivicGraph',
};

export const dynamic = 'force-dynamic';

export default function AdminApiUsagePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Admin</div>
        <h1 className="text-3xl font-black text-bauhaus-black tracking-tight">API Usage Dashboard</h1>
        <p className="text-sm text-bauhaus-muted font-medium mt-1">Per-org usage, rate limits, and key activity.</p>
      </div>
      <ApiUsageDashboard />
    </div>
  );
}
