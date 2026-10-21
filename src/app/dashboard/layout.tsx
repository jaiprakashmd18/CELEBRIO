import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { DashboardNav } from "@/components/shared/dashboard-nav";
import { Container } from "@/components/ui/primitives";
import { isAdmin, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "My account", template: "%s · My account · Celebrio" }, robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const admin = await isAdmin(user.id);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="grid gap-8 py-8 sm:py-12 lg:grid-cols-[14rem_1fr]">
          <DashboardNav showAdmin={admin} email={user.email ?? ""} />
          <div className="min-w-0">{children}</div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
