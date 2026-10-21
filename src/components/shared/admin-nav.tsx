"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/templates", "Templates"],
  ["/admin/categories", "Categories"],
  ["/admin/orders", "Orders"],
  ["/admin/exports", "Exports"],
  ["/admin/support", "Support"],
  ["/admin/audit", "Audit log"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-2 sm:px-4">
      <ul className="flex gap-1">
        {LINKS.map(([href, label]) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm", active ? "border-charcoal font-medium" : "border-transparent text-gray hover:text-charcoal")}>{label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
