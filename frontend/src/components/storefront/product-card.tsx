import Link from 'next/link';

import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';

import { QuickAddButton } from './add-to-cart';
import { Stars } from './stars';

export function ProductCard({ tenant, product, index = 0, dark = false }: { tenant: string; product: Product; index?: number; dark?: boolean }) {
  const image = product.images?.[0];
  const href = `/${tenant}/products/${product.id}`;
  const soldOut = product.stock === 0;
  const onSale = !!product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents;
  return (
    <div className="store-product group">
      {/* image is first child so [data-style] media overrides still target it; a
          full-cover Link makes the image navigate, while quick-add sits above it. */}
      <div className="store-product-media relative aspect-square overflow-hidden rounded-[1.4rem] bg-[#e4ded3]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-5xl font-bold text-black/10">{product.name.charAt(0)}</div>
        )}
        <Link href={href} className="absolute inset-0 z-1" aria-label={product.name} />
        {onSale && <span className="store-product-sale absolute left-3 top-3 z-2">Sale</span>}
        {soldOut && <span className="absolute bottom-3 left-3 z-2 rounded-full bg-[#151517] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-white">Sold out</span>}
        {!soldOut && !onSale && (product.is_bestseller || product.badge || product.is_featured) && (
          <span className="absolute left-3 top-3 z-2 rounded-full bg-[#151517] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-white">
            {product.is_bestseller ? 'Bestseller' : product.badge || 'Featured'}
          </span>
        )}
        {!soldOut && (
          <div className="store-product-quickadd absolute inset-x-3 bottom-3 z-2">
            <QuickAddButton product={product} />
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-1 pt-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 font-display text-sm font-bold tracking-[-.02em] sm:text-base">
            <Link href={href}>{product.name}</Link>
          </h3>
          <Stars product={product} className="mt-1" />
          <p className={`mt-1 text-[10px] uppercase tracking-[.12em] ${dark ? 'text-white/35' : 'text-black/35'}`}>Explore product</p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold">
          {formatMoney(product.price_cents, product.currency)}
          {onSale && <span className={`block text-[10px] font-normal line-through ${dark ? 'text-white/35' : 'text-black/35'}`}>{formatMoney(product.compare_at_price_cents!, product.currency)}</span>}
        </p>
      </div>
    </div>
  );
}
