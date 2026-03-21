'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-bauhaus-black text-white px-6 py-2 text-sm font-bold uppercase tracking-wider"
    >
      Print / Save PDF
    </button>
  );
}
