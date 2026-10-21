import { requireAdmin } from "@/lib/auth";
import { CategoryForm } from "@/components/admin/small-forms";
import { Card } from "@/components/ui/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase.from("categories").select("id, name, slug, description, display_order, is_active").order("display_order");
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Categories</h1>
      <p className="text-sm text-gray">The eight standard occasions have dedicated pages at /invitations/&lt;slug&gt;. Changing their slugs breaks those links.</p>
      <Card className="space-y-4 p-5">
        {(categories ?? []).map((c) => <CategoryForm key={c.id} category={c} />)}
        <hr className="border-line" />
        <p className="text-sm font-medium">Add a category</p>
        <CategoryForm />
      </Card>
    </div>
  );
}
