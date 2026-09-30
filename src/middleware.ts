import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|brand/|sw.js|manifest.webmanifest|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2)$).*)"],
};
