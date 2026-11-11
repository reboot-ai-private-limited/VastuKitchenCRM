import { NextResponse, type NextRequest } from 'next/server';

/**
 * A convenience redirect, NOT security. The real refresh cookie is httpOnly and scoped to the auth
 * routes, so the server cannot see it on page requests; instead the app sets a readable hint cookie
 * (`vk_session`) after sign-in. No hint → go to /login without flashing a loading screen. The API
 * enforces every permission regardless.
 */
const PUBLIC_PREFIXES = ['/login', '/invite', '/p'];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.cookies.has('vk_session')) return NextResponse.next();

  const url = new URL('/login', req.url);
  if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Not the API (proxied by a rewrite), Next internals, or files with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
