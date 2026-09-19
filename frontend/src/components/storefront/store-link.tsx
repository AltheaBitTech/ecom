'use client';
import NextLink from 'next/link';
import { useStore } from './store-provider';

/** Keeps the shopper inside the same store (?preview=1 for the owner's preview, ?store=<slug> for a public store). */
export function useStoreHref() {
  const { preview, slug } = useStore();
  return (href: string) => {
    if (!(preview || slug) || !/^\/(store(?:[/?#]|$)|cart|checkout|order-confirmed|orders)/.test(href)) return href;
    const url = new URL(href, 'https://store.invalid');
    if (preview) url.searchParams.set('preview', '1');
    else if (slug) url.searchParams.set('store', slug);
    return `${url.pathname}${url.search}${url.hash}`;
  };
}

export function StoreLink({ href, ...props }: React.ComponentProps<typeof NextLink>) {
  const storeHref = useStoreHref();
  return <NextLink href={typeof href === 'string' ? storeHref(href) : href} {...props} />;
}
