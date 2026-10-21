import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { serverEnv } from "@/config/env";
import { guardApi } from "@/lib/api";
import { MIN_IMAGE_SIDE, checkUpload } from "@/lib/security/file-validation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Validates and stores a customer photo:
 *   1. size, declared MIME type and file signature checks;
 *   2. decode with sharp to verify it is a real image and check dimensions;
 *   3. re-encode (auto-rotated, metadata such as GPS removed, max 3000 px);
 *   4. upload to the PRIVATE project-assets bucket under the user's folder.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const env = serverEnv();
  if (!(await checkRateLimit("upload", user.id))) return jsonError(429, "rate_limited", "You've uploaded a lot of photos recently. Please try again later.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "no_file", "Please choose a photo to upload.");
  const projectIdRaw = form?.get("projectId");
  const projectId = typeof projectIdRaw === "string" && projectIdRaw ? projectIdRaw : null;
  if (projectId && !z.string().uuid().safeParse(projectId).success) return jsonError(400, "invalid_project", "Invalid invitation.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload({ declaredType: file.type, size: bytes.byteLength, head: bytes.subarray(0, 16), maxBytes: env.UPLOAD_MAX_BYTES });
  if (!check.ok) return jsonError(400, check.code, check.message);

  if (projectId) {
    const supabase = await createSupabaseServerClient();
    const { data: project } = await supabase.from("projects").select("id, owner_id").eq("id", projectId).maybeSingle();
    if (!project || project.owner_id !== user.id) return jsonError(404, "not_found", "Invitation not found.");
  }

  let output: Buffer;
  let width: number;
  let height: number;
  let mime: "image/jpeg" | "image/png";
  try {
    const image = sharp(bytes, { limitInputPixels: env.UPLOAD_MAX_PIXELS, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) {
      return jsonError(400, "unsupported_type", "This file isn't a supported image.");
    }
    const pipeline = image.rotate().resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true });
    if (meta.hasAlpha) {
      output = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      mime = "image/png";
    } else {
      output = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      mime = "image/jpeg";
    }
    const outMeta = await sharp(output).metadata();
    width = outMeta.width ?? 0;
    height = outMeta.height ?? 0;
  } catch {
    return jsonError(400, "unreadable_image", "We couldn't read this image. It may be damaged or too large in pixels.");
  }
  if (Math.min(width, height) < MIN_IMAGE_SIDE) {
    return jsonError(400, "too_small", `This photo is very small (${width}×${height}). Please use one at least ${MIN_IMAGE_SIDE} pixels on each side.`);
  }

  const admin = createSupabaseAdminClient();
  const assetId = randomUUID();
  const path = `${user.id}/${assetId}.${mime === "image/png" ? "png" : "jpg"}`;
  const { error: uploadError } = await admin.storage.from("project-assets").upload(path, output, { contentType: mime, upsert: false });
  if (uploadError) return jsonError(500, "upload_failed", "We couldn't store your photo. Please try again.");

  const { error } = await admin.from("project_assets").insert({
    id: assetId,
    project_id: projectId,
    owner_id: user.id,
    storage_path: path,
    mime_type: mime,
    file_size: output.byteLength,
    width,
    height,
  });
  if (error) {
    await admin.storage.from("project-assets").remove([path]);
    return jsonError(500, "upload_failed", "We couldn't store your photo. Please try again.");
  }
  return NextResponse.json({ assetId, width, height }, { status: 201 });
}
