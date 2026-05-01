'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * DetailDrawer
 *
 * Click-to-expand right-side drawer. Shows a richer summary of an item
 * inline in the dashboard — readers don't have to click through to source
 * to understand what's there.
 *
 * Pattern:
 *   <DetailDrawer
 *     trigger={<button className="...">card content</button>}
 *     title="Adult Crime, Adult Time expands to 45 offences"
 *     subtitle="David Crisafulli · Premier · 28 Feb 2026"
 *     toneClass="border-bauhaus-red"
 *   >
 *     <Section title="Lede">…</Section>
 *     <Section title="Body excerpt">…</Section>
 *   </DetailDrawer>
 *
 * Accessibility: <dialog> element gets native ESC + backdrop click + focus
 * trap from the browser. We add body scroll-lock manually since native
 * dialog doesn't lock by default in non-modal mode.
 */
export function DetailDrawer({
  trigger,
  title,
  subtitle,
  toneClass = 'border-bauhaus-black',
  sourceHref,
  sourceLabel = 'Open original source ↗',
  children,
}: {
  trigger: ReactNode;
  title: string;
  subtitle?: string;
  toneClass?: string;
  sourceHref?: string;
  sourceLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) dlg.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      if (dlg.open) dlg.close();
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClose = () => setOpen(false);
    const onClick = (e: MouseEvent) => {
      // Click on the backdrop (i.e., the dialog itself, not its content) → close
      if (e.target === dlg) setOpen(false);
    };
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', onClick);
    return () => {
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full text-left p-0 m-0 bg-transparent border-0 cursor-pointer"
      >
        {trigger}
      </button>
      <dialog
        ref={dialogRef}
        className="m-0 ml-auto h-full max-h-screen w-full sm:w-[560px] bg-bauhaus-canvas border-l-4 border-bauhaus-black backdrop:bg-bauhaus-black/40 p-0"
        style={{ maxHeight: '100vh' }}
      >
        <div className={`flex flex-col h-screen border-l-8 ${toneClass}`}>
          <div className="flex items-start justify-between gap-3 p-5 border-b-4 border-bauhaus-black bg-white">
            <div className="flex-1 min-w-0">
              {subtitle && <div className="text-[10px] font-mono font-black text-bauhaus-muted uppercase tracking-widest mb-1">{subtitle}</div>}
              <h3 className="text-lg sm:text-xl font-black text-bauhaus-black uppercase tracking-tight leading-tight break-words">{title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="shrink-0 px-3 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-yellow"
            >
              Close ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm font-medium text-bauhaus-black leading-relaxed">
            {children}
          </div>
          {sourceHref && (
            <div className="border-t-4 border-bauhaus-black bg-white p-5 text-center">
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener"
                className="inline-block px-5 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red"
              >
                {sourceLabel}
              </a>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

/** Lightweight section block for drawer body. */
export function DrawerSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-2">{label}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function DrawerKeyValue({ items }: { items: Array<{ label: string; value: string | null | undefined }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {items.filter(i => i.value).map(i => (
        <div key={i.label}>
          <dt className="font-black uppercase tracking-widest text-bauhaus-muted text-[10px]">{i.label}</dt>
          <dd className="font-mono text-bauhaus-black mt-0.5">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
