import { redirect } from 'next/navigation';

import { ProductForm } from '@/components/admin/product-form';
import { PageHeader } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Category, StoreConfig } from '@/lib/types';

/** Create a product. Requires products:write; the custom-attribute section is
 *  driven by the store's public attribute schema. */
export default async function NewProductPage() {
  const session = await getStaffSession();
  if (!hasPermission(session!, 'products:write')) redirect('/admin/products');
  const tenantId = session!.tenantId;

  let categories: Category[] = [];
  let config: StoreConfig | null = null;
  try {
    [categories, config] = await Promise.all([
      ecomApi.adminCategories(tenantId),
      ecomApi.storefrontConfig(tenantId),
    ]);
  } catch {
    /* render with what we have */
  }

  return (
    <div>
      <PageHeader title="New product" subtitle="Add an item to your catalog." />
      <ProductForm
        mode="create"
        categories={categories}
        currency={config?.currency ?? 'INR'}
        attributeSchema={config?.product_attribute_schema ?? {}}
      />
    </div>
  );
}
