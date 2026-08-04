'use client';

export default function GoodsLivingModelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-4 py-16 text-slate-950">
      <div className="w-full max-w-2xl rounded-[1.75rem] border border-[#1f734f]/20 bg-white p-7 shadow-[0_24px_70px_rgba(23,53,43,0.08)] sm:p-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1f734f]">
          The source read did not finish
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
          The Goods model is still here. Its live record needs another read.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
          No evidence or decision has been changed. Try the read again, or return to Goods and continue from the existing
          project record.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-full bg-[#17352b] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#23483b] focus:outline-none focus:ring-2 focus:ring-[#2f8f64] focus:ring-offset-2"
          >
            Read again
          </button>
          <a
            href="../"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:border-[#1f734f] hover:bg-[#f1f8f5] focus:outline-none focus:ring-2 focus:ring-[#2f8f64] focus:ring-offset-2"
          >
            Back to Goods
          </a>
        </div>
      </div>
    </main>
  );
}
