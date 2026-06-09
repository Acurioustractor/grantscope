'use client';

/**
 * Print / Save-as-PDF affordance for the Proof Pack. Client-only (needs
 * window.print). Hidden in print output via the print:hidden on the wrapper.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
    >
      Print / Save as PDF
    </button>
  );
}
