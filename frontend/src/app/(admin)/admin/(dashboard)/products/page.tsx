import { Button } from '@/components/ui/button';
import { ProductsManager } from '@/components/admin/products-manager';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Category, Page, Product } from '@/lib/types';

/** Products list. Gated on products:read; write actions (new/edit/delete/bulk)
 *  only show with products:write. A category must exist before any product can
 *  be created — the "New product" action is replaced with a prompt otherwise. */
export default async function AdminProducts() {
  const session = await getStaffSession();

  if (!hasPermission(session!, 'products:read')) {
    return (
      <div>
        <PageHeader title="Products" />
        <EmptyState
          icon="🔒"
          title="You don't have access to products"
          description="Ask an owner or manager to grant you the products:read permission."
        />
      </div>
    );
  }

  const canWrite = hasPermission(session!, 'products:write');

  let page: Page<Product> = { data: [], next_cursor: null, has_more: false };
  let categories: Category[] = [];
  try {
    [page, categories] = await Promise.all([
      ecomApi.adminProducts(session!.tenantId, '?limit=100'),
      ecomApi.adminCategories(session!.tenantId),
    ]);
  } catch {
    /* fall through to empty state */
  }

  const canCreate = canWrite && categories.length > 0;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Everything in your catalog."
        actions={
          canCreate && (
            <Button href="/admin/products/new" size="sm">
              New product
            </Button>
          )
        }
      />

      {canWrite && categories.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="Create a category first"
          description="Products are organised into categories. Add at least one category before you create a product."
          action={<Button href="/admin/categories">Add a category</Button>}
        />
      ) : page.data.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No products yet"
          description="Add your first product to start building your catalog. One product can hold multiple size/weight options — no need to duplicate it per variant."
          action={canCreate && <Button href="/admin/products/new">Add a product</Button>}
        />
      ) : (
        <ProductsManager products={page.data} categories={categories} canWrite={canWrite} />
      )}
    </div>
  );
}
