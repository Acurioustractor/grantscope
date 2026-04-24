'use client';

import { useState } from 'react';

interface DueDiligenceButtonProps {
  gsId: string;
}

export function DueDiligenceButton({ gsId }: DueDiligenceButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/entities/${gsId}/due-diligence?format=pdf`);
      if (res.status === 401) {
        window.location.href = '/register';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/support';
        return;
      }
      if (!res.ok) {
        throw new Error('Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `due-diligence-${gsId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — user sees loading state reset
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-[11px] font-black px-3 py-1.5 border-2 border-bauhaus-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red hover:border-bauhaus-red transition-colors disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Due Diligence Pack'}
      </button>
      <a
        href={`/entities/${gsId}/due-diligence`}
        className="text-[11px] font-black px-3 py-1.5 border-2 border-bauhaus-black text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
      >
        Preview
      </a>
    </div>
  );
}
