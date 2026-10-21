import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { EXPORT_DENIAL_MESSAGES } from "@/lib/entitlements";
import { renderExport } from "@/lib/exports/rasterize";
import { authorizeCleanExport, exportFileName, loadProjectForRender, makeImageLoader, withRenderSlot, withTimeout } from "@/lib/exports/service";
import { availableFormats } from "@/lib/rendering/scene";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { FORMAT_IDS } from "@/lib/templates/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const bodySchema = z.object({ projectId: z.string().uuid(), format: z.enum(FORMAT_IDS), fileType: z.enum(["png", "jpeg", "pdf"]) });

/**
 * Generates a clean (watermark-free) export. Every request is authorised on
 * the server against a paid, non-revoked entitlement before rendering. The
 * file is stored privately and delivered through a short-lived signed URL.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_input", "Invalid export request.");
  if (!(await checkRateLimit("export", user.id))) return jsonError(429, "rate_limited", "You've generated many files recently. Please try again in a little while.");

  const admin = createSupabaseAdminClient();
  const project = await loadProjectForRender(admin, body.data.projectId);
  if (!project || project.ownerId !== user.id) return jsonError(404, "not_found", "Invitation not found.");
  if (!availableFormats(project.definition).includes(body.data.format)) return jsonError(400, "format_unsupported", "This design doesn't support that format.");

  const decision = await authorizeCleanExport(admin, user.id, project, body.data.format, body.data.fileType);
  if (!decision.allowed) return jsonError(decision.reason === "not_owner" ? 404 : 402, decision.reason, EXPORT_DENIAL_MESSAGES[decision.reason]);

  const { data: job, error: jobError } = await admin
    .from("export_jobs")
    .insert({ project_id: project.id, user_id: user.id, requested_format: body.data.format, file_type: body.data.fileType, status: "processing" })
    .select("id")
    .single();
  if (jobError || !job) return jsonError(500, "export_failed", "We couldn't start your export. Please try again.");

  const fail = async (code: string, status = 500, message = "We couldn't create your file. Please try again — if it keeps failing, contact support.") => {
    await admin.from("export_jobs").update({ status: "failed", error_code: code, completed_at: new Date().toISOString() }).eq("id", job.id);
    return jsonError(status, code, message, { jobId: job.id });
  };

  try {
    const result = await withRenderSlot(() =>
      withTimeout(
        renderExport(project.definition, { ...project.data, format: body.data.format }, body.data.fileType, {
          format: body.data.format,
          watermark: false,
          loadImage: makeImageLoader(admin, project.ownerId),
        }),
        45_000,
      ),
    );
    if (result === "busy") return fail("busy", 503, "Our export servers are busy. Please try again in a few seconds.");

    const path = `${user.id}/${job.id}.${result.extension}`;
    const { error: uploadError } = await admin.storage.from("exports").upload(path, result.bytes, { contentType: result.mime, upsert: true });
    if (uploadError) return fail("storage_failed");
    await admin.from("export_jobs").update({ status: "completed", output_storage_path: path, completed_at: new Date().toISOString() }).eq("id", job.id);

    const filename = exportFileName(project.title, body.data.format, result.extension);
    const { data: signed } = await admin.storage.from("exports").createSignedUrl(path, 300, { download: filename });
    if (!signed) return fail("sign_failed");
    return NextResponse.json({ jobId: job.id, url: signed.signedUrl, filename, width: result.width, height: result.height }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const code = err instanceof Error && err.message === "render_timeout" ? "render_timeout" : "render_failed";
    console.error("Export failed", job.id, err instanceof Error ? err.message : err);
    return fail(code);
  }
}
