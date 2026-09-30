import { Icon } from "@/components/ui/Icon";

/** Shown when NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are missing. */
export function SetupNotice() {
  return (
    <main className="min-h-screen flex items-center justify-center p-margin">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-3">
        <img src="/brand/nexora-logo.svg" alt="NEXORA" className="h-8 w-auto self-start" />
        <h1 className="font-headline-sm text-headline-sm flex items-center gap-2">
          <Icon name="settings" className="text-primary" /> Connect Supabase
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Add <code className="font-label-md">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-label-md">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
          <code className="font-label-md"> .env.local</code>, run the SQL in <code className="font-label-md">supabase/</code>, then restart the app. See README.md.
        </p>
      </div>
    </main>
  );
}
