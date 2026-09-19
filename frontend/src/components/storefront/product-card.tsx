'use client';

import { StoreLink as Link } from '@/components/storefront/store-link';
import { useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, Package, Plus, Check, Star, Heart } from 'lucide-react';
import { toast } from 'sonner';
import type { StorefrontProduct } from '@/lib/types';
import { addToCart, getCart, cartStorageKey } from '@/lib/cart';
import { money, price } from '@/lib/storefront';
import { useStore } from './store-provider';

// ponytail: wishlist is a client-only starred list (localStorage, scoped per store like the cart's
// coupon key) — no backend model for it yet, add one if wishlists need to survive across devices.
const wishlistEvent = 'store-wishlist';
const wishlistKey = () => `${cartStorageKey()}:wishlist`;
const emptyWishlist: string[] = [];
// useSyncExternalStore requires getSnapshot to return the same reference until something actually
// changes, so cache the parsed array against the raw string it came from.
let wishlistCache: { raw: string | null; parsed: string[] } = { raw: null, parsed: emptyWishlist };
function readWishlist(): string[] {
  let raw: string | null;
  try { raw = localStorage.getItem(wishlistKey()); } catch { raw = null; }
  if (raw === wishlistCache.raw) return wishlistCache.parsed;
  let parsed: string[] = emptyWishlist;
  try {
    const value = raw ? JSON.parse(raw) : [];
    if (Array.isArray(value)) parsed = value.filter((id): id is string => typeof id === 'string');
  } catch { /* corrupt storage — treat as empty */ }
  wishlistCache = { raw, parsed };
  return parsed;
}
function subscribeWishlist(fn: () => void) {
  window.addEventListener(wishlistEvent, fn);
  window.addEventListener('storage', fn);
  return () => { window.removeEventListener(wishlistEvent, fn); window.removeEventListener('storage', fn); };
}
export function toggleWishlist(productId: string) {
  const current = readWishlist();
  const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
  try { localStorage.setItem(wishlistKey(), JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event(wishlistEvent));
}
export function useWishlist(): string[] {
  return useSyncExternalStore(subscribeWishlist, readWishlist, () => emptyWishlist);
}

export function ProductImage({ src, alt, className = '', eager = false }: { src?: string | null; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    // eslint-disable-next-line @next/next/no-img-element -- merchant-hosted product images
    <img src={src} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(src)} />
  ) : <div className={`product-placeholder ${className}`} role="img" aria-label={alt}><Package size={44} strokeWidth={1} /></div>;
}
export function ProductCard({ product: p }: { product: StorefrontProduct }) {
  const { store, setCartOpen } = useStore();
  const [variantId, setVariantId] = useState(p.variants[0]?.id);
  const [added, setAdded] = useState(false);
  const images = p.images.length ? p.images : p.imageUrl ? [p.imageUrl] : [];
  const [imageIndex, setImageIndex] = useState(0);
  const variant = p.variants.find((v) => v.id === variantId);
  const { current, original } = price(p, variant);
  const reviews = store?.reviews.filter((r) => r.productId === p.id) ?? [];
  const wishlisted = useWishlist().includes(p.id);
  function add() {
    const quantity = getCart().filter((l) => l.productId === p.id).reduce((sum, l) => sum + l.quantity, 0);
    if (quantity >= p.stock) { toast.error('You’ve added all the available stock'); return; }
    addToCart(p.id, variant?.id, 1);
    setAdded(true);
    setCartOpen(true);
  }
  return <article className="product-card">
    <Link href={`/store/products/${p.id}`} className="product-card-image">
      <ProductImage src={images[imageIndex] ?? p.imageUrl} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute left-3 top-3 flex max-w-[calc(100%-64px)] flex-wrap gap-1.5">
        {original && <span className="store-badge sale">{Math.round((1 - current / original) * 100)}% off</span>}
        {!original && p.featured && <span className="store-badge">Our pick</span>}
        {p.stock === 0 && <span className="store-badge">Sold out</span>}
        {p.labels.slice(0, 2).map((label) => <span key={label} className="store-badge">{label}</span>)}
      </div>
      <button type="button" className="product-wish" aria-label={wishlisted ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`} aria-pressed={wishlisted} onClick={(e) => { e.preventDefault(); toggleWishlist(p.id); }}>
        <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
      </button>
      {images.length > 1 && <div className="product-dots" aria-hidden>{images.map((_, i) => <span key={i} className={i === imageIndex ? 'active' : ''} onClick={(e) => { e.preventDefault(); setImageIndex(i); }} />)}</div>}
      <span className="product-explore" aria-hidden><ArrowUpRight size={18} /></span>
    </Link>
    <div className="pt-4">
      <p className="store-eyebrow !mb-1">{p.category}</p>
      <Link href={`/store/products/${p.id}`}><h3 className="text-lg leading-snug">{p.name}</h3></Link>
      {reviews.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Star size={12} fill="currentColor" />{(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} · {reviews.length} review{reviews.length === 1 ? '' : 's'}</p>}
      <div className="my-3 flex flex-wrap items-baseline gap-2"><strong>{money(current, p.currency)}</strong>{original && <del className="text-sm text-muted-foreground">{money(original, p.currency)}</del>}</div>
      {p.variants.length > 0 && <select className="store-input mb-2 !min-h-10 !text-xs" aria-label={`Option for ${p.name}`} value={variantId} onChange={(e) => { setVariantId(e.target.value); setAdded(false); }}>{p.variants.map((v) => <option key={v.id} value={v.id}>{v.label} · {money(v.priceCents, p.currency)}</option>)}</select>}
      <button className="store-add" disabled={!p.stock} onClick={add}>{added ? <Check size={16} /> : <Plus size={16} />}{p.stock ? added ? 'Added · add another' : 'Add to bag' : 'Out of stock'}</button>
    </div>
  </article>;
}
export function ProductSection({ title, eyebrow, products, href }: { title: string; eyebrow: string; products: StorefrontProduct[]; href: string }) {
  if (!products.length) return null;
  return <section className="store-container store-section"><div className="section-heading"><div><p className="store-eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link href={href} className="store-text-link">View collection <ArrowUpRight size={17} /></Link></div><div className="product-grid">{products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}</div></section>;
}
