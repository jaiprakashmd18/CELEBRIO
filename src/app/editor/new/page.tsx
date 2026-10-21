import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorApp } from "@/components/editor/editor-app";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionUser } from "@/lib/auth";
import { getTemplateBySlug } from "@/lib/data/catalog";
import { createProjectFromTemplate } from "@/lib/rendering/scene";

export const metadata: Metadata = { title: "Personalise your invitation" };

/** Starts a new invitation. Guests can personalise freely; saving requires an account. */
export default async function NewEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const slug = typeof sp.template === "string" ? sp.template : "";
  const template = await getTemplateBySlug(slug);
  if (!template) notFound();
  const user = await getSessionUser();
  const project = createProjectFromTemplate(template.definition, { slug: template.slug, version: template.version });
  return (
    <EditorApp
      definition={template.definition}
      template={{
        id: template.id,
        slug: template.slug,
        name: template.name,
        version: template.version,
        priceAmount: template.priceAmount,
        multiFormatPriceAmount: template.multiFormatPriceAmount,
        currency: template.currency,
        isFree: template.isFree,
      }}
      project={project}
      projectId={null}
      revision={0}
      mode={sp.mode === "advanced" ? "advanced" : "auto"}
      signedIn={Boolean(user)}
      purchased={false}
      title={`${template.name} invitation`}
      accountsAvailable={isSupabaseConfigured()}
      resumeGuestDraft={sp.resume === "1"}
    />
  );
}
