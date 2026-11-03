'use client';

import { animate, createScope, stagger } from 'animejs';
import { useEffect, useRef } from 'react';

export function StoreMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let scope: ReturnType<typeof createScope> | undefined;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scope = createScope({ root }).add(() => {
          // The headline/CTA (.store-hero-copy) used to fade in from opacity:0
          // too — but that leaves the most important content on the page
          // invisible until this effect fires, which can take a beat (slow
          // hydration, first paint). Real content should never depend on JS
          // timing to be visible, so only decorative elements animate in.
          animate('.store-hero-categories', {
            opacity: { from: 0 },
            y: { from: 34 },
            delay: stagger(90),
            duration: 900,
            ease: 'outExpo',
          });
          animate('.store-hero-tile', {
            opacity: { from: 0 },
            scale: { from: 0.88 },
            delay: stagger(70, { start: 180 }),
            duration: 1100,
            ease: 'outExpo',
          });
        });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      scope?.revert();
    };
  }, []);

  return <div ref={root}>{children}</div>;
}
