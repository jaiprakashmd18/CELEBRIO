import { z } from "zod";
import { guardApi } from "@/lib/api";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Streams a private customer photo to its owner only. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: false });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "Photo not found.");

  const supabase = await createSupabaseServerClient();
  const { data: asset } = await supabase.from("project_assets").select("storage_path, mime_type, owner_id").eq("id", id).maybeSingle();
  if (!asset || asset.owner_id !== guard.user.id) return jsonError(404, "not_found", "Photo not found.");

  const { data, error } = await createSupabaseAdminClient().storage.from("project-assets").download(asset.storage_path);
  if (error || !data) return jsonError(404, "not_found", "Photo not found.");
  return new Response(data.stream(), {
    headers: {
      "Content-Type": asset.mime_type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
