import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { ProjectActions } from "@/components/shared/project-actions";
import { ProjectCard } from "@/components/shared/project-card";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { listMyProjects } from "@/lib/data/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const user = await requireUser("/dashboard");
  const supabase = await createSupabaseServerClient();
  const [projects, { data: profile }, { count: purchases }] = await Promise.all([
    listMyProjects(supabase, { limit: 3 }),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
  ]);
  return (
    <div className="space-y-10">
      {notice === "password-updated" && <Alert tone="success">Your password has been updated.</Alert>}
      {notice === "admin-only" && <Alert tone="error">That area is for administrators only.</Alert>}
      {!user.emailVerified && <Alert tone="error" title="Verify your email">Please confirm your email address using the link we sent you. You need a verified email to make purchases.</Alert>}
      <div>
        <h1 className="font-serif text-4xl">Hello{profile?.display_name ? `, ${profile.display_name}` : ""}</h1>
        <p className="mt-2 text-gray">You have {purchases ?? 0} unlocked {purchases === 1 ? "invitation" : "invitations"}.</p>
      </div>
      <section aria-labelledby="recent">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="font-serif text-2xl">Recent invitations</h2>
          <Link href="/dashboard/drafts" className="inline-flex items-center gap-1 text-sm underline underline-offset-2">All drafts <ArrowRight aria-hidden className="size-4" /></Link>
        </div>
        {projects.length === 0 ? (
          <div className="mt-6"><EmptyState icon={<PenLine className="size-6" />} title="No invitations yet" description="Pick a design and start personalising — it only takes a few minutes." action={<ButtonLink href="/templates">Browse templates</ButtonLink>} /></div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => <ProjectCard key={p.id} project={p} actions={<ProjectActions id={p.id} purchased={p.status === "purchased"} />} />)}
          </div>
        )}
      </section>
    </div>
  );
}
