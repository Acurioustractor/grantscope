export default function ActPlaceFieldLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-[var(--ws-surface-0)] px-4 py-5 sm:px-6 lg:px-8" aria-label="Loading place field">
      <div className="h-3 w-40 rounded bg-[var(--ws-surface-2)]" />
      <div className="mt-4 h-9 w-full max-w-2xl rounded bg-[var(--ws-surface-2)]" />
      <div className="mt-3 h-5 w-full max-w-4xl rounded bg-[var(--ws-surface-2)]" />
      <div className="mt-7 h-40 rounded-lg border border-[var(--ws-border)] bg-white" />
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--ws-border)] bg-[var(--ws-border)] md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-24 bg-white" />)}
      </div>
      <div className="mt-5 h-12 rounded-lg border border-[var(--ws-border)] bg-white" />
      <div className="mt-5 h-96 rounded-lg border border-[var(--ws-border)] bg-white" />
    </main>
  );
}
