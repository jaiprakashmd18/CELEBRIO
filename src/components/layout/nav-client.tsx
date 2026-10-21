"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

/** Accessible disclosure menu: opens on click/Enter/Space, closes on Escape or outside click. */
export function OccasionsMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full px-3.5 py-2 hover:bg-sand"
      >
        Occasions <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="absolute left-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-line"
      >
        <ul className="grid">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block rounded-xl px-3 py-2 text-sm hover:bg-sand">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MobileNav({ occasions, signedIn }: { occasions: NavItem[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)} className="rounded-full p-2 hover:bg-sand">
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>
      <div id="mobile-nav" hidden={!open} className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-ivory px-4 pb-10 pt-4">
        <nav aria-label="Mobile" className="space-y-6">
          <ul className="space-y-1 text-lg">
            <li><Link className="block rounded-xl px-3 py-2.5 hover:bg-sand" href="/templates">All templates</Link></li>
            <li><Link className="block rounded-xl px-3 py-2.5 hover:bg-sand" href="/how-it-works">How it works</Link></li>
            <li><Link className="block rounded-xl px-3 py-2.5 hover:bg-sand" href="/pricing">Pricing</Link></li>
            <li><Link className="block rounded-xl px-3 py-2.5 hover:bg-sand" href="/faq">FAQ</Link></li>
          </ul>
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray">Occasions</p>
            <ul className="mt-2 grid grid-cols-2 gap-1">
              {occasions.map((o) => (
                <li key={o.href}>
                  <Link className="block rounded-xl px-3 py-2 hover:bg-sand" href={o.href}>
                    {o.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2">
            <Link href="/templates" className={buttonClasses("primary", "lg")}>Create an Invitation</Link>
            <Link href={signedIn ? "/dashboard" : "/sign-in"} className={buttonClasses("secondary", "lg")}>
              {signedIn ? "My account" : "Sign in"}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
