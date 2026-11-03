'use client';

import { animate, createScope, createTimeline, stagger } from 'animejs';
import { useEffect, useRef, type PointerEvent } from 'react';

export function StorePlayground() {
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scope = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: 'outExpo' } })
        .add('.scene-frame', { opacity: { from: 0 }, scale: { from: 0.86 }, duration: 1100 })
        .add('.scene-item', {
          opacity: { from: 0 },
          y: { from: 36 },
          scale: { from: 0.82 },
          delay: stagger(90),
          duration: 900,
        }, '-=700');

      animate('.float-card', {
        y: stagger([-8, 8]),
        duration: stagger([2600, 3600]),
        ease: 'inOutSine',
        loop: true,
        alternate: true,
      });

      animate('.scene-orb', {
        scale: [0.88, 1.08],
        rotate: '1turn',
        duration: 9000,
        ease: 'inOutSine',
        loop: true,
        alternate: true,
      });
    });

    return () => scope.revert();
  }, []);

  function moveScene(event: PointerEvent<HTMLDivElement>) {
    if (!scene.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    animate(scene.current, {
      rotateX: -y * 7,
      rotateY: x * 10,
      duration: 500,
      ease: 'outExpo',
    });
  }

  function resetScene() {
    if (!scene.current) return;
    animate(scene.current, { rotateX: 0, rotateY: 0, duration: 800, ease: 'outExpo' });
  }

  return (
    <div
      ref={root}
      className="hero-scene relative mx-auto w-full max-w-[620px]"
      onPointerMove={moveScene}
      onPointerLeave={resetScene}
    >
      <div aria-hidden className="scene-orb absolute left-[10%] top-[2%] h-40 w-40 rounded-full bg-[#cdddff] blur-[1px] sm:h-52 sm:w-52" />
      <div aria-hidden className="absolute bottom-[5%] right-[1%] h-28 w-28 rounded-full bg-[#dfff73] blur-[1px] sm:h-36 sm:w-36" />

      <div ref={scene} className="scene-frame relative mx-auto aspect-5/6 w-[82%] transform-3d sm:aspect-square">
        <div className="scene-item absolute inset-[12%_4%_10%_7%] rounded-4xl border border-black/10 bg-white p-3 shadow-[0_45px_90px_-30px_rgba(28,37,54,.32)] transform-[translateZ(20px)_rotateZ(-2deg)] sm:p-4">
          <div className="flex h-full flex-col overflow-hidden rounded-[1.4rem] bg-[#f6f5ef]">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-[#171719]">
              <span className="font-display text-sm font-bold tracking-tight">MOSS / GOODS</span>
              <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[.16em]">
                <span>Shop</span><span>About</span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#171719] text-white">2</span>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden bg-[#e9edff] p-5 sm:p-7">
              <p className="text-[9px] font-bold uppercase tracking-[.24em] text-black/50">New collection / 2026</p>
              <p className="mt-2 max-w-[75%] font-display text-3xl font-bold leading-[.86] tracking-[-.07em] text-[#171719] sm:text-5xl">
                LESS, BUT<br />BETTER.
              </p>
              <div className="absolute bottom-[-8%] right-[2%] h-[70%] w-[62%] rotate-[-18deg] rounded-[55%_45%_48%_52%] bg-[#758cff] shadow-[inset_-22px_-28px_50px_rgba(31,47,140,.2)]">
                <div className="absolute left-[14%] top-[24%] h-[26%] w-[74%] rotate-[9deg] rounded-[50%] border-10 border-[#171719] bg-[#dfff73] shadow-xl sm:border-14" />
                <div className="absolute bottom-[16%] left-[14%] h-[12%] w-[72%] rounded-full bg-[#171719]" />
              </div>
              <span className="absolute bottom-5 left-5 rounded-full bg-[#171719] px-4 py-2 text-[9px] font-bold uppercase tracking-[.16em] text-white sm:left-7">
                Explore drop ↗
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-[9px] font-bold uppercase tracking-[.12em] text-[#171719]">
              <span>Free shipping over ₹999</span><span>01 / 04</span>
            </div>
          </div>
        </div>

        <div className="float-card scene-item absolute right-[-7%] top-[15%] rounded-2xl border border-white/15 bg-white/90 p-3 text-[#171719] shadow-2xl backdrop-blur-sm transform-[translateZ(90px)_rotateZ(5deg)] sm:right-[-12%] sm:p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dfff73] text-lg">✓</span>
            <div><p className="text-[10px] text-black/45">Order #1842</p><p className="text-xs font-bold">Payment complete</p></div>
          </div>
        </div>

        <div className="float-card scene-item absolute left-[-10%] bottom-[11%] w-40 rounded-2xl border border-black/10 bg-white/95 p-4 text-[#171719] shadow-2xl backdrop-blur-sm transform-[translateZ(110px)_rotateZ(-5deg)] sm:left-[-14%] sm:w-48">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-black/45">Sales today</span>
            <span className="rounded-full bg-[#e9edff] px-2 py-1 text-[9px] text-[#4059d6]">+24.8%</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold">₹1,28,400</p>
          <svg className="mt-3 h-8 w-full" viewBox="0 0 160 32" fill="none" aria-hidden>
            <path d="M1 29C18 27 21 17 36 20S57 27 72 15s22 8 34 3 18-17 29-10 16-2 24-7" stroke="#657cf2" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="float-card scene-item absolute bottom-[4%] right-[-3%] grid h-16 w-16 place-items-center rounded-full border border-black/10 bg-[#171719] text-xl text-white shadow-2xl transform-[translateZ(130px)] sm:h-20 sm:w-20 sm:text-2xl">
          ↗
        </div>
      </div>
    </div>
  );
}
