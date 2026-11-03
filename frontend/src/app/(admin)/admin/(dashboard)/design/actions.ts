'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { ADMIN_STORE_SLUG_COOKIE } from '@/lib/admin-auth';
import { backendMutate } from '@/lib/admin-mutations';
import { getStaffSession, hasPermission } from '@/lib/session';
import type { StoreDesignConfig } from '@/lib/store-templates';
import type { MediaAsset } from '@/lib/types';

const denied = { ok: false, message: 'You do not have permission to change the store design.' } as const;

export async function saveDesignDraft(design: StoreDesignConfig, expectedRevision: number) {
  const session = await getStaffSession();
  if (!session || !hasPermission(session, 'store_settings:write')) return denied;
  const result = await backendMutate<{ draft_revision: number }>(`/tenants/${session.tenantId}/design/draft`, { method: 'PUT', body: { design, expected_revision: expectedRevision } });
  if (!result.ok) return { ok: false as const, message: result.error?.message ?? 'Could not save the draft.' };
  revalidatePath('/admin/design');
  return { ok: true as const, message: 'Draft saved privately.', revision: result.data!.draft_revision };
}

export async function createDesignPreview() {
  const session = await getStaffSession();
  if (!session || !hasPermission(session, 'store_settings:read')) return denied;
  const result = await backendMutate<{ preview_token: string }>(`/tenants/${session.tenantId}/design/preview`, { method: 'POST' });
  const slug = (await cookies()).get(ADMIN_STORE_SLUG_COOKIE)?.value;
  if (!result.ok || !slug) return { ok: false as const, message: result.error?.message ?? 'Could not create a preview.' };
  return { ok: true as const, url: `/api/storefront-preview?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(result.data!.preview_token)}` };
}

export async function publishDesign() {
  const session = await getStaffSession();
  if (!session || !hasPermission(session, 'store_settings:write')) return denied;
  const result = await backendMutate<{ published_revision: number }>(`/tenants/${session.tenantId}/design/publish`, { method: 'POST' });
  if (!result.ok) return { ok: false as const, message: result.error?.message ?? 'Could not publish the design.' };
  const slug = (await cookies()).get(ADMIN_STORE_SLUG_COOKIE)?.value;
  revalidatePath('/admin/design');
  if (slug) revalidatePath(`/${slug}`, 'layout');
  return { ok: true as const, message: 'Your new storefront is live.', revision: result.data!.published_revision };
}

export async function createMediaUpload(input: { filename: string; mime_type: string; size_bytes: number; alt_text?: string }) {
  const session = await getStaffSession();
  if (!session || !hasPermission(session, 'store_settings:write')) return denied;
  const result = await backendMutate<{ asset: MediaAsset; upload_url: string }>(`/tenants/${session.tenantId}/media/uploads`, { method: 'POST', body: input });
  return result.ok ? { ok: true as const, ...result.data! } : { ok: false as const, message: result.error?.message ?? 'Could not start the upload.' };
}

export async function completeMediaUpload(id: string, width?: number, height?: number) {
  const session = await getStaffSession();
  if (!session || !hasPermission(session, 'store_settings:write')) return denied;
  const result = await backendMutate<MediaAsset>(`/tenants/${session.tenantId}/media/${id}/complete`, { method: 'POST', body: { width, height } });
  return result.ok ? { ok: true as const, asset: result.data! } : { ok: false as const, message: result.error?.message ?? 'Could not finish the upload.' };
}
