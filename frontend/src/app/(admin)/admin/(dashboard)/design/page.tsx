import { cookies } from 'next/headers';

import { DesignPicker } from '@/components/admin/design-picker';
import { EmptyState } from '@/components/ui/primitives';
import { ADMIN_STORE_SLUG_COOKIE } from '@/lib/admin-auth';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';

export default async function StoreDesignPage() {
  const session = await getStaffSession();
  if (!hasPermission(session!, 'store_settings:read')) return <EmptyState icon="🔒" title="You don't have access to store design" description="Ask an owner to grant store settings access." />;

  try {
    const [design, products, categories, media] = await Promise.all([
      ecomApi.storeDesign(session!.tenantId),
      ecomApi.adminProducts(session!.tenantId, '?limit=100').then((page) => page.data),
      ecomApi.adminCategories(session!.tenantId), ecomApi.mediaAssets(session!.tenantId),
    ]);
    const storeSlug = (await cookies()).get(ADMIN_STORE_SLUG_COOKIE)?.value;
    return <DesignPicker initial={design} products={products} categories={categories} initialMedia={media} canWrite={hasPermission(session!, 'store_settings:write')} storeSlug={storeSlug} />;
  } catch {
    return <EmptyState icon="↻" title="The design studio could not load" description="Check the commerce API and try again." />;
  }
}
