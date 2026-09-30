/** Pushed screens (Stitch "mobile_stack" shell) — each page renders its own StackHeader. */
export default function StackLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col min-h-screen bg-surface">{children}</div>;
}
