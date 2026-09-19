'use client';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { OfferCard } from '@/components/storefront/offers';
import { useStore, StoreLoading } from '@/components/storefront/store-provider';
import { ProductSection } from '@/components/storefront/product-card';
import { isOnSale } from '@/lib/storefront';
export default function OffersPage() {
  const { store } = useStore();
  if (!store) return <StoreLoading />;
  return <><div className="store-container store-section"><p className="store-eyebrow">A little more to love</p><h1 className="store-page-title">Good finds. Better prices.</h1><p className="mt-4 max-w-xl text-muted-foreground">Explore current offers. Add a code to your bag and we’ll apply the savings when your order qualifies.</p><div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{store.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>{!store.offers.length && <div className="store-empty"><h2>No promo codes right now.</h2><p>Check back for the next offer, or explore the collection.</p><Link className="store-button" href="/store/products">Continue shopping</Link></div>}</div><ProductSection products={store.products.filter(isOnSale)} title="A few very good deals." eyebrow="On sale" href="/store/products?sale=1" /></>;
}
