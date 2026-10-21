import { requireAdmin } from "@/lib/auth";
import { updateSupportRequest } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form-controls";
import { Card } from "@/components/ui/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Support" };

export default async function AdminSupportPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase.from("support_requests").select("*").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Support requests</h1>
      <p className="text-sm text-gray">Reply by email from your support inbox. Use the order reference to find purchases under Orders.</p>
      {(requests ?? []).map((r) => (
        <Card key={r.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{r.subject}</p>
              <p className="text-xs text-gray">{r.name} · <a className="underline" href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`}>{r.email}</a> · {new Date(r.created_at).toLocaleString("en-IN")}{r.order_reference ? ` · order ${r.order_reference}` : ""}</p>
            </div>
            <span className="rounded-full bg-sand px-2 py-0.5 text-xs">{r.status}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{r.message}</p>
          <form action={updateSupportRequest} className="mt-4 grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
            <input type="hidden" name="id" value={r.id} />
            <Select name="status" defaultValue={r.status} aria-label="Status"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></Select>
            <Textarea name="note" defaultValue={r.admin_note ?? ""} placeholder="Internal note" aria-label="Internal note" rows={1} />
            <Button type="submit" size="sm">Update</Button>
          </form>
        </Card>
      ))}
      {!requests?.length && <p className="text-gray">No support requests yet.</p>}
    </div>
  );
}
