export default function GoodsLivingModelLoading() {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-950">
      <div className="bg-[#17352b] text-white">
        <div className="mx-auto max-w-[1480px] px-4 py-10 sm:px-6">
          <div className="h-4 w-52 animate-pulse rounded-full bg-white/10" />
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div className="flex min-h-[320px] flex-col justify-center">
              <div className="h-3 w-44 animate-pulse rounded-full bg-[#9ed0b3]/30" />
              <div className="mt-5 h-14 max-w-xl animate-pulse rounded-2xl bg-white/10" />
              <div className="mt-4 h-5 max-w-lg animate-pulse rounded-full bg-white/10" />
              <div className="mt-12 h-20 max-w-xl animate-pulse rounded-2xl bg-white/10" />
            </div>
            <div className="min-h-[340px] animate-pulse rounded-[1.75rem] border border-white/10 bg-white/5" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1380px] px-4 py-16 sm:px-6">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[#2f8f64]/20" />
        <div className="mt-4 h-10 max-w-xl animate-pulse rounded-xl bg-slate-200/70" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <p className="sr-only" role="status">
          Reading the Goods story, place records and current evidence.
        </p>
      </div>
    </main>
  );
}
