import { requireAdmin } from "@/lib/auth";
import { cleanupOldExports } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Exports" };

export default async function AdminExportsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: jobs } = await supabase.from("export_jobs").select("id, project_id, requested_format, file_type, status, error_code, created_at, completed_at").order("created_at", { ascending: false }).limit(100);
  const failed = (jobs ?? []).filter((j) => j.status === "failed");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl">Exports</h1>
        <form action={cleanupOldExports}><Button type="submit" size="sm" variant="secondary">Delete files older than 30 days</Button></form>
      </div>
      <p className="text-sm text-gray">{failed.length} failed of the last {jobs?.length ?? 0} export requests. Common codes: render_timeout (try again / reduce photo size), busy (concurrency limit), storage_failed (check the exports bucket).</p>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-gray"><tr><th className="p-3">Job</th><th className="p-3">Project</th><th className="p-3">File</th><th className="p-3">Status</th><th className="p-3">Error</th><th className="p-3">Created</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(jobs ?? []).map((j) => (
              <tr key={j.id} className={j.status === "failed" ? "bg-danger/5" : undefined}>
                <td className="p-3 font-mono text-xs">{j.id.slice(0, 8)}</td>
                <td className="p-3 font-mono text-xs">{j.project_id?.slice(0, 8) ?? "deleted"}</td>
                <td className="p-3">{j.requested_format} · {j.file_type}</td>
                <td className="p-3">{j.status}</td>
                <td className="p-3">{j.error_code ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{new Date(j.created_at).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
