import { cookies } from 'next/headers';

// Separate from tenant admin's session entirely: one httpOnly cookie holding the raw
// platform bearer token (POST /platform/auth/login). No refresh rotation on the backend
// (see backend/src/modules/platform/platform-token.service.ts ponytail note), so this
// cookie just mirrors the token's own 12h lifetime — re-login on expiry.
export const PLATFORM_COOKIE = 'platform_admin_token';
const MAX_AGE_SECONDS = 12 * 60 * 60;

export async function setPlatformSessionCookie(token: string) {
  const store = await cookies();
  store.set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearPlatformSessionCookie() {
  const store = await cookies();
  store.delete(PLATFORM_COOKIE);
}

export async function getPlatformToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(PLATFORM_COOKIE)?.value;
}
