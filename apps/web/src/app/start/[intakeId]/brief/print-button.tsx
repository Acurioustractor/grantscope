'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs font-bold uppercase tracking-wider text-bauhaus-black hover:text-gray-600 transition-colors"
    >
      Print
    </button>
  );
}
