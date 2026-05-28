'use client';

import Link from 'next/link';
import { fmtMoney, type YJSummary } from '@/lib/hooks/use-yj-summary';
import { useCountUp, useInView } from '../hooks';

export function ClosingScene({ data }: { data: YJSummary }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const cents = useCountUp((data.totals.prevention / data.totals.all) * 100, 2200, inView);
  const ratio = useCountUp(
    Math.round(data.totals.reactive / Math.max(1, data.totals.prevention)),
    2000,
    inView,
  );

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at center, #100a00 0%, #050505 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-24 text-center relative z-10">
        <div
          className="text-[10px] uppercase tracking-[0.4em] text-bauhaus-yellow mb-8"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 700ms ease',
          }}
        >
          The bottom line
        </div>

        <div
          className="font-mono text-base md:text-xl text-white/60 mb-4"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          Of every $100 in
        </div>

        <div
          className="font-black text-white text-[10rem] md:text-[16rem] leading-none tabular-nums tracking-tight"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'scale(1)' : 'scale(0.92)',
            transition: 'all 1000ms cubic-bezier(0.16, 1, 0.3, 1) 200ms',
            textShadow: '0 0 60px rgba(240,192,32,0.25)',
          }}
        >
          ${cents.toFixed(2)}
        </div>

        <div
          className="font-mono text-base md:text-2xl text-white/80 mt-6 max-w-3xl mx-auto leading-tight"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 800ms cubic-bezier(0.16, 1, 0.3, 1) 400ms',
          }}
        >
          reaches actual prevention.
        </div>

        <div
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 800ms ease 700ms',
          }}
        >
          <Stat label="Reactive" value={fmtMoney(data.totals.reactive)} color="#D02020" />
          <Stat label="Community-led" value={fmtMoney(data.totals['community-led'])} color="#F0C020" />
          <Stat label="Prevention" value={fmtMoney(data.totals.prevention)} color="#1040C0" />
        </div>

        <div
          className="mt-16 text-2xl md:text-4xl font-black tracking-tight max-w-3xl mx-auto"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 900ms cubic-bezier(0.16, 1, 0.3, 1) 900ms',
          }}
        >
          For every <span className="text-bauhaus-blue">$1</span> on prevention,
          <br />
          <span className="text-bauhaus-red tabular-nums">${Math.round(ratio)}</span> on locking kids up.
        </div>

        <div
          className="mt-12 text-sm md:text-base text-white/60 italic max-w-xl mx-auto"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 800ms ease 1100ms',
          }}
        >
          This is a choice, not a discovery.
        </div>

        {/* CTAs */}
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-3"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 800ms ease 1300ms',
          }}
        >
          <Link
            href="/reports/youth-justice"
            className="border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black font-black uppercase tracking-widest text-sm px-6 py-3 hover:bg-white"
          >
            Read the full report →
          </Link>
          <Link
            href="/graph/youth-justice-views"
            className="border-4 border-white text-white font-black uppercase tracking-widest text-sm px-6 py-3 hover:bg-white hover:text-black"
          >
            Explore all 5 views
          </Link>
          <Link
            href="/graph"
            className="border-4 border-white/30 text-white/70 font-black uppercase tracking-widest text-sm px-6 py-3 hover:border-white hover:text-white"
          >
            Browse the data
          </Link>
        </div>

        <div
          className="mt-16 pt-8 border-t border-white/10 text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 max-w-2xl mx-auto leading-relaxed"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 800ms ease 1500ms',
          }}
        >
          Source: <code className="text-white/60">justice_funding</code> ·{' '}
          {data.meta.year_range.min}–{data.meta.year_range.max} · aggregates excluded · ≥$50K grants ·
          lane classification: explicit topic flags + recipient-name patterns
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border-2 border-white/10 p-4 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">{label}</div>
      <div className="font-black text-2xl md:text-3xl tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
