'use client';

import { fmtMoney, type YJSummary } from '@/lib/hooks/use-yj-summary';
import { useCountUp, useInView } from '../hooks';

export function HeroScene({ data }: { data: YJSummary }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const total = useCountUp(data.totals.all, 2400, inView);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at center, #1a0a0a 0%, #0a0a0a 70%)',
      }}
    >
      {/* Subtle grain */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/></svg>")',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <div
          className="text-[10px] md:text-xs font-mono uppercase tracking-[0.4em] text-bauhaus-yellow mb-6"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 700ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          A CivicGraph Investigation
        </div>

        <h1
          className="font-black text-white text-5xl md:text-8xl lg:text-9xl leading-none tracking-tight mb-6"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(40px)',
            transition: 'all 900ms cubic-bezier(0.16, 1, 0.3, 1) 100ms',
          }}
        >
          Where the
          <br />
          <span className="text-bauhaus-red">money landed</span>
        </h1>

        <div
          className="text-2xl md:text-4xl text-white/80 font-light tracking-wide max-w-3xl mx-auto leading-tight"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(40px)',
            transition: 'all 900ms cubic-bezier(0.16, 1, 0.3, 1) 250ms',
          }}
        >
          Australia spent{' '}
          <span className="text-bauhaus-yellow font-black tabular-nums">
            {fmtMoney(total)}
          </span>{' '}
          on youth justice between {data.meta.year_range.min} and{' '}
          {data.meta.year_range.max}.
        </div>

        <div
          className="text-lg md:text-2xl text-white/60 font-light mt-8 max-w-2xl mx-auto"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 900ms ease 700ms',
          }}
        >
          Most of it didn&apos;t go where you think.
        </div>

        <div
          className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30 mt-20"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 1200ms ease 1200ms',
          }}
        >
          ↓ Keep scrolling
        </div>
      </div>
    </section>
  );
}
