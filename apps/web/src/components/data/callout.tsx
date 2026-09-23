import type { ReactNode } from 'react';

const TONE = {
  /** Something about power or money the reader should notice (revolving door, interlocks). */
  alert: 'border-bauhaus-red bg-danger-light text-bauhaus-red',
  /** A caution about the data itself (a nominee block, a known gap). */
  caution: 'border-bauhaus-black bg-warning-light text-bauhaus-black',
  /** Neutral context. */
  note: 'border-bauhaus-black bg-bauhaus-canvas text-bauhaus-black',
} as const;

/** A flagged block with an uppercase heading. Tokens only; replaces the amber/gray alert boxes. */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: keyof typeof TONE;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className={`border-4 p-4 ${TONE[tone]}`}>
      <h2 className="text-[11px] font-black uppercase tracking-widest">{title}</h2>
      {children && <div className="mt-2 text-sm text-bauhaus-black">{children}</div>}
    </section>
  );
}
