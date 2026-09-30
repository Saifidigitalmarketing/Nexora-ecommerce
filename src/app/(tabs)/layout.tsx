import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";

/** Screens with the main header + bottom tab bar (Stitch "mobile_tab" shell). */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex flex-col relative w-full pb-24 lg:pb-12 bg-surface flex-grow max-w-screen-xl mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
