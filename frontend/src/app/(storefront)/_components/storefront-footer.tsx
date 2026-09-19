'use client';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { Leaf, Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react';
import { useStore } from '@/components/storefront/store-provider';
export function StorefrontFooter() {
  const { store } = useStore();
  return <footer className="store-footer"><div className="store-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr]">
    <div><Link href="/store" className="store-wordmark"><Leaf size={25} />{store?.name ?? 'The Store'}</Link><p className="mt-4 max-w-xs text-sm leading-relaxed opacity-75">{store?.settings.tagline ?? 'Good things for your everyday.'}</p><Link href="/store/products" className="mt-5 inline-flex items-center gap-2 text-sm">Find your next favourite <ArrowUpRight size={16} /></Link></div>
    <div><h2 className="mb-4 text-base">Explore</h2><div className="grid gap-3 text-sm opacity-80"><Link href="/store/products">Shop the collection</Link><Link href="/store/products?sort=best">Best sellers</Link><Link href="/store/offers">Offers & savings</Link><Link href="/store#faq">Frequently asked questions</Link></div></div>
    <div><h2 className="mb-4 text-base">Good to know</h2><div className="grid gap-3 text-sm opacity-80"><Link href="/store#delivery">Delivery & pickup</Link><Link href="/legal/refund-policy">Returns & refunds</Link><Link href="/legal/privacy">Privacy policy</Link><Link href="/legal/terms">Terms of service</Link></div></div>
    <div id="contact"><h2 className="mb-4 text-base">Let’s talk</h2><div className="grid gap-4 text-sm opacity-80">{store?.settings.supportEmail && <a className="flex items-center gap-2 break-all" href={`mailto:${store.settings.supportEmail}`}><Mail size={16} className="shrink-0" />{store.settings.supportEmail}</a>}{store?.settings.phone && <a className="flex items-center gap-2" href={`tel:${store.settings.phone.replace(/[^+\d]/g, '')}`}><Phone size={16} />{store.settings.phone}</a>}{store?.settings.address && <p className="flex items-start gap-2"><MapPin size={17} className="shrink-0" />{store.settings.address}</p>}{!store?.settings.supportEmail && !store?.settings.phone && <p>Contact details will appear here when the store makes them available.</p>}</div></div>
  </div><div className="store-container flex flex-wrap justify-between gap-4 border-t border-white/15 py-6 text-xs opacity-65"><p>© {new Date().getFullYear()} {store?.name ?? 'The Store'}</p><p>Secure payments with Razorpay</p></div></footer>;
}
