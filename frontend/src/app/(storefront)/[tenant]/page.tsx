import { cookies } from 'next/headers';

import { StoreSections, type StoreSearch } from '@/components/storefront/store-sections';
import { ecomApi } from '@/lib/api';
import { getStoreTemplate, normalizeStoreDesign } from '@/lib/store-templates';
import type { ActiveFlashSale, Category, Product, StoreConfig } from '@/lib/types';

export default async function StoreHome({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<StoreSearch> }) {
  const { tenant } = await params;
  const search = await searchParams;
  const query = new URLSearchParams();
  if (search.category) query.set('category_id', search.category);
  if (search.q) query.set('q', search.q);
  query.set('sort', search.sort ?? 'newest');

  let tenantId = '';
  let products: Product[] = [];
  let categories: Category[] = [];
  let flashSales: ActiveFlashSale[] = [];
  let config: StoreConfig | null = null;
  const previewToken = (await cookies()).get('ecom_store_preview')?.value;
  try {
    const store = await ecomApi.resolveStore(tenant);
    tenantId = store.tenant_id;
    [products, categories, flashSales, config] = await Promise.all([
      ecomApi.storefrontProducts(tenantId, `?${query}`).then((page) => page.data),
      ecomApi.storefrontCategories(tenantId).catch(() => []),
      ecomApi.storefrontFlashSales(tenantId).catch(() => []),
      ecomApi.storefrontConfig(tenantId, previewToken),
    ]);
  } catch { /* polished empty storefront renders below */ }

  const design = normalizeStoreDesign(config?.theme);
  const template = getStoreTemplate(design.templateId);
  return <StoreSections tenant={tenant} tenantId={tenantId} storeName={config?.store_name ?? tenant} template={template} design={design} products={products} categories={categories} flashSales={flashSales} search={search} preview={Boolean(previewToken)} />;
}
