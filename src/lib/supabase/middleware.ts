import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = (global as any).MOCK_SUPABASE_CLIENT || createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired and get the user
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes: /dashboard, /desk, /library, /calendar, /feed, /settings, /hive/*
  const protectedRoutes = ['/dashboard', '/desk', '/library', '/calendar', '/feed', '/settings', '/hive'];
  const isProtectedRoute = protectedRoutes.some((route) => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  // Redirect unauthenticated users targeting protected routes
  if (!user && isProtectedRoute) {
    const returnUrl = pathname + request.nextUrl.search;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', returnUrl);

    const redirectResponse = NextResponse.redirect(loginUrl);

    // Copy cookies to redirect response to persist the refreshed session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
      });
    });

    return redirectResponse;
  }

  // Redirect authenticated users visiting /login or /login/magic to /dashboard
  if (user && (pathname === '/login' || pathname === '/login/magic')) {
    const dashboardUrl = new URL('/dashboard', request.url);
    const redirectResponse = NextResponse.redirect(dashboardUrl);

    // Copy cookies to redirect response to persist the refreshed session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
      });
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
