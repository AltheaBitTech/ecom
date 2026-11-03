'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper — the only client JS on the marketing page. The content
 * is server-rendered (SEO-safe); this just toggles a class when the element
 * scrolls into view so the CSS transition in globals.css runs. Honors
 * prefers-reduced-motion via the CSS itself. `delay` staggers grouped items.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  as?: 'div' | 'li' | 'section' | 'span';
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // threshold 0.01: fires as soon as any part is visible. A tall section
      // (e.g. the hero) can sit on screen at 0.15 threshold — a section taller
      // than the viewport by 15% would then never cross it on initial paint,
      // staying invisible until the next scroll re-triggers the observer.
      { threshold: 0.01, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
