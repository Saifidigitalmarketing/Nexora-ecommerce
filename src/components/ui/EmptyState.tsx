import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function EmptyState({
  icon = "inventory_2",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-6">
      <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-primary mb-1">
        <Icon name={icon} className="text-[30px]" />
      </div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      {description ? <p className="font-body-md text-body-md text-secondary max-w-xs">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return <EmptyState icon="error" title={title} description={description ?? "Please check your connection and try again."} action={action} />;
}
