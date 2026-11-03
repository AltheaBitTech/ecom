'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AttributeFields } from '@/components/admin/attribute-fields';
import { Button } from '@/components/ui/button';
import { createProduct, updateProduct } from '@/app/(admin)/admin/(dashboard)/products/actions';
import type { Category, Product, ProductInput } from '@/lib/types';

const STATUSES: Product['status'][] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

/** Live preview of the entered image URLs — first is the cover. Plain <img> so
 *  arbitrary external hosts render without next/image domain config. */
function ImageGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {urls.slice(0, 12).map((url, i) => (
        <div key={`${url}-${i}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-paper-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.opacity = '0.25'; }} />
          {i === 0 && (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Cover</span>
          )}
        </div>
      ))}
    </div>
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create/edit a product. Core fields are fixed; the custom-attribute section is
 * generated from the store's schema (AttributeFields). Prices are entered in the
 * major unit and converted to the integer minor unit the backend expects.
 */
export function ProductForm({
  mode,
  categories,
  currency,
  attributeSchema,
  product,
}: {
  mode: 'create' | 'edit';
  categories: Category[];
  currency: string;
  attributeSchema: Record<string, unknown>;
  product?: Product;
}) {
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? (product.price_cents / 100).toString() : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [compareAtPrice, setCompareAtPrice] = useState(product?.compare_at_price_cents ? (product.compare_at_price_cents / 100).toString() : '');
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [isBestseller, setIsBestseller] = useState(product?.is_bestseller ?? false);
  const [badge, setBadge] = useState(product?.badge ?? '');
  const [status, setStatus] = useState<Product['status']>(product?.status ?? 'DRAFT');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [images, setImages] = useState((product?.images ?? []).join('\n'));
  const [attributes, setAttributes] = useState<Record<string, unknown>>(product?.custom_attributes ?? {});
  // Merchandising extras stored inside custom_attributes.
  const initialAttrs = product?.custom_attributes ?? {};
  const [rating, setRating] = useState(initialAttrs.rating != null ? String(initialAttrs.rating) : '');
  const [ratingCount, setRatingCount] = useState(initialAttrs.rating_count != null ? String(initialAttrs.rating_count) : '');
  const [variants, setVariants] = useState(Array.isArray(initialAttrs.variants) ? (initialAttrs.variants as unknown[]).join(', ') : '');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceValue = Number(price);
    if (Number.isNaN(priceValue) || priceValue < 0) {
      setError('Enter a valid price.');
      return;
    }

    const compareAtValue = compareAtPrice ? Number(compareAtPrice) : null;
    if (compareAtValue !== null && (Number.isNaN(compareAtValue) || compareAtValue <= priceValue)) {
      setError('Compare-at price must be greater than the selling price.');
      return;
    }

    const imageUrls = images.split('\n').map((value) => value.trim()).filter(Boolean);
    const invalidImage = imageUrls.find((value) => {
      try { return !['http:', 'https:'].includes(new URL(value).protocol); } catch { return true; }
    });
    if (invalidImage) {
      setError(`Invalid image URL: ${invalidImage}`);
      return;
    }
    if (imageUrls.length > 12) {
      setError('Add no more than 12 product images.');
      return;
    }
    if (!categoryId) {
      setError('Choose a category for this product.');
      return;
    }
    if (status === 'ACTIVE' && imageUrls.length === 0) {
      setError('Add at least one image before publishing this product.');
      return;
    }

    const ratingValue = rating ? Number(rating) : null;
    if (ratingValue !== null && (Number.isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5)) {
      setError('Rating must be between 0 and 5.');
      return;
    }
    const variantList = variants.split(',').map((v) => v.trim()).filter(Boolean);
    const mergedAttributes: Record<string, unknown> = { ...attributes };
    if (ratingValue !== null) mergedAttributes.rating = ratingValue; else delete mergedAttributes.rating;
    if (ratingCount) mergedAttributes.rating_count = Number(ratingCount) || 0; else delete mergedAttributes.rating_count;
    if (variantList.length) mergedAttributes.variants = variantList; else delete mergedAttributes.variants;

    const payload: ProductInput = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      price_cents: Math.round(priceValue * 100),
      stock: Number(stock) || 0,
      compare_at_price_cents: compareAtValue === null ? null : Math.round(compareAtValue * 100),
      is_featured: isFeatured,
      is_bestseller: isBestseller,
      badge: badge.trim() || null,
      status,
      category_id: categoryId || null,
      images: imageUrls,
      custom_attributes: mergedAttributes,
    };

    setPending(true);
    try {
      const result =
        mode === 'create'
          ? await createProduct(payload)
          : await updateProduct(product!.id, payload);

      if (!result.ok) {
        setError(result.error?.message ?? 'Could not save the product.');
        return;
      }
      router.push('/admin/products');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-soft">Details</h2>
        <div>
          <label htmlFor="name" className="label">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="slug" className="label">
            URL slug <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            className="input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Lowercase letters, numbers and single hyphens"
          />
        </div>
        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            className="input min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
          />
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-soft">Pricing &amp; inventory</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className="label">
              Price ({currency}) <span className="text-red-500">*</span>
            </label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="compare-at-price" className="label">Compare-at price ({currency})</label>
            <input id="compare-at-price" type="number" step="0.01" min="0" className="input" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Optional original price" />
          </div>
          <div>
            <label htmlFor="stock" className="label">
              Stock
            </label>
            <input
              id="stock"
              type="number"
              step="1"
              min="0"
              className="input"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <select
              id="status"
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as Product['status'])}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="category" className="label">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-5 p-6">
        <div><h2 className="text-sm font-semibold text-ink-soft">Storefront merchandising</h2><p className="mt-1 text-xs text-ink-faint">Control product labels and premium homepage placement.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper-soft p-4">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4 accent-[#ff5c35]" />
            <span><strong className="block text-sm">Featured</strong><span className="text-xs text-ink-faint">Show in the homepage spotlight.</span></span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper-soft p-4">
            <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} className="h-4 w-4 accent-[#ff5c35]" />
            <span><strong className="block text-sm">Bestseller</strong><span className="text-xs text-ink-faint">Add a high-trust bestseller label.</span></span>
          </label>
        </div>
        <div>
          <label htmlFor="badge" className="label">Custom badge</label>
          <input id="badge" className="input" value={badge} onChange={(e) => setBadge(e.target.value)} maxLength={32} placeholder="Limited drop, Staff pick, New season…" />
          <p className="mt-1 text-xs text-ink-faint">Maximum 32 characters. Bestseller takes priority when enabled.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="rating" className="label">Rating (0–5)</label>
            <input id="rating" type="number" step="0.1" min="0" max="5" className="input" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.5" />
          </div>
          <div>
            <label htmlFor="rating-count" className="label">Number of reviews</label>
            <input id="rating-count" type="number" step="1" min="0" className="input" value={ratingCount} onChange={(e) => setRatingCount(e.target.value)} placeholder="128" />
          </div>
          <div>
            <label htmlFor="variants" className="label">Size / weight options</label>
            <input id="variants" className="input" value={variants} onChange={(e) => setVariants(e.target.value)} placeholder="250g, 500g, 1kg" />
          </div>
        </div>
        <p className="text-xs text-ink-faint">Stars show on the storefront when a rating is set. Comma-separated size options appear as a picker on the product page (display-only, one price).</p>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-soft">Images</h2>
        <textarea
          className="input min-h-24"
          placeholder="One image URL per line"
          value={images}
          onChange={(e) => setImages(e.target.value)}
          maxLength={12000}
        />
        <p className="text-xs text-ink-faint">One full http(s) URL per line, up to 12 images. The first image is the cover.</p>
        <ImageGrid urls={images.split('\n').map((u) => u.trim()).filter(Boolean)} />
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-soft">Custom attributes</h2>
        <AttributeFields schema={attributeSchema} value={attributes} onChange={setAttributes} />
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
        <Button type="button" variant="secondary" href="/admin/products">
          Cancel
        </Button>
      </div>
    </form>
  );
}
