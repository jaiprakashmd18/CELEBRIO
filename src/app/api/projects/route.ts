import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { loadTemplateVersion, ownedAssetIds } from "@/lib/data/projects";
import { collectAssetIds, validateProjectForTemplate } from "@/lib/projects/validate";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  templateSlug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  projectData: z.unknown(),
  title: z.string().trim().min(1).max(100).optional(),
  editorMode: z.enum(["auto", "advanced"]).default("auto"),
});

/** Creates a draft project for the signed-in user. */
export async function POST(request: Request) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const { user } = guard;
  if (!(await checkRateLimit("projectWrite", user.id))) return jsonError(429, "rate_limited", "Too many changes at once. Please wait a moment.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_input", "Invalid request.");

  const supabase = await createSupabaseServerClient();
  const { data: template } = await supabase
    .from("templates")
    .select("id, name, version")
    .eq("slug", body.data.templateSlug)
    .eq("is_published", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (!template) return jsonError(404, "template_not_found", "This template is no longer available.");

  const definition = await loadTemplateVersion(supabase, template.id, template.version);
  if (!definition) return jsonError(500, "template_invalid", "This template could not be loaded.");

  const pd = body.data.projectData as { images?: Record<string, { source?: { kind?: string; assetId?: string } } | null> } | null;
  const candidateAssets = Object.values(pd?.images ?? {})
    .map((v) => (v?.source?.kind === "asset" ? v.source.assetId : null))
    .filter((v): v is string => typeof v === "string");
  const owned = await ownedAssetIds(supabase, user.id, candidateAssets);
  const result = validateProjectForTemplate(definition, body.data.projectData, {
    templateSlug: body.data.templateSlug,
    templateVersion: template.version,
    ownedAssetIds: owned,
  });
  if (!result.ok) return jsonError(422, "invalid_project", "Some details couldn't be saved.", { details: result.errors });

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      template_id: template.id,
      template_version: template.version,
      title: body.data.title ?? `${template.name} invitation`,
      editor_mode: body.data.editorMode,
      project_data: result.data,
    })
    .select("id, revision, updated_at")
    .single();
  if (error || !data) return jsonError(500, "create_failed", "We couldn't create your invitation. Please try again.");

  // Attach photos uploaded before the project existed (ownership verified above).
  const assetIds = collectAssetIds(result.data);
  if (assetIds.length) {
    await createSupabaseAdminClient().from("project_assets").update({ project_id: data.id }).in("id", assetIds).eq("owner_id", user.id).is("project_id", null);
  }
  return NextResponse.json({ id: data.id, revision: data.revision, updatedAt: data.updated_at }, { status: 201 });
}
