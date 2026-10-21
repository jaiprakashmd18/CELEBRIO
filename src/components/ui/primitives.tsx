import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function Badge({ className, tone = "neutral", ...props }: ComponentProps<"span"> & { tone?: "neutral" | "rose" | "gold" | "success" | "dark" }) {
  const tones = {
    neutral: "bg-sand text-charcoal",
    rose: "bg-rose/12 text-rose-dark",
    gold: "bg-gold/15 text-[#8a713f]",
    success: "bg-success/12 text-success",
    dark: "bg-charcoal text-ivory",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] bg-white ring-1 ring-line shadow-soft", className)} {...props} />;
}

export function SectionHeading({ eyebrow, title, description, align = "left", as: Tag = "h2" }: { eyebrow?: string; title: ReactNode; description?: ReactNode; align?: "left" | "center"; as?: "h1" | "h2" }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-rose-dark">{eyebrow}</p>}
      <Tag className="font-serif text-3xl leading-tight text-balance sm:text-4xl">{title}</Tag>
      {description && <p className="mt-4 text-base leading-relaxed text-gray sm:text-lg">{description}</p>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "error"; title?: string; children?: ReactNode; className?: string }) {
  const styles = {
    info: { cls: "bg-sand/70 text-charcoal ring-line", Icon: Info },
    success: { cls: "bg-success/8 text-success ring-success/20", Icon: CheckCircle2 },
    error: { cls: "bg-danger/8 text-danger ring-danger/25", Icon: AlertCircle },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl p-4 text-sm ring-1", styles.cls, className)}>
      <styles.Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 rounded-full bg-sand p-3 text-gray">{icon}</div>}
      <h3 className="font-serif text-xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-gray">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
