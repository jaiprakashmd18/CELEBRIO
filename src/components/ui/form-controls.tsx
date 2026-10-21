import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.95rem] text-charcoal placeholder:text-gray/70 transition focus:border-charcoal/40 focus:outline-none focus:ring-2 focus:ring-charcoal/10 disabled:bg-sand/50 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 appearance-none bg-[length:12px] pr-9", className)} {...props} />;
}

export function Field({ id, label, hint, error, children, className, counter }: { id: string; label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; counter?: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-charcoal">
          {label}
        </label>
        {counter && <span className="text-xs tabular-nums text-gray">{counter}</span>}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-gray">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
