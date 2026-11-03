import { notFound } from 'next/navigation';

import { ProductPurchase } from '@/components/storefront/product-purchase';
import { Stars } from '@/components/storefront/stars';
import { StorePanel } from '@/components/storefront/store-page';
import { Badge } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';

/** Product detail. Custom attributes render generically as a spec list — the UI
 *  never knows whether it's showing an expiry date or a fabric, which is exactly
 *  what keeps the storefront category-agnostic. */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant, id } = await params;

  let product: Product;
  try {
    const store = await ecomApi.resolveStore(tenant);
    product = await ecomApi.storefrontProduct(store.tenant_id, id);
  } catch {
    notFound();
  }

  // Hide keys we render with dedicated UI (stars, variant chips) from the spec list.
  const HIDDEN = new Set(['rating', 'rating_count', 'variants']);
  const attributes = Object.entries(product.custom_attributes ?? {}).filter(([key]) => !HIDDEN.has(key));

  return (
    <article className="store-subpage store-product-detail">
      <a href={`/${tenant}/products`} className="store-back-link">← Back to shop</a>
      <div className="store-product-layout">
        <div className="store-product-gallery">
          <div className="store-product-main-image">
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="store-product-placeholder">{product.name.charAt(0)}</div>
          )}
          </div>
          {product.images.length > 1 && (
            <div className="store-product-thumbs">
              {product.images.slice(1, 4).map((image, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={image} src={image} alt={`${product.name} view ${index + 2}`} />
              ))}
            </div>
          )}
        </div>

        <section className="store-product-copy">
          <p className="store-product-kicker">{product.badge || (product.is_bestseller ? 'Bestseller' : 'The collection')}</p>
          <h1>{product.name}</h1>
          <Stars product={product} className="store-product-stars" />
          <div className="store-product-price">
            <span>{formatMoney(product.price_cents, product.currency)}</span>
            {product.compare_at_price_cents && <del>{formatMoney(product.compare_at_price_cents, product.currency)}</del>}
          </div>
          <div className="mt-4">
          {product.stock > 0 ? (
            <Badge tone="success">In stock · ready to ship</Badge>
          ) : (
            <Badge tone="warning">Out of stock</Badge>
          )}
        </div>

          {product.description && <p className="store-product-description">{product.description}</p>}

        {attributes.length > 0 && (
          <dl className="store-spec-list">
            {attributes.map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/_/g, ' ')}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-8">
          <ProductPurchase tenant={tenant} product={product} />
        </div>
          <StorePanel className="store-product-assurance">
            <span>↗ Fast dispatch</span><span>◇ Secure payment</span><span>↺ Simple returns</span>
          </StorePanel>
        </section>
      </div>
    </article>
  );
}
