import { FlashSalesManager } from '@/components/admin/flash-sales-manager';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { FlashSale, Product } from '@/lib/types';

/** Flash sales. Gated on promotions:read; create/edit/delete need
 *  promotions:write. Status (upcoming/ongoing/expired) is derived server-side. */
export default async function AdminFlashSales() {
  const session = await getStaffSession();

  if (!hasPermission(session!, 'promotions:read')) {
    return (
      <div>
        <PageHeader title="Flash sales" />
        <EmptyState
          icon="🔒"
          title="You don't have access to flash sales"
          description="Ask an owner or manager to grant you the promotions:read permission."
        />
      </div>
    );
  }

  const canWrite = hasPermission(session!, 'promotions:write');

  let sales: FlashSale[] = [];
  let products: Product[] = [];
  try {
    const [salesRes, productsRes] = await Promise.all([
      ecomApi.adminFlashSales(session!.tenantId),
      ecomApi.adminProducts(session!.tenantId, '?limit=100'),
    ]);
    sales = salesRes;
    products = productsRes.data;
  } catch {
    /* fall through */
  }

  return (
    <div>
      <PageHeader title="Flash sales" subtitle="Time-boxed price drops on your products." />
      {canWrite && products.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="Add a product first"
          description="A flash sale drops the price of an existing product for a set window. Create a product before scheduling a sale."
        />
      ) : (
        <FlashSalesManager sales={sales} products={products} canWrite={canWrite} />
      )}
    </div>
  );
}
