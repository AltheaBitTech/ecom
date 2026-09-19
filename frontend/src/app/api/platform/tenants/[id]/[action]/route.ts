import { NextResponse } from 'next/server';
import { platformApi, PlatformApiError } from '@/lib/platform-api';

const ALLOWED_ACTIONS = new Set(['approve', 'reject', 'request-revision', 'suspend', 'reactivate']);

// Single route handler for every tenant status-change action (backend already exposes
// them 1:1 as platform/tenants/:id/:action) — the bearer token is httpOnly so this must
// be forwarded server-side, it can't be called directly from a client component.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  }

  try {
    const tenant = await platformApi(`/platform/tenants/${id}/${action}`, { method: 'POST' });
    return NextResponse.json(tenant);
  } catch (err) {
    if (err instanceof PlatformApiError) return NextResponse.json({ message: err.message }, { status: err.status });
    throw err;
  }
}
