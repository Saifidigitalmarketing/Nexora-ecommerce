import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "NEXORA — Everything. One Place.", template: "%s · NEXORA" },
  description:
    "Shop 100% authentic electronics, fashion, beauty, home and pantry essentials in Pakistan. Cash on Delivery, Easypaisa, JazzCash and fast delivery.",
  applicationName: "NEXORA",
  appleWebApp: { capable: true, title: "NEXORA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: { siteName: "NEXORA", type: "website", locale: "en_PK" },
};

export const viewport: Viewport = {
  themeColor: "#006948",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const session = configured ? await getSession() : { userId: null, profile: null };

  return (
    <html lang="en-PK" className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <link rel="preload" href="/fonts/material-symbols-outlined.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen">
        <AppProviders userId={session.userId} profile={session.profile}>
          <OfflineBanner />
          {configured ? children : <SetupNotice />}
        </AppProviders>
      </body>
    </html>
  );
}
