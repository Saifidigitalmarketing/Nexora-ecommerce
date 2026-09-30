"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";

export default function TabsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState action={<Button onClick={reset}>Try again</Button>} />;
}
