import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

/** Email confirmation / password recovery links (PKCE) land here with ?code=. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const loginNext = next !== "/" ? `&next=${encodeURIComponent(next)}` : "";
  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    if (next.startsWith("/reset-password")) return NextResponse.redirect(new URL("/login?error=expired", url.origin));
    // Supabase only issues a code after it has verified the email. The exchange
    // fails when the link is opened in a different browser/app than the one used
    // to sign up, so the account is confirmed — the user just needs to sign in.
    return NextResponse.redirect(new URL(`/login?confirmed=1${loginNext}`, url.origin));
  }
  // Supabase sends ?error=…&error_code=otp_expired for expired or reused links
  return NextResponse.redirect(new URL(`/login?error=expired${loginNext}`, url.origin));
}
