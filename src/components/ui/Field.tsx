import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/format";

const base =
  "w-full bg-surface-container-lowest rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-outline border border-outline-variant/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors disabled:bg-surface-container-low disabled:text-secondary";

interface Labelled {
  label?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
}

function Wrapper({ id, label, error, hint, optional, children }: Labelled & { id?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
          {label}
          {optional ? <span className="normal-case tracking-normal text-outline font-normal"> (optional)</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="font-body-sm text-body-sm text-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="font-body-sm text-body-sm text-secondary">{hint}</span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Labelled>(function Input(
  { label, error, hint, optional, className, id, name, ...rest },
  ref,
) {
  const inputId = id ?? name;
  return (
    <Wrapper id={inputId} label={label} error={error} hint={hint} optional={optional}>
      <input
        ref={ref}
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(base, error && "border-error focus:border-error focus:ring-error/10", className)}
        {...rest}
      />
    </Wrapper>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Labelled>(function Select(
  { label, error, hint, optional, className, id, name, children, ...rest },
  ref,
) {
  const inputId = id ?? name;
  return (
    <Wrapper id={inputId} label={label} error={error} hint={hint} optional={optional}>
      <select
        ref={ref}
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(base, "appearance-none pr-8 bg-no-repeat", error && "border-error", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='%23575e70'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.6rem center",
        }}
        {...rest}
      >
        {children}
      </select>
    </Wrapper>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Labelled>(
  function Textarea({ label, error, hint, optional, className, id, name, ...rest }, ref) {
    const inputId = id ?? name;
    return (
      <Wrapper id={inputId} label={label} error={error} hint={hint} optional={optional}>
        <textarea
          ref={ref}
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          className={cn(base, "min-h-[88px] resize-y", error && "border-error", className)}
          {...rest}
        />
      </Wrapper>
    );
  },
);
