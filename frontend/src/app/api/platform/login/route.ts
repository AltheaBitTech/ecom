import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/platform-api';
import { setPlatformSessionCookie } from '@/lib/platform-session';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const res = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Login failed' }));
    return NextResponse.json({ message: body.message ?? 'Login failed' }, { status: res.status });
  }

  const { accessToken } = await res.json();
  await setPlatformSessionCookie(accessToken);
  return NextResponse.json({ ok: true });
}
