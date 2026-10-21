import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { FileImage } from "lucide-react";
import { DownloadButtons } from "@/components/shared/download-buttons";
import { ProjectCard } from "@/components/shared/project-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { listMyProjects } from "@/lib/data/dashboard";
import { FORMAT_IDS } from "@/lib/templates/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Purchased invitations" };

export default async function InvitationsPage() {
  await requireUser("/dashboard/invitations");
  const supabase = await createSupabaseServerClient();
  const [projects, { data: entitlements }] = await Promise.all([
    listMyProjects(supabase, { status: "purchased" }),
    supabase.from("entitlements").select("project_id, allowed_formats, status, orders!inner(status)").eq("status", "active").eq("orders.status", "paid"),
  ]);
  const formatsByProject = new Map<string, Set<string>>();
  for (const e of entitlements ?? []) {
    if (!e.project_id) continue;
    const set = formatsByProject.get(e.project_id) ?? new Set<string>();
    for (const f of e.allowed_formats as string[]) set.add(f);
    formatsByProject.set(e.project_id, set);
  }
  const unlocked = projects.filter((p) => formatsByProject.has(p.id));
  return (
    <div>
      <h1 className="font-serif text-4xl">Purchased & downloads</h1>
      <p className="mt-2 text-gray">Files are generated fresh from your latest edits each time you download. Links expire after a few minutes for your privacy — just click again.</p>
      {unlocked.length === 0 ? (
        <div className="mt-8"><EmptyState icon={<FileImage className="size-6" />} title="Nothing unlocked yet" description="When you unlock an invitation, your high-quality downloads appear here." action={<ButtonLink href="/dashboard/drafts">Go to my drafts</ButtonLink>} /></div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {unlocked.map((p) => {
            const formats = FORMAT_IDS.filter((f) => formatsByProject.get(p.id)!.has(f));
            return (
              <ProjectCard
                key={p.id}
                project={p}
                actions={
                  <div className="mt-auto space-y-3">
                    <DownloadButtons projectId={p.id} formats={formats} />
                    <Link href={`/editor/${p.id}`} className="inline-block text-sm underline">Make a correction</Link>
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
