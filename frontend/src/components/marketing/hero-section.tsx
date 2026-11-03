'use client';

import { createScope, createTimeline, stagger } from 'animejs';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { StorePlayground } from '@/components/marketing/store-playground';

export function HeroSection() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scope = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: 'outExpo' } })
        .add('.hero-kicker', { opacity: { from: 0 }, y: { from: 18 }, duration: 700 })
        .add('.hero-line', {
          opacity: { from: 0 },
          y: { from: 70 },
          rotate: { from: 2 },
          delay: stagger(100),
          duration: 1000,
        }, '-=450')
        .add('.hero-support', { opacity: { from: 0 }, y: { from: 24 }, duration: 700 }, '-=500');
    });

    return () => scope.revert();
  }, []);

  return (
    <section ref={root} className="relative grid min-h-[760px] items-center gap-10 py-16 lg:grid-cols-[.92fr_1.08fr] lg:py-20">
      <div className="relative z-10 pt-10 lg:pt-0">
        <div className="hero-kicker mb-7 inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.18em]">
          <span className="h-2 w-2 rounded-full bg-[#ff5c35] shadow-[0_0_0_4px_rgba(255,92,53,.15)]" />
          Commerce without the boring bits
        </div>

        <h1 className="font-display text-[clamp(4rem,8vw,7.6rem)] font-bold leading-[.79] tracking-[-.075em] text-[#151517]">
          <span className="hero-line block">SELL</span>
          <span className="hero-line block text-[#ff5c35]">ANYTHING.</span>
          <span className="hero-line block">BE SEEN.</span>
        </h1>

        <div className="hero-support mt-9 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <p className="max-w-md text-base leading-7 text-black/60 sm:text-lg">
            Build a storefront with character. Products, payments, shipping and growth tools—ready before your coffee gets cold.
          </p>
          <div className="flex flex-wrap gap-3 sm:flex-col">
            <Link href="/start" className="marketing-button marketing-button-dark">Start selling <span>↗</span></Link>
            <Link href="/demo" className="marketing-button marketing-button-light">Explore demo</Link>
          </div>
        </div>

        <div className="hero-support mt-10 flex items-center gap-4 border-t border-black/10 pt-5 text-[10px] font-bold uppercase tracking-[.16em] text-black/45">
          <span>No card</span><span className="h-1 w-1 rounded-full bg-black/25" />
          <span>Live today</span><span className="h-1 w-1 rounded-full bg-black/25" />
          <span>Cancel anytime</span>
        </div>
      </div>

      <StorePlayground />
    </section>
  );
}
