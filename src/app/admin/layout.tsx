import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { AdminNav } from "@/components/shared/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Celebrio" }, robots: { index: false, follow: false } };

/** Every admin page is protected by a server-verified admin_users lookup. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin("/admin");
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="border-b border-line bg-white">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3"><Logo /><span className="rounded-full bg-charcoal px-2 py-0.5 text-xs text-ivory">Admin</span></div>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-gray sm:inline">{user.email}</span><Link href="/dashboard" className="underline">Exit admin</Link></div>
        </div>
        <AdminNav />
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
