import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";
import { safeNext } from "@/lib/safe-redirect";

const PROTECTED = ["/account", "/checkout", "/wishlist", "/orders", "/admin", "/rider", "/seller", "/reset-password"];
const GUEST_ONLY = ["/login", "/signup"];

/** Refreshes the auth session cookie and redirects guests away from private areas. */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Supabase falls back to the Site URL when the requested redirect is not in
  // its allow-list, so an email link can land on any page with ?code= or
  // ?token_hash=. Hand it to the matching auth route instead of dropping it.
  if (!path.startsWith("/auth/")) {
    const sp = request.nextUrl.searchParams;
    const target = sp.get("token_hash") ? "/auth/confirm" : sp.get("code") ? "/auth/callback" : sp.get("error_code") ? "/auth/callback" : null;
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      if (!sp.get("next")) url.searchParams.set("next", "/account");
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  const redirectKeepingCookies = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!data.user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return redirectKeepingCookies(url);
  }
  // Signed-in users never see the sign-in / create-account forms
  // (skipped if the profile row is missing, so /account ↔ /login cannot loop)
  if (data.user && GUEST_ONLY.includes(path)) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (profile) return redirectKeepingCookies(new URL(safeNext(request.nextUrl.searchParams.get("next"), "/account"), request.url));
  }
  return response;
}
