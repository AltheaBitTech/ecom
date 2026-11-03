import { CategoryManager } from '@/components/admin/category-manager';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { ecomApi } from '@/lib/api';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { Category } from '@/lib/types';

/** Categories management. Gated on products:read; create/delete require
 *  products:write (enforced here for the UI and again by the backend). */
export default async function AdminCategories() {
  const session = await getStaffSession();

  if (!hasPermission(session!, 'products:read')) {
    return (
      <div>
        <PageHeader title="Categories" />
        <EmptyState
          icon="🔒"
          title="You don't have access to categories"
          description="Ask an owner or manager to grant you the products:read permission."
        />
      </div>
    );
  }

  const canWrite = hasPermission(session!, 'products:write');

  let categories: Category[] = [];
  try {
    categories = await ecomApi.adminCategories(session!.tenantId);
  } catch {
    /* fall through to empty state */
  }

  return (
    <div>
      <PageHeader title="Categories" subtitle="Organize your catalog." />
      <CategoryManager categories={categories} canWrite={canWrite} />
    </div>
  );
}
