'use server';

import { revalidatePath } from 'next/cache';

import { backendMutate, type MutationResult } from '@/lib/admin-mutations';
import { getStaffSession } from '@/lib/session';
import type { FlashSaleInput } from '@/lib/types';

/** Flash-sale mutations. Tenant is always the signed-in session's; the backend
 *  re-checks promotions:write and the tenant boundary on every call. */
async function requireTenant(): Promise<string> {
  const session = await getStaffSession();
  if (!session) throw new Error('Not authenticated');
  return session.tenantId;
}

export async function createFlashSale(input: FlashSaleInput): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/flash-sales`, { method: 'POST', body: input });
  if (result.ok) revalidatePath('/admin/flash-sales');
  return result;
}

export async function updateFlashSale(id: string, input: Partial<FlashSaleInput>): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/flash-sales/${id}`, { method: 'PATCH', body: input });
  if (result.ok) revalidatePath('/admin/flash-sales');
  return result;
}

export async function deleteFlashSale(id: string): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/flash-sales/${id}`, { method: 'DELETE' });
  if (result.ok) revalidatePath('/admin/flash-sales');
  return result;
}
