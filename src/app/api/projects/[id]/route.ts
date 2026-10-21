import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { PROJECT_COLUMNS, loadTemplateVersion, ownedAssetIds, type ProjectRow } from "@/lib/data/projects";
import { collectAssetIds, validateProjectForTemplate } from "@/lib/projects/validate";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

async function loadOwned(id: string) {
  const supabase = await createSupabaseServerClient();
  // RLS restricts this to the signed-in owner; the owner check below is defence in depth.
  const { data } = await supabase.from("projects").select(`${PROJECT_COLUMNS}, templates(slug)`).eq("id", id).maybeSingle();
  return { supabase, project: data as (ProjectRow & { templates: { slug: string } | null }) | null };
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: false });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return jsonError(404, "not_found", "Invitation not found.");
  const { project } = await loadOwned(id);
  if (!project || project.owner_id !== guard.user.id) return jsonError(404, "not_found", "Invitation not found.");
  return NextResponse.json(
    { id: project.id, revision: project.revision, projectData: project.project_data, title: project.title, editorMode: project.editor_mode, updatedAt: project.updated_at, status: project.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const patchSchema = z.object({
  revision: z.number().int().min(1),
  projectData: z.unknown().optional(),
  title: z.string().trim().min(1).max(100).optional(),
  editorMode: z.enum(["auto", "advanced"]).optional(),
});

/**
 * Saves a project. The client sends the revision it last saw; if another tab
 * or device saved in the meantime the update matches no row and we return 409
 * with the latest revision so the customer can choose which version to keep.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return jsonError(404, "not_found", "Invitation not found.");
  if (!(await checkRateLimit("projectWrite", user.id))) return jsonError(429, "rate_limited", "Saving too quickly. Please wait a moment.");

  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_input", "Invalid request.");

  const { supabase, project } = await loadOwned(id);
  if (!project || project.owner_id !== user.id) return jsonError(404, "not_found", "Invitation not found.");

  const update: Record<string, unknown> = { revision: body.data.revision + 1 };
  if (body.data.title) update.title = body.data.title;
  if (body.data.editorMode) update.editor_mode = body.data.editorMode;
  if (body.data.projectData !== undefined) {
    const definition = await loadTemplateVersion(supabase, project.template_id, project.template_version);
    if (!definition) return jsonError(500, "template_invalid", "This invitation's template could not be loaded.");
    const pd = body.data.projectData as { images?: Record<string, { source?: { kind?: string; assetId?: string } } | null> } | null;
    const candidateAssets = Object.values(pd?.images ?? {})
      .map((v) => (v?.source?.kind === "asset" ? v.source.assetId : null))
      .filter((v): v is string => typeof v === "string");
    const result = validateProjectForTemplate(definition, body.data.projectData, {
      templateSlug: project.templates?.slug ?? "",
      templateVersion: project.template_version,
      ownedAssetIds: await ownedAssetIds(supabase, user.id, candidateAssets),
    });
    if (!result.ok) return jsonError(422, "invalid_project", "Some details couldn't be saved.", { details: result.errors });
    update.project_data = result.data;
    const assets = collectAssetIds(result.data);
    if (assets.length) {
      await createSupabaseAdminClient().from("project_assets").update({ project_id: project.id }).in("id", assets).eq("owner_id", user.id).is("project_id", null);
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .eq("revision", body.data.revision)
    .select("revision, updated_at")
    .maybeSingle();
  if (error) return jsonError(500, "save_failed", "We couldn't save your changes. Please try again.");
  if (!data) {
    const { data: latest } = await supabase.from("projects").select("revision, project_data, updated_at").eq("id", id).maybeSingle();
    return jsonError(409, "conflict", "This invitation was changed in another tab or device.", {
      latestRevision: latest?.revision,
      latestProjectData: latest?.project_data,
      latestUpdatedAt: latest?.updated_at,
    });
  }
  return NextResponse.json({ revision: data.revision, updatedAt: data.updated_at }, { headers: { "Cache-Control": "no-store" } });
}

/** Deletes a project and its private photos and generated files. Order records are kept. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return jsonError(404, "not_found", "Invitation not found.");
  const { supabase, project } = await loadOwned(id);
  if (!project || project.owner_id !== guard.user.id) return jsonError(404, "not_found", "Invitation not found.");

  const admin = createSupabaseAdminClient();
  const [{ data: assets }, { data: exports }] = await Promise.all([
    admin.from("project_assets").select("storage_path").eq("project_id", id).eq("owner_id", guard.user.id),
    admin.from("export_jobs").select("output_storage_path").eq("project_id", id).not("output_storage_path", "is", null),
  ]);
  const assetPaths = (assets ?? []).map((a) => a.storage_path as string);
  const exportPaths = (exports ?? []).map((e) => e.output_storage_path as string);
  if (assetPaths.length) await admin.storage.from("project-assets").remove(assetPaths);
  if (exportPaths.length) await admin.storage.from("exports").remove(exportPaths);

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return jsonError(500, "delete_failed", "We couldn't delete this invitation. Please try again.");
  return NextResponse.json({ ok: true });
}
