import { requireAdmin } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { duplicateTemplate, generateTemplatePreview, setTemplateStatus, uploadTemplatePreview } from "@/app/admin/actions";
import { DefinitionEditor, TemplateMetadataForm } from "@/components/admin/template-forms";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit template" };

const ERRORS: Record<string, string> = {
  "invalid-definition": "The template definition is invalid — fix it before publishing or generating a preview.",
  "missing-preview": "Add a preview image before publishing.",
  "upload-failed": "The preview couldn't be uploaded. Check that the template-previews bucket exists.",
  "bad-file": "Preview images must be JPEG, PNG or WebP under 5 MB.",
  "no-file": "Choose an image to upload.",
};

export default async function EditTemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; preview?: string; created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServerClient();
  const [{ data: t }, { data: categories }, { data: versions }, { count: projects }] = await Promise.all([
    supabase.from("templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("display_order"),
    supabase.from("template_versions").select("version, created_at").eq("template_id", id).order("version", { ascending: false }).limit(10),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("template_id", id),
  ]);
  if (!t) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/templates" className="text-sm underline">← Templates</Link>
          <h1 className="mt-2 font-serif text-4xl">{t.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray">
            {t.is_archived ? <Badge>Archived</Badge> : t.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="gold">Draft</Badge>}
            v{t.version} · used in {projects ?? 0} customer drafts
            {t.is_published && <Link href={`/templates/${t.slug}`} className="underline">View live</Link>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["publish", "unpublish", "archive", "restore"] as const)
            .filter((s) => (s === "publish" ? !t.is_published && !t.is_archived : s === "unpublish" ? t.is_published : s === "archive" ? !t.is_archived : t.is_archived))
            .map((s) => (
              <form key={s} action={setTemplateStatus}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="status" value={s} />
                <Button type="submit" variant={s === "publish" ? "primary" : "secondary"} size="sm" className="capitalize">{s}</Button>
              </form>
            ))}
          <form action={duplicateTemplate}><input type="hidden" name="id" value={t.id} /><Button type="submit" variant="secondary" size="sm">Duplicate</Button></form>
        </div>
      </div>
      {sp.created && <Alert tone="success">Template created as a draft.</Alert>}
      {sp.preview && <Alert tone="success">Preview image updated.</Alert>}
      {sp.error && <Alert tone="error">{ERRORS[sp.error] ?? "Something went wrong."}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="p-6">
          <h2 className="mb-4 font-serif text-2xl">Details & pricing</h2>
          <TemplateMetadataForm
            categories={categories ?? []}
            values={{ id: t.id, name: t.name, slug: t.slug, description: t.description, categoryId: t.category_id, tags: (t.tags as string[]).join(", "), style: t.style, colorFamily: t.color_family, priceAmount: t.price_amount, multiFormatPriceAmount: t.multi_format_price_amount, currency: t.currency, isFree: t.is_free }}
          />
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="font-serif text-2xl">Preview image</h2>
          <div className="relative mx-auto aspect-[9/16] w-40 overflow-hidden rounded-lg bg-sand">{t.preview_path ? <Image src={t.preview_path} alt="Current preview" fill sizes="160px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-gray">None yet</span>}</div>
          <form action={generateTemplatePreview}><input type="hidden" name="id" value={t.id} /><Button type="submit" size="sm" className="w-full">Generate from design</Button></form>
          <form action={uploadTemplatePreview} className="space-y-2">
            <input type="hidden" name="id" value={t.id} />
            <label htmlFor="preview-file" className="block text-xs font-medium text-gray">Or upload an image</label>
            <input id="preview-file" type="file" name="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-xs" required />
            <Button type="submit" size="sm" variant="secondary" className="w-full">Upload preview</Button>
          </form>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray">Versions</h3>
            <ul className="mt-2 space-y-1 text-xs">{(versions ?? []).map((v) => <li key={v.version}>v{v.version} · {new Date(v.created_at).toLocaleString("en-IN")}</li>)}</ul>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-serif text-2xl">Design definition</h2>
        <p className="mt-1 text-sm text-gray">Saving creates a new version. Customers&apos; existing drafts stay on the version they started with, so their invitations never change unexpectedly.</p>
        <div className="mt-4"><DefinitionEditor id={t.id} slug={t.slug} initial={JSON.stringify(t.template_definition, null, 2)} /></div>
      </Card>
    </div>
  );
}
