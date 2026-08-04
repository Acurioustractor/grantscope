import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GoodsTab } from './goods-sub-nav';
import { GoodsSubNav } from './goods-sub-nav';

export function GoodsWorkspaceHeader({
  slug,
  orgName,
  active,
  eyebrow,
  title,
  description,
  aside,
}: {
  slug: string;
  orgName: string;
  active: GoodsTab;
  eyebrow: string;
  title: string;
  description: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
      <div className="mx-auto max-w-[1760px] px-4 py-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-white/60" aria-label="Breadcrumb">
          <Link href={`/org/${slug}`} className="hover:text-white">{orgName}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
          <span aria-hidden="true">/</span>
          <span className="text-white">{title}</span>
        </nav>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{eyebrow}</div>
            <h1 className="mt-2 text-4xl font-black uppercase tracking-widest">{title}</h1>
            <div className="mt-3 text-sm leading-6 text-white/75">{description}</div>
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
        <GoodsSubNav slug={slug} active={active} />
      </div>
    </div>
  );
}

export function DataModeBanner({ warning }: { warning: string | null }) {
  if (!warning) {
    return (
      <div className="mb-5 flex items-start gap-3 border-4 border-bauhaus-black bg-white px-4 py-3 text-xs">
        <span className="mt-0.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 font-black uppercase tracking-widest text-emerald-800">Live model</span>
        <span className="leading-5 text-bauhaus-muted">Capital blocks, matters, routes and allocations are loading from the persisted GOODS workspace.</span>
      </div>
    );
  }
  return (
    <div className="mb-5 border-4 border-bauhaus-black bg-bauhaus-yellow px-4 py-3 text-xs" role="status">
      <div className="font-black uppercase tracking-widest text-bauhaus-black">Evidence-safe seed</div>
      <p className="mt-1 leading-5 text-bauhaus-muted">{warning}</p>
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'default' | 'blue' | 'yellow' | 'dark';
}) {
  const classes = {
    default: 'border-bauhaus-black bg-white text-bauhaus-black',
    blue: 'border-bauhaus-blue bg-link-light text-bauhaus-black',
    yellow: 'border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black',
    dark: 'border-bauhaus-black bg-bauhaus-black text-white',
  }[tone];
  return (
    <div className={`border-4 p-4 ${classes}`}>
      <div className={`text-[10px] font-black uppercase tracking-widest ${tone === 'dark' ? 'text-white/55' : 'text-bauhaus-muted'}`}>{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums">{value}</div>
      {detail ? <div className={`mt-2 text-[11px] leading-5 ${tone === 'dark' ? 'text-white/70' : 'text-bauhaus-muted'}`}>{detail}</div> : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'dark';
}) {
  const classes = {
    neutral: 'border-gray-300 bg-gray-50 text-gray-700',
    good: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    bad: 'border-red-300 bg-red-50 text-red-800',
    info: 'border-blue-300 bg-blue-50 text-blue-800',
    dark: 'border-bauhaus-black bg-bauhaus-black text-white',
  }[tone];
  return (
    <span className={`inline-flex items-center border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${classes}`}>
      {children}
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{eyebrow}</div> : null}
        <h2 className="mt-1 text-xl font-black uppercase tracking-widest text-bauhaus-black">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-bauhaus-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center border-2 border-bauhaus-black bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-4 border-dashed border-bauhaus-black bg-white p-8 text-center">
      <h3 className="text-lg font-black uppercase tracking-widest text-bauhaus-black">{title}</h3>
      <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-bauhaus-muted">{children}</div>
    </div>
  );
}

export function formatWorkspaceDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Perth' });
}
