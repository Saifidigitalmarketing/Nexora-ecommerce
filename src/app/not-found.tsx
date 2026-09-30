import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-margin text-center bg-surface">
      <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
        <Icon name="search_off" className="text-[30px]" />
      </div>
      <h1 className="font-headline-md text-headline-md text-on-surface">Page not found</h1>
      <p className="font-body-md text-body-md text-secondary max-w-xs">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Link href="/" className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg inline-flex items-center">
        Back to NEXORA
      </Link>
    </main>
  );
}
