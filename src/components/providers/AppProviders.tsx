"use client";

import type { ReactNode } from "react";
import type { Profile } from "@/lib/types";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { LocationProvider } from "./LocationProvider";
import { WishlistProvider } from "./WishlistProvider";
import { PwaProvider } from "./PwaProvider";

export function AppProviders({ userId, profile, children }: { userId: string | null; profile: Profile | null; children: ReactNode }) {
  return (
    <ToastProvider>
      <PwaProvider>
        <AuthProvider initialUserId={userId} initialProfile={profile}>
          <LocationProvider>
            <CartProvider>
              <WishlistProvider>{children}</WishlistProvider>
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </PwaProvider>
    </ToastProvider>
  );
}
