'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Horizontal snap-scroller with round prev/next controls, matching the reference layout's destination scroller. */
export function CardScroller({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="mb-6 flex justify-end gap-3">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="grid size-12 place-items-center rounded-full border border-[#d9c9ac] bg-white text-[#1d2b2e] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0e3a41] hover:text-white hover:shadow-md dark:border-white/15 dark:bg-card dark:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="grid size-12 place-items-center rounded-full border border-[#d9c9ac] bg-white text-[#1d2b2e] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0e3a41] hover:text-white hover:shadow-md dark:border-white/15 dark:bg-card dark:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {children}
      </div>
    </div>
  );
}
