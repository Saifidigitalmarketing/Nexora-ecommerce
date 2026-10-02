import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Email links built from the Supabase templates in supabase/templates/
 * land here with ?token_hash=&type=. Verifying the hash on the server works
 * in any browser or app the email is opened in (unlike the PKCE ?code= link,
 * which only works in the browser that started the sign-up).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/account");

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // expired, already used or malformed link
  return NextResponse.redirect(new URL(`/login?error=expired&next=${encodeURIComponent(next)}`, url.origin));
}
