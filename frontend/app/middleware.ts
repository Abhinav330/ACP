import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAdmin = token?.is_admin;
    const isRestricted = token?.is_restricted;
    const isAuthPage = req.nextUrl.pathname.startsWith('/login');
    const isAdminPage = req.nextUrl.pathname.startsWith('/admin');
    const isApiRoute = req.nextUrl.pathname.startsWith('/api');

    // Allow API routes
    if (isApiRoute) {
      return NextResponse.next();
    }

    // Handle auth pages
    if (isAuthPage) {
      if (token) {
        if (isAdmin) {
          return NextResponse.redirect(new URL('/admin/questions', req.url));
        }
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.next();
    }

    // Handle admin routes
    if (isAdminPage) {
      if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
      }
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.next();
    }

    // Handle restricted users
    if (isRestricted) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // For all other routes, require authentication
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/',
    '/login',
    '/admin/:path*',
    '/api/:path*',
  ],
}; 