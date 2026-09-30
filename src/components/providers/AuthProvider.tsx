"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  useEffect(() => {
    setUserId(initialUserId);
    setProfile(initialProfile);
  }, [initialUserId, initialProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user?.id ?? null;
      // Login/signup forms navigate themselves; here we only mirror state.
      if (event === "SIGNED_IN") setUserId(next);
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setProfile(null);
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({
      userId,
      profile,
      signOut: async () => {
        await getSupabaseBrowser().auth.signOut();
        setUserId(null);
        setProfile(null);
        router.push("/");
        router.refresh();
      },
    }),
    [userId, profile, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
