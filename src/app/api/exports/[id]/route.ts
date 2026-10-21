import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { EXPORT_DENIAL_MESSAGES } from "@/lib/entitlements";
import { authorizeCleanExport, exportFileName, loadProjectForRender } from "@/lib/exports/service";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Returns a fresh short-lived download link for a completed export, re-checking the entitlement. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: false });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "File not found.");
  const admin = createSupabaseAdminClient();
  const { data: job } = await admin.from("export_jobs").select("id, user_id, project_id, requested_format, file_type, status, output_storage_path").eq("id", id).maybeSingle();
  if (!job || job.user_id !== guard.user.id || !job.project_id) return jsonError(404, "not_found", "File not found.");
  if (job.status !== "completed" || !job.output_storage_path) return NextResponse.json({ status: job.status });

  const project = await loadProjectForRender(admin, job.project_id);
  if (!project) return jsonError(404, "not_found", "File not found.");
  const decision = await authorizeCleanExport(admin, guard.user.id, project, job.requested_format, job.file_type);
  if (!decision.allowed) return jsonError(402, decision.reason, EXPORT_DENIAL_MESSAGES[decision.reason]);

  const ext = job.output_storage_path.split(".").pop() ?? "png";
  const { data: signed } = await admin.storage.from("exports").createSignedUrl(job.output_storage_path, 300, { download: exportFileName(project.title, job.requested_format, ext) });
  if (!signed) return jsonError(404, "expired", "This file has expired. Please generate it again.");
  return NextResponse.json({ status: "completed", url: signed.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
