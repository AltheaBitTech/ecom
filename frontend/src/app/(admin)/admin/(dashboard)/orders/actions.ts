'use server';

import { revalidatePath } from 'next/cache';

import { backendMutate, type MutationResult } from '@/lib/admin-mutations';
import { getStaffSession } from '@/lib/session';
import type { OrderStatus } from '@/lib/types';

/** The backend enforces the legal status transitions and the orders:write
 *  permission; the tenant is always the signed-in session's, never the client's. */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<MutationResult> {
  const session = await getStaffSession();
  if (!session) throw new Error('Not authenticated');
  const result = await backendMutate(`/tenants/${session.tenantId}/orders/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
  if (result.ok) revalidatePath('/admin/orders');
  return result;
}
