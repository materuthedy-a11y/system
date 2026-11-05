import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has('__Host-mizania-refresh') || request.cookies.has('mizania-refresh');

  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasSession ? '/dashboard' : '/login', request.url));
  }

  if (publicRoutes.has(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/dashboard') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
