import { NextRequest, NextResponse } from 'next/server';

const STORE_PREVIEW_COOKIE = 'ecom_store_preview';

export function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]{1,63}$/.test(slug)) return NextResponse.redirect(new URL('/', request.url));
  const response = NextResponse.redirect(new URL(`/${slug}`, request.url));
  if (request.nextUrl.searchParams.get('clear') === '1') {
    response.cookies.set(STORE_PREVIEW_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  }
  const token = request.nextUrl.searchParams.get('token');
  if (!token || token.length > 4096) return NextResponse.redirect(new URL(`/${slug}`, request.url));
  response.cookies.set(STORE_PREVIEW_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 1800 });
  return response;
}
