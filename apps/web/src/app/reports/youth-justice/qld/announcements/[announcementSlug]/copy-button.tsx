'use client';

import { useState } from 'react';

type CopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
};

export function CopyButton({ text, label = 'Copy', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2200);
    }
  }

  return (
    <button
      type="button"
      onClick={copyText}
      className={`border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white ${className}`}
    >
      {failed ? 'Copy failed' : copied ? 'Copied' : label}
    </button>
  );
}
