'use client';

import { StoreLink as Link } from '@/components/storefront/store-link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Minus, Plus, Trash2, TicketPercent, Truck, ShoppingBag } from 'lucide-react';
import { useCartLines, updateQuantity, removeFromCart, cartStorageKey } from '@/lib/cart';
import { api } from '@/lib/api';
import type { CartQuote } from '@/lib/types';
import { money } from '@/lib/storefront';
import { useStore } from './store-provider';
import { ProductImage } from './product-card';

const couponEvent = 'store-coupon';
const subscribe = (fn: () => void) => { window.addEventListener(couponEvent, fn); window.addEventListener('storage', fn); return () => { window.removeEventListener(couponEvent, fn); window.removeEventListener('storage', fn); }; };
const snapshot = () => { try { return localStorage.getItem(`${cartStorageKey()}:coupon`) ?? ''; } catch { return ''; } };
export function setCoupon(code: string) { try { localStorage.setItem(`${cartStorageKey()}:coupon`, code.trim().toUpperCase()); } catch { /* Storage may be disabled. */ } window.dispatchEvent(new Event(couponEvent)); }
export function useQuote(fulfillment = 'delivery') {
  const { preview } = useStore();
  const lines = useCartLines();
  const key = JSON.stringify(lines);
  const coupon = useSyncExternalStore(subscribe, snapshot, () => '');
  const [result, setResult] = useState<{ key: string; quote: CartQuote | null; error: string | null } | null>(null);
  const requestKey = `${key}:${coupon}:${fulfillment}:${preview}`;
  useEffect(() => {
    let active = true;
    if (!JSON.parse(key).length) return;
    api<CartQuote>(preview ? '/storefront/admin/quote' : '/storefront/quote', { method: 'POST', body: { items: JSON.parse(key), couponCode: coupon || undefined, fulfillment }, skipAuthRetry: !preview })
      .then((quote) => { if (active) setResult({ key: requestKey, quote, error: null }); })
      .catch((e: Error) => { if (active) setResult({ key: requestKey, quote: null, error: e.message }); });
    return () => { active = false; };
  }, [key, coupon, fulfillment, requestKey, preview]);
  const current = result?.key === requestKey ? result : null;
  return { quote: current?.quote ?? null, error: current?.error ?? null, loading: lines.length > 0 && !current, coupon };
}
export function CartLines({ compact = false }: { compact?: boolean }) {
  const { store, setCartOpen } = useStore();
  const lines = useCartLines();
  if (!lines.length) return <div className="store-empty"><ShoppingBag size={35} /><h2>Your bag is waiting.</h2><p>Find a little something you’ll love.</p><Link className="store-button" href="/store/products" onClick={() => setCartOpen(false)}>Explore the collection</Link></div>;
  return <div className="divide-y">{lines.map((line) => {
    const p = store?.products.find((p) => p.id === line.productId);
    const variant = p?.variants.find((v) => v.id === line.variantId);
    const unavailable = !p || (!!line.variantId && !variant) || (!line.variantId && !!p.variants.length);
    const current = variant?.priceCents ?? p?.priceCents ?? 0;
    const allQuantity = lines.filter((l) => l.productId === line.productId).reduce((sum, l) => sum + l.quantity, 0);
    return <div key={`${line.productId}:${line.variantId}`} className="flex gap-3 py-5 sm:gap-5">
      <Link href={p ? `/store/products/${p.id}` : '/store/products'} onClick={() => setCartOpen(false)} className="shrink-0"><ProductImage src={p?.imageUrl} alt={p?.name ?? 'Unavailable product'} className={`${compact ? 'size-16' : 'size-20 sm:size-24'} rounded-xl object-cover`} /></Link>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{p?.category}</p><Link href={p ? `/store/products/${p.id}` : '/store/products'} onClick={() => setCartOpen(false)} className="font-medium">{p?.name ?? 'Unavailable product'}</Link>{variant && <p className="text-xs text-muted-foreground">{variant.label}</p>}
        {unavailable || !p?.stock ? <p className="text-sm text-destructive">No longer available. Please remove this item.</p> : <div className="quantity-control mt-3"><button aria-label={`Decrease ${p.name}`} onClick={() => updateQuantity(p.id, line.variantId, line.quantity - 1)}><Minus size={14} /></button><span>{line.quantity}</span><button aria-label={`Increase ${p.name}`} disabled={allQuantity >= p.stock} onClick={() => updateQuantity(p.id, line.variantId, line.quantity + 1)}><Plus size={14} /></button></div>}
        {p && allQuantity > p.stock && <p className="mt-2 text-xs text-destructive">Only {p.stock} available across all options.</p>}
      </div><div className="flex flex-col items-end justify-between gap-4"><strong className="whitespace-nowrap text-sm">{money(current * line.quantity, p?.currency)}</strong><button className="store-icon" aria-label={`Remove ${p?.name ?? 'item'}`} onClick={() => removeFromCart(line.productId, line.variantId)}><Trash2 size={16} /></button></div>
    </div>;
  })}</div>;
}
export function PromoCode({ coupon }: { coupon: string }) {
  const [input, setInput] = useState('');
  return <div className="my-5 border-y py-4"><label htmlFor="promo-code" className="mb-2 flex items-center gap-2 text-sm font-medium"><TicketPercent size={17} />Have a promo code?</label>{coupon ? <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{coupon}</span><button type="button" onClick={() => { setCoupon(''); setInput(''); }} className="store-text-link">Remove</button></div> : <div className="flex gap-2"><input id="promo-code" className="store-input min-w-0 uppercase" placeholder="Enter code" maxLength={30} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setCoupon(input); } }} /><button type="button" className="store-button secondary !px-4" disabled={!input.trim()} onClick={() => setCoupon(input)}>Apply</button></div>}</div>;
}
export function QuoteSummary({ quote, error, loading, coupon }: ReturnType<typeof useQuote>) {
  const { store } = useStore();
  const threshold = store?.settings.freeShippingThresholdCents;
  return <div aria-live="polite"><h2 className="text-xl">Order summary</h2><PromoCode coupon={coupon} />{loading && <p className="py-4 text-sm text-muted-foreground" role="status">Updating your total…</p>}{error && <p className="my-4 text-sm text-destructive" role="alert">{error}</p>}{quote && <>
    {coupon && <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">Code applied. You saved {money(quote.discountCents, quote.currency)}.</p>}
    <dl className="grid gap-3 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{money(quote.subtotalCents, quote.currency)}</dd></div>{quote.discountCents > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>Discount</dt><dd>−{money(quote.discountCents, quote.currency)}</dd></div>}<div className="flex justify-between"><dt>Delivery</dt><dd>{quote.shippingCents ? money(quote.shippingCents, quote.currency) : 'Free'}</dd></div>{quote.taxCents > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{money(quote.taxCents, quote.currency)}</dd></div>}<div className="mt-2 flex justify-between border-t pt-4 text-lg font-semibold"><dt>Total</dt><dd>{money(quote.totalCents, quote.currency)}</dd></div></dl>
    {threshold != null && threshold > 0 && <div className="mt-5 rounded-xl bg-background p-3"><p className="flex items-center gap-2 text-xs"><Truck size={16} />{quote.remainingForFreeShippingCents ? `${money(quote.remainingForFreeShippingCents, quote.currency)} away from free delivery` : 'Free delivery unlocked'}</p><progress className="mt-2 h-1.5 w-full accent-primary" max={threshold} value={threshold - (quote.remainingForFreeShippingCents ?? 0)} aria-label="Progress towards free delivery" /></div>}
  </>}</div>;
}
