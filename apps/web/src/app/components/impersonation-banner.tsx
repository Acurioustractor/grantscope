'use client';

export function ImpersonationBanner({ orgName, orgSlug }: { orgName: string; orgSlug: string }) {
  async function exitImpersonation() {
    await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    });
    window.location.href = '/org';
  }

  return (
    <div className="bg-amber-400 text-amber-900 px-4 py-2 text-sm font-bold flex items-center justify-between sticky top-12 z-40">
      <span>
        Viewing as <strong>{orgName}</strong> ({orgSlug}) — you are impersonating this organisation.
        <a href={`/org/${orgSlug}`} className="ml-2 underline">Org Dashboard</a>
        <a href={`/org/${orgSlug}/intelligence`} className="ml-2 underline">Command Center</a>
      </span>
      <button
        onClick={exitImpersonation}
        className="px-3 py-1 bg-amber-900 text-amber-100 text-xs font-black uppercase tracking-widest hover:bg-amber-800 transition-colors"
      >
        Exit Impersonation
      </button>
    </div>
  );
}
