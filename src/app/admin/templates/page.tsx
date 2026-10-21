import { requireAdmin } from "@/lib/auth";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Templates" };

export default async function AdminTemplatesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const { view = "all" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("templates").select("id, name, slug, is_published, is_archived, price_amount, multi_format_price_amount, currency, is_free, version, preview_path, updated_at, categories(name)").order("updated_at", { ascending: false });
  if (view === "published") q = q.eq("is_published", true);
  if (view === "draft") q = q.eq("is_published", false).eq("is_archived", false);
  if (view === "archived") q = q.eq("is_archived", true);
  const { data: templates } = await q;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl">Templates</h1>
        <ButtonLink href="/admin/templates/new">New template</ButtonLink>
      </div>
      <nav aria-label="Filter" className="flex gap-2 text-sm">
        {["all", "published", "draft", "archived"].map((v) => (
          <Link key={v} href={`/admin/templates?view=${v}`} aria-current={v === view ? "page" : undefined} className={v === view ? "rounded-full bg-charcoal px-3 py-1 capitalize text-ivory" : "rounded-full px-3 py-1 capitalize ring-1 ring-line"}>{v}</Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-gray"><tr><th className="p-3">Template</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Price</th><th className="p-3">Version</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(templates ?? []).map((t) => {
              const c = Array.isArray(t.categories) ? t.categories[0] : t.categories;
              return (
                <tr key={t.id}>
                  <td className="p-3">
                    <Link href={`/admin/templates/${t.id}`} className="flex items-center gap-3 hover:underline">
                      <span className="relative h-14 w-8 shrink-0 overflow-hidden rounded bg-sand">{t.preview_path && <Image src={t.preview_path} alt="" fill sizes="32px" className="object-cover" />}</span>
                      <span><span className="font-medium">{t.name}</span><span className="block text-xs text-gray">{t.slug}</span></span>
                    </Link>
                  </td>
                  <td className="p-3">{(c as { name?: string } | null)?.name}</td>
                  <td className="p-3">{t.is_archived ? <Badge>Archived</Badge> : t.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="gold">Draft</Badge>}</td>
                  <td className="p-3">{t.is_free ? "Free" : formatMoney(t.price_amount, t.currency)}{t.multi_format_price_amount !== null && !t.is_free && <span className="block text-xs text-gray">Multi: {formatMoney(t.multi_format_price_amount, t.currency)}</span>}</td>
                  <td className="p-3">v{t.version}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
