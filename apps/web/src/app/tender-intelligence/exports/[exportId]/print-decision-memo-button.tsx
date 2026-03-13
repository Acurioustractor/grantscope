'use client';

export function PrintDecisionMemoButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
    >
      Print Decision Memo
    </button>
  );
}
