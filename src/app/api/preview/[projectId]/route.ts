import sharp from "sharp";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { renderPng } from "@/lib/exports/rasterize";
import { loadProjectForRender, makeImageLoader, withRenderSlot } from "@/lib/exports/service";
import { availableFormats } from "@/lib/rendering/scene";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { FORMAT_IDS } from "@/lib/templates/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

/** Low-resolution, watermarked preview image. Available to the owner without payment. */
export async function GET(request: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const guard = await guardApi(request, { mutating: false });
  if ("response" in guard) return guard.response;
  const { projectId } = await ctx.params;
  if (!z.string().uuid().safeParse(projectId).success) return jsonError(404, "not_found", "Invitation not found.");
  if (!(await checkRateLimit("preview", guard.user.id))) return jsonError(429, "rate_limited", "Too many previews. Please wait a little.");
  const admin = createSupabaseAdminClient();
  const project = await loadProjectForRender(admin, projectId);
  if (!project || project.ownerId !== guard.user.id) return jsonError(404, "not_found", "Invitation not found.");
  const requested = new URL(request.url).searchParams.get("format");
  const format = FORMAT_IDS.find((f) => f === requested && availableFormats(project.definition).includes(f)) ?? project.data.format;

  const png = await withRenderSlot(() => renderPng(project.definition, { ...project.data, format }, { format, watermark: true, outputWidth: format === "landscape" ? 960 : 540, loadImage: makeImageLoader(admin, project.ownerId) }));
  if (png === "busy") return jsonError(503, "busy", "Please try again in a moment.");
  const webp = await sharp(png).webp({ quality: 80 }).toBuffer();
  return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
