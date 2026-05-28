'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Returns ref + boolean for whether the ref is currently in viewport.
 * Triggers when threshold portion is visible.
 */
export function useInView<T extends Element>(threshold = 0.4, once = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);

  return { ref, inView };
}

/**
 * Returns ref + a 0..1 progress value based on how much of the element
 * has scrolled past the viewport top. Useful for sticky-section scrubbing.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf: number | null = null;
    const tick = () => {
      raf = null;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Element top reaches viewport top → progress 0
      // Element bottom reaches viewport top → progress 1
      const total = rect.height - vh;
      if (total <= 0) {
        setProgress(rect.top < 0 ? 1 : 0);
        return;
      }
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / total));
      setProgress(p);
    };
    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, progress };
}

/**
 * Animated count-up. Starts when `trigger` is true. Returns current value.
 * Eases out cubic for a nice deceleration.
 */
export function useCountUp(target: number, durationMs = 1800, trigger = true) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!trigger) {
      setVal(0);
      return;
    }
    let raf: number;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start == null) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, trigger]);

  return val;
}
