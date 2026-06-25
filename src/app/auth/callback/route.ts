import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // 1. Try to get returnUrl from query parameters
  let returnUrl = requestUrl.searchParams.get("returnUrl") || requestUrl.searchParams.get("next");

  // 2. Try to get returnUrl from cookie as fallback
  if (!returnUrl) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    returnUrl = cookieStore.get("sb-return-url")?.value || null;
  }

  // Resolve safe redirection path
  let redirectTo = returnUrl || "/dashboard";

  // Prevent open redirect vulnerability
  if (redirectTo.startsWith("http://") || redirectTo.startsWith("https://")) {
    try {
      const parsedRedirect = new URL(redirectTo);
      if (parsedRedirect.origin !== requestUrl.origin) {
        redirectTo = "/dashboard";
      }
    } catch {
      redirectTo = "/dashboard";
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Clear the returnUrl cookie
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.delete("sb-return-url");

      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    }
  }

  // Redirect to login with error parameter on failure
  return NextResponse.redirect(new URL("/login?error=auth-callback-failed", requestUrl.origin));
}
