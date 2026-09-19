import { NextResponse } from 'next/server';
import { clearPlatformSessionCookie } from '@/lib/platform-session';

export async function POST() {
  await clearPlatformSessionCookie();
  return NextResponse.json({ ok: true });
}
