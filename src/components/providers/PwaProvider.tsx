"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** true when the browser offered an install prompt we can trigger */
  canPrompt: boolean;
  /** running as an installed app */
  isStandalone: boolean;
  /** iOS Safari: install is manual via Share → Add to Home Screen */
  isIOS: boolean;
  online: boolean;
  bannerDismissed: boolean;
  dismissBanner: () => void;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaContext = createContext<PwaState>({
  canPrompt: false,
  isStandalone: false,
  isIOS: false,
  online: true,
  bannerDismissed: true,
  dismissBanner: () => {},
  install: async () => "unavailable",
});

const DISMISS_KEY = "nx_install_dismissed_at";

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setStandalone] = useState(false);
  const [isIOS, setIOS] = useState(false);
  const [online, setOnline] = useState(true);
  const [bannerDismissed, setDismissed] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(standalone);
    setIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));
    setOnline(navigator.onLine);
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      // show again 7 days after dismissal
      setDismissed(standalone || Date.now() - at < 7 * 24 * 3600 * 1000);
    } catch {
      setDismissed(standalone);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
      setDismissed(true);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator && (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1")) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setDismissed(true);
    return outcome;
  }, [deferred]);

  const value = useMemo(
    () => ({ canPrompt: !!deferred, isStandalone, isIOS, online, bannerDismissed, dismissBanner, install }),
    [deferred, isStandalone, isIOS, online, bannerDismissed, dismissBanner, install],
  );
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  return useContext(PwaContext);
}
