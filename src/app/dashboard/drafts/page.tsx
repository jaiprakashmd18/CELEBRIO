import { requireUser } from "@/lib/auth";
import { PenLine } from "lucide-react";
import { ProjectActions } from "@/components/shared/project-actions";
import { ProjectCard } from "@/components/shared/project-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { listMyProjects } from "@/lib/data/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "My drafts" };

export default async function DraftsPage() {
  await requireUser("/dashboard/drafts");
  const projects = await listMyProjects(await createSupabaseServerClient());
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">My invitations</h1>
          <p className="mt-2 text-gray">Drafts save automatically. Open one to keep editing.</p>
        </div>
        <ButtonLink href="/templates" variant="secondary">New invitation</ButtonLink>
      </div>
      {projects.length === 0 ? (
        <div className="mt-8"><EmptyState icon={<PenLine className="size-6" />} title="No drafts yet" description="Choose a template to create your first invitation." action={<ButtonLink href="/templates">Browse templates</ButtonLink>} /></div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} actions={<ProjectActions id={p.id} purchased={p.status === "purchased"} />} />)}
        </div>
      )}
    </div>
  );
}
