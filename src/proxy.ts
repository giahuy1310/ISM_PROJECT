import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const publicRoutes = ['/login', '/register'];

export default auth((req) => {
  const isPublic = publicRoutes.includes(req.nextUrl.pathname);

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
