import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Audit log" };

export default async function AdminAuditPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: logs } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Audit log</h1>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-gray"><tr><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(logs ?? []).map((l) => (
              <tr key={l.id}>
                <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-IN")}</td>
                <td className="p-3 font-mono text-xs">{l.actor_id?.slice(0, 8) ?? "system"}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{l.entity_type}{l.entity_id ? ` · ${String(l.entity_id).slice(0, 8)}` : ""}</td>
                <td className="p-3 font-mono text-xs">{JSON.stringify(l.safe_metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
