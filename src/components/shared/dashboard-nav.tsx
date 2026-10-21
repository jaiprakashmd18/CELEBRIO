"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileImage, LayoutDashboard, LogOut, PenLine, Receipt, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/drafts", label: "My drafts", icon: PenLine },
  { href: "/dashboard/invitations", label: "Purchased & downloads", icon: FileImage },
  { href: "/dashboard/purchases", label: "Purchase history", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ showAdmin, email }: { showAdmin: boolean; email: string }) {
  const pathname = usePathname();
  const links = showAdmin ? [...LINKS, { href: "/admin", label: "Admin", icon: Shield }] : LINKS;
  return (
    <nav aria-label="Account" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-3 hidden truncate px-3 text-xs text-gray lg:block">{email}</p>
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm lg:rounded-xl", active ? "bg-charcoal text-ivory" : "hover:bg-sand")}>
                <Icon aria-hidden className="size-4" /> {label}
              </Link>
            </li>
          );
        })}
        <li>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm hover:bg-sand lg:w-full lg:rounded-xl">
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
