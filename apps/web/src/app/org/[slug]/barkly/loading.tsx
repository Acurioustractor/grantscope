export default function BarklyRegionalFieldLoading() {
  return (
    <main className="min-h-screen bg-[var(--ws-surface-0)] px-4 py-6 sm:px-6 lg:px-8" aria-label="Loading Barkly regional field">
      <div className="animate-pulse">
        <div className="h-3 w-48 rounded bg-[#d9e5dc]" />
        <div className="mt-4 h-9 max-w-3xl rounded bg-[#d9e5dc]" />
        <div className="mt-3 h-4 max-w-4xl rounded bg-[#e5ece6]" />
        <div className="mt-7 h-48 rounded-lg border border-[#c5d3c8] bg-[#edf4ee]" />
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[#d7dfd8] md:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-24 bg-white" />)}
        </div>
        <div className="mt-5 h-14 rounded-lg border border-[#d7dfd8] bg-white" />
        <div className="mt-5 grid gap-5 xl:grid-cols-2"><div className="h-96 rounded-lg bg-white" /><div className="h-96 rounded-lg bg-white" /></div>
      </div>
    </main>
  );
}
