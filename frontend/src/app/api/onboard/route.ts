import { NextResponse } from 'next/server';

/**
 * Self-serve store creation (Backend-for-Frontend). The ecom provisioning
 * endpoint is internal-only — it authenticates the caller with the product's
 * internal key, which must never reach the browser. So this trusted Next route
 * holds the key and forwards the onboarding payload; the browser only ever sees
 * the outcome (the new store's slug, or a friendly error).
 */
const BASE = process.env.ECOM_API_URL ?? 'http://localhost:4001';
const INTERNAL_KEY = process.env.ECOM_INTERNAL_KEY ?? '';

interface OnboardBody {
  name?: string;
  slug?: string;
  owner_name?: string;
  owner_email?: string;
  owner_password?: string;
  plan_key?: string;
}

export async function POST(req: Request) {
  if (!INTERNAL_KEY) {
    return NextResponse.json(
      { error: { code: 'not_configured', message: 'Onboarding is not configured on this server.' } },
      { status: 500 },
    );
  }

  let body: OnboardBody;
  try {
    body = (await req.json()) as OnboardBody;
  } catch {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Invalid request body' } }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const slug = (body.slug ?? '').trim().toLowerCase();
  const ownerName = (body.owner_name ?? '').trim();
  const ownerEmail = (body.owner_email ?? '').trim();
  const ownerPassword = body.owner_password ?? '';
  const planKey = body.plan_key ?? 'starter';

  if (!name || !slug || !ownerEmail || !ownerPassword) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Store name, subdomain, email and password are required.' } },
      { status: 400 },
    );
  }
  if (ownerPassword.length < 12) {
    return NextResponse.json(
      { error: { code: 'weak_password', message: 'Password must be at least 12 characters.' } },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    return NextResponse.json(
      { error: { code: 'bad_slug', message: 'Subdomain may contain only lowercase letters, numbers and hyphens.' } },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/onboarding/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
      body: JSON.stringify({
        name,
        slug,
        owner_email: ownerEmail,
        owner_password: ownerPassword,
        owner_name: ownerName || undefined,
        plan_key: planKey,
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'upstream_unreachable', message: 'Could not reach the commerce API. Is it running?' } },
      { status: 502 },
    );
  }

  const payload = (await res.json().catch(() => null)) as
    | { data?: { id: string; slug: string; name: string } }
    | { error?: { code?: string; message?: string } }
    | null;

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string } })?.error;
    return NextResponse.json(
      { error: { code: err?.code ?? 'provision_failed', message: err?.message ?? 'Could not create the store.' } },
      { status: res.status },
    );
  }

  const data = (payload as { data?: { id: string; slug: string; name: string } })?.data;
  return NextResponse.json({ data: { slug: data?.slug ?? slug, name: data?.name ?? name } }, { status: 201 });
}
