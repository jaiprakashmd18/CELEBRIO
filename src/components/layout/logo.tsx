import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-8", className)}>
      <circle cx="20" cy="20" r="19" fill="var(--color-charcoal)" />
      <path d="M26.5 13.2a9 9 0 1 0 0 13.6" fill="none" stroke="var(--color-ivory)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M28.6 15.4 Q29.3 18.6 32.4 19.3 Q29.3 20 28.6 23.2 Q27.9 20 24.8 19.3 Q27.9 18.6 28.6 15.4Z" fill="#B89A62" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="Celebrio home">
      <LogoMark />
      <span className="font-serif text-[1.45rem] leading-none tracking-tight">Celebrio</span>
    </Link>
  );
}
