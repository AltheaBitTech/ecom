import { notFound, redirect } from 'next/navigation';

import { DeleteProductButton } from '@/components/admin/delete-product-button';
import { ProductForm } from '@/components/admin/product-form';
import { PageHeader } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Category, Product, StoreConfig } from '@/lib/types';

/** Edit a product. Requires products:write. */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getStaffSession();
  if (!hasPermission(session!, 'products:write')) redirect('/admin/products');
  const tenantId = session!.tenantId;

  let product: Product | null = null;
  let categories: Category[] = [];
  let config: StoreConfig | null = null;
  try {
    [product, categories, config] = await Promise.all([
      ecomApi.adminProduct(tenantId, id),
      ecomApi.adminCategories(tenantId),
      ecomApi.storefrontConfig(tenantId),
    ]);
  } catch {
    /* fall through */
  }
  if (!product) notFound();

  return (
    <div>
      <PageHeader
        title="Edit product"
        subtitle={product.name}
        actions={<DeleteProductButton id={product.id} name={product.name} />}
      />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        currency={config?.currency ?? product.currency ?? 'INR'}
        attributeSchema={config?.product_attribute_schema ?? {}}
      />
    </div>
  );
}
