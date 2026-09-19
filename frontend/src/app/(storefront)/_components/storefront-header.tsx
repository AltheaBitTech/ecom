'use client';

import { StoreLink as Link } from '@/components/storefront/store-link';
import { Search, ShoppingBag, Menu, ArrowUpRight, Leaf } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCartCount } from '@/lib/cart';
import { useStore } from '@/components/storefront/store-provider';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CartLines, QuoteSummary, useQuote } from '@/components/storefront/cart-content';

export function StorefrontHeader() {
  const { store, preview, cartOpen, setCartOpen } = useStore();
  const [menu, setMenu] = useState(false);
  const count = useCartCount();
  const pathname = usePathname();
  const links = [{ href: '/store', title: 'Home' }, { href: '/store/products', title: 'Shop all' }, { href: '/store/products?sort=best', title: 'Best sellers' }, { href: '/store/offers', title: 'Offers' }];
  return <>
    {preview && <div className="bg-amber-100 px-5 py-2 text-center text-xs text-amber-950">Admin preview · Checkout is disabled. <Link href="/admin/storefront" className="underline">Back to editor</Link></div>}
    <div className="store-announcement"><span>{store?.settings.announcement ?? 'Discover something you’ll love.'}</span><Link href="/store/offers">Explore offers <ArrowUpRight size={13} /></Link></div>
    <header className="store-header"><div className="store-container flex h-20 items-center justify-between gap-4">
      <Link href="/store" className="store-wordmark"><Leaf size={23} strokeWidth={1.5} /><span>{store?.name ?? 'The Store'}<small>THE EVERYDAY COLLECTION</small></span></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm lg:flex">{links.map((l) => <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined} className="hover:text-primary">{l.title}</Link>)}</nav>
      <div className="flex items-center gap-1 sm:gap-3"><Link href="/store/products?search=1" className="store-icon" aria-label="Search products"><Search size={20} /></Link><button className="store-icon relative" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${count} items`}><ShoppingBag size={20} />{count > 0 && <span className="bag-count">{count}</span>}</button><span className="lg:hidden"><button onClick={() => setMenu(true)} className="store-icon" aria-label="Open menu"><Menu size={22} /></button></span></div>
    </div></header>
    <Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="!w-[min(88vw,360px)] p-6"><SheetTitle>Explore the store</SheetTitle><SheetDescription>Find your next favourite.</SheetDescription><nav className="mt-5 grid gap-5">{links.map((l) => <Link key={l.href} href={l.href} onClick={() => setMenu(false)} className="text-xl">{l.title}</Link>)}</nav><div className="mt-6 border-t pt-5"><p className="store-eyebrow">Shop by category</p>{[...new Set(store?.products.map((p) => p.category) ?? [])].map((category) => <Link key={category} href={`/store/products?category=${encodeURIComponent(category)}`} className="block py-3 text-sm" onClick={() => setMenu(false)}>{category}</Link>)}</div></SheetContent></Sheet>
    <Sheet open={cartOpen} onOpenChange={setCartOpen}><SheetContent className="!w-[min(100vw,440px)] !max-w-[440px] gap-0"><div className="border-b p-6"><SheetTitle>Your bag ({count})</SheetTitle><SheetDescription>A few good things, picked by you.</SheetDescription></div>{cartOpen && <CartDrawer />}</SheetContent></Sheet>
  </>;
}
function CartDrawer() {
  const { setCartOpen, store } = useStore();
  const count = useCartCount();
  const quote = useQuote();
  return <div className="flex min-h-0 flex-1 flex-col"><div className="overflow-y-auto px-5"><CartLines compact /></div>{count > 0 && store && <div className="mt-auto overflow-y-auto border-t bg-muted/40 p-5"><QuoteSummary {...quote} /><Link href="/cart" onClick={() => setCartOpen(false)} className="store-button mt-5 w-full">View bag & checkout <ArrowUpRight size={17} /></Link></div>}</div>;
}
