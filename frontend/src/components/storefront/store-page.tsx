import type { ReactNode } from 'react';

export function StorePage({ eyebrow, title, intro, children, className = '' }: { eyebrow?: string; title?: string; intro?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`store-subpage ${className}`}>
      {(eyebrow || title || intro) && (
        <header className="store-page-heading">
          {eyebrow && <p>{eyebrow}</p>}
          {title && <h1>{title}</h1>}
          {intro && <span>{intro}</span>}
        </header>
      )}
      {children}
    </div>
  );
}

export function StorePanel({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'aside' }) {
  const Component = as;
  return <Component className={`store-panel ${className}`}>{children}</Component>;
}
