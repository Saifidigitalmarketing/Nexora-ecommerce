import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: SITE_TITLE, template: "%s · NEXORA" },
  description: SITE_DESCRIPTION,
  applicationName: "NEXORA",
  appleWebApp: { capable: true, title: "NEXORA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.png", apple: "/icons/apple-touch-icon.png" },
  // defaults for every page; public pages add their own title/url/image via pageMetadata()
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_PK", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [DEFAULT_OG_IMAGE.url] },
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
