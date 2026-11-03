'use server';

import { revalidatePath } from 'next/cache';

import { backendMutate, type MutationResult } from '@/lib/admin-mutations';
import { getStaffSession } from '@/lib/session';
import type { CategoryInput, ProductInput } from '@/lib/types';

/**
 * Catalog mutations. The tenant is ALWAYS derived from the signed-in session
 * (never trusted from the client), and the backend re-checks the products:write
 * permission and the tenant boundary on every call.
 */
async function requireTenant(): Promise<string> {
  const session = await getStaffSession();
  if (!session) throw new Error('Not authenticated');
  return session.tenantId;
}

export async function createProduct(input: ProductInput): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/products`, { method: 'POST', body: input });
  if (result.ok) revalidatePath('/admin/products');
  return result;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/products/${id}`, { method: 'PATCH', body: input });
  if (result.ok) {
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${id}/edit`);
  }
  return result;
}

export async function deleteProduct(id: string): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/products/${id}`, { method: 'DELETE' });
  if (result.ok) revalidatePath('/admin/products');
  return result;
}

export async function deleteProducts(ids: string[]): Promise<MutationResult> {
  const tenantId = await requireTenant();
  let last: MutationResult = { ok: true, status: 204 };
  for (const id of ids) {
    last = await backendMutate(`/tenants/${tenantId}/products/${id}`, { method: 'DELETE' });
    if (!last.ok) break; // ponytail: stop on first failure; report it. Partial delete is fine to re-run.
  }
  revalidatePath('/admin/products');
  return last;
}

export async function createCategory(input: CategoryInput): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/categories`, { method: 'POST', body: input });
  if (result.ok) revalidatePath('/admin/categories');
  return result;
}

export async function deleteCategory(id: string): Promise<MutationResult> {
  const tenantId = await requireTenant();
  const result = await backendMutate(`/tenants/${tenantId}/categories/${id}`, { method: 'DELETE' });
  if (result.ok) revalidatePath('/admin/categories');
  return result;
}
