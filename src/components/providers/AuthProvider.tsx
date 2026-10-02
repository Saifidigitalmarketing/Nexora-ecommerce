"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/lib/types";

interface AuthState {
  userId: string | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ userId: null, profile: null, signOut: async () => {} });

export function AuthProvider({ initialUserId, initialProfile, children }: { initialUserId: string | null; initialProfile: Profile | null; children: ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState(initialUserId);
  const [profile, setProfile] = useState(initialProfile);
  // user the server rendered for; a different session in the browser means the page is stale
  const current = useRef(initialUserId);

  useEffect(() => {
    current.current = initialUserId;
    setUserId(initialUserId);
    setProfile(initialProfile);
  }, [initialUserId, initialProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    const sync = (next: string | null) => {
      if (next === current.current) return;
      current.current = next;
      setUserId(next);
      if (!next) setProfile(null);
      router.refresh(); // re-render server components (profile, protected pages) for the new session
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") sync(session?.user?.id ?? null);
    });
    // The session lives in cookies, so a sign-in/out in another tab (e.g. the
    // email confirmation link) is picked up when this tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void supabase.auth.getSession().then(({ data: d }) => sync(d.session?.user?.id ?? null));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({
      userId,
      profile,
      signOut: async () => {
        await getSupabaseBrowser().auth.signOut();
        current.current = null;
        setUserId(null);
        setProfile(null);
        // drop offline copies of pages rendered for this account (service worker page cache)
        try {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.endsWith("-pages")).map((k) => caches.delete(k)));
        } catch {
          // Cache Storage unavailable (private mode / old browser)
        }
        // full navigation clears the client router cache of signed-in pages
        window.location.replace("/");
      },
    }),
    [userId, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
