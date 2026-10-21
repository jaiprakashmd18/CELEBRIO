import { requireAdmin } from "@/lib/auth";
import { NewTemplateForm } from "@/components/admin/template-forms";
import { STARTER_TEMPLATES } from "@/templates/starter";
import { templateDefinitionSchema } from "@/lib/templates/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "New template" };

export default async function NewTemplatePage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("display_order");
  const starters = STARTER_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, definition: JSON.stringify(templateDefinitionSchema.parse(t.definition), null, 2) }));
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">New template</h1>
      <p className="max-w-2xl text-sm text-gray">New templates start as drafts. Validate the definition, generate or upload a preview, then publish when you&apos;re happy with it.</p>
      <NewTemplateForm categories={categories ?? []} starters={starters} />
    </div>
  );
}
