'use client';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useCartCount } from '@/lib/cart';
import { useStore, StoreLoading } from '@/components/storefront/store-provider';
import { CartLines, QuoteSummary, useQuote } from '@/components/storefront/cart-content';
export default function CartPage() {
  const { store } = useStore(); const quote = useQuote(); const count = useCartCount();
  if (!store) return <StoreLoading />;
  return <div className="store-container store-section"><Link href="/store/products" className="store-text-link mb-7"><ArrowLeft size={16} />Keep exploring</Link><p className="store-eyebrow">Your collection of good things</p><h1 className="store-page-title">In the bag.</h1><div className="mt-8 grid gap-10 lg:grid-cols-[1fr_370px]"><div><p className="border-b pb-4 text-sm text-muted-foreground">{count} {count === 1 ? 'item' : 'items'}</p><CartLines /></div>{count > 0 && <aside className="cart-summary"><QuoteSummary {...quote} />{quote.quote && !quote.loading && <Link href="/checkout" className="store-button mt-6 w-full">Continue to checkout <ArrowUpRight size={17} /></Link>}<p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} />Secure checkout with Razorpay</p><Link href="/store/offers" className="store-text-link mt-5 text-sm">Explore available promo codes</Link></aside>}</div></div>;
}
