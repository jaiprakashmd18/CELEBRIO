import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideCleanExport, type EntitlementRecord, type ExportDecision } from "@/lib/entitlements";
import { loadTemplateVersion } from "@/lib/data/projects";
import { projectDataSchema, type FormatId, type ImageSource, type ProjectData, type TemplateDefinition } from "@/lib/templates/schema";
import { loadSampleImage, type ImageBytesLoader } from "./rasterize";

export interface LoadedProject {
  id: string;
  ownerId: string;
  title: string;
  definition: TemplateDefinition;
  data: ProjectData;
}

/** Loads a project with the service role; callers must check ownership. */
export async function loadProjectForRender(admin: SupabaseClient, projectId: string): Promise<LoadedProject | null> {
  const { data: row } = await admin.from("projects").select("id, owner_id, title, template_id, template_version, project_data").eq("id", projectId).maybeSingle();
  if (!row) return null;
  const definition = await loadTemplateVersion(admin, row.template_id, row.template_version);
  const parsed = projectDataSchema.safeParse(row.project_data);
  if (!definition || !parsed.success) return null;
  return { id: row.id, ownerId: row.owner_id, title: row.title, definition, data: parsed.data };
}

export async function loadEntitlements(admin: SupabaseClient, projectId: string, userId: string): Promise<EntitlementRecord[]> {
  const { data } = await admin
    .from("entitlements")
    .select("status, allowed_formats, allowed_file_types, orders!inner(status)")
    .eq("project_id", projectId)
    .eq("user_id", userId);
  return (data ?? []).map((e) => {
    const order = Array.isArray(e.orders) ? e.orders[0] : e.orders;
    return {
      status: e.status as EntitlementRecord["status"],
      allowed_formats: e.allowed_formats as string[],
      allowed_file_types: e.allowed_file_types as string[],
      order_status: (order as { status: string } | undefined)?.status ?? "unknown",
    };
  });
}

export async function authorizeCleanExport(admin: SupabaseClient, userId: string, project: LoadedProject, format: FormatId, fileType: "png" | "jpeg" | "pdf"): Promise<ExportDecision> {
  const entitlements = await loadEntitlements(admin, project.id, userId);
  return decideCleanExport({ userId, projectOwnerId: project.ownerId, entitlements, format, fileType });
}

/** Image loader for renders: sample art from disk, customer photos from private storage (owner only). */
export function makeImageLoader(admin: SupabaseClient, ownerId: string): ImageBytesLoader {
  return async (source: ImageSource) => {
    if (source.kind === "sample") return loadSampleImage(source);
    if (source.kind !== "asset") return null;
    const { data: asset } = await admin.from("project_assets").select("storage_path, mime_type, owner_id").eq("id", source.assetId).maybeSingle();
    if (!asset || asset.owner_id !== ownerId) return null;
    const { data } = await admin.storage.from("project-assets").download(asset.storage_path);
    if (!data) return null;
    return { bytes: Buffer.from(await data.arrayBuffer()), mime: asset.mime_type };
  };
}

export function exportFileName(title: string, format: FormatId, extension: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "invitation";
  return `${base}-${format}.${extension}`;
}

/** Simple per-instance concurrency guard so one server instance renders a few files at a time. */
let active = 0;
export const MAX_CONCURRENT_RENDERS = 3;
export async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T | "busy"> {
  if (active >= MAX_CONCURRENT_RENDERS) return "busy";
  active++;
  try {
    return await fn();
  } finally {
    active--;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("render_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
