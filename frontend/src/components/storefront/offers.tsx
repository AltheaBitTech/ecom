'use client';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { ArrowUpRight, Copy, Check, TicketPercent } from 'lucide-react';
import { useState } from 'react';
import type { Offer } from '@/lib/types';
import { money } from '@/lib/storefront';
import { setCoupon } from './cart-content';
import { useStore } from './store-provider';
export function OfferCard({ offer }: { offer: Offer }) {
  const { store } = useStore();
  const [applied, setApplied] = useState(false);
  const currency = store?.products[0]?.currency ?? 'INR';
  return <article className="offer-card"><div className="flex items-start justify-between"><TicketPercent size={27} strokeWidth={1.4} /><span className="store-badge">Limited-time offer</span></div><p className="offer-value">{offer.kind === 'percent' ? `${offer.value}%` : money(offer.value, currency)}<span> off</span></p><h2 className="text-2xl">{offer.title}</h2><p className="mt-2 text-sm text-muted-foreground">{offer.description}</p><p className="mt-3 text-xs text-muted-foreground">{offer.minimumCents ? `Orders from ${money(offer.minimumCents, currency)}. ` : 'No minimum spend. '}{offer.maximumDiscountCents ? `Save up to ${money(offer.maximumDiscountCents, currency)}. ` : ''}Ends {new Date(offer.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. One code per order.</p><div className="mt-6 flex items-center justify-between gap-3 border-t border-dashed pt-4"><code className="text-base font-semibold tracking-wider">{offer.code}</code><button className="store-text-link" onClick={() => { setCoupon(offer.code); setApplied(true); }}>{applied ? <Check size={15} /> : <Copy size={15} />}{applied ? 'Added to bag' : 'Use code'}</button></div></article>;
}
export function OffersBanner() {
  const { store } = useStore();
  const offer = store?.offers[0];
  if (!offer) return null;
  return <section className="store-container store-section"><div className="promo-banner"><div><p className="store-eyebrow">A little extra, just for you</p><h2>{offer.title}</h2><p className="mt-3 max-w-lg opacity-80">{offer.description || `Use ${offer.code} at checkout to save on your favourites.`}</p><Link href="/store/offers" className="store-button mt-6">Explore the offers <ArrowUpRight size={17} /></Link></div><div className="promo-stamp" aria-hidden><span>YOUR NEXT GOOD FIND</span><strong>{offer.kind === 'percent' ? `${offer.value}%` : money(offer.value, store?.products[0]?.currency)}</strong><span>OFF WITH {offer.code}</span></div></div></section>;
}
