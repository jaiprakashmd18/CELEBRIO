import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EditorApp } from "@/components/editor/editor-app";
import { requireUser } from "@/lib/auth";
import { PROJECT_COLUMNS, loadTemplateMeta, loadTemplateVersion, type ProjectRow } from "@/lib/data/projects";
import { projectDataSchema } from "@/lib/templates/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit invitation" };

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/editor/${projectId}`);
  if (!z.string().uuid().safeParse(projectId).success) notFound();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  const row = data as ProjectRow | null;
  // RLS already limits rows to the owner; this check keeps admins from opening customers' editors.
  if (!row || row.owner_id !== user.id) notFound();

  const [definition, meta] = await Promise.all([loadTemplateVersion(supabase, row.template_id, row.template_version), loadTemplateMeta(supabase, row.template_id)]);
  const project = projectDataSchema.safeParse(row.project_data);
  if (!definition || !meta || !project.success) notFound();

  return (
    <EditorApp
      definition={definition}
      template={{
        id: meta.id,
        slug: meta.slug,
        name: meta.name,
        version: row.template_version,
        priceAmount: meta.price_amount,
        multiFormatPriceAmount: meta.multi_format_price_amount,
        currency: meta.currency,
        isFree: meta.is_free,
      }}
      project={project.data}
      projectId={row.id}
      revision={row.revision}
      mode={sp.mode === "advanced" ? "advanced" : row.editor_mode}
      signedIn
      purchased={row.status === "purchased"}
      title={row.title}
      accountsAvailable
      resumeGuestDraft={false}
    />
  );
}
