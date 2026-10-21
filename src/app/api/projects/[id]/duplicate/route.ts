import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { PROJECT_COLUMNS, type ProjectRow } from "@/lib/data/projects";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Copies a project into a new draft. A copy is a new invitation and needs its own purchase. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: true });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "Invitation not found.");
  if (!(await checkRateLimit("projectWrite", guard.user.id))) return jsonError(429, "rate_limited", "Please wait a moment.");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle();
  const source = data as ProjectRow | null;
  if (!source || source.owner_id !== guard.user.id) return jsonError(404, "not_found", "Invitation not found.");

  const { data: copy, error } = await supabase
    .from("projects")
    .insert({
      owner_id: guard.user.id,
      template_id: source.template_id,
      template_version: source.template_version,
      title: `${source.title} (copy)`.slice(0, 100),
      editor_mode: source.editor_mode,
      project_data: source.project_data,
    })
    .select("id")
    .single();
  if (error || !copy) return jsonError(500, "duplicate_failed", "We couldn't duplicate this invitation.");
  return NextResponse.json({ id: copy.id }, { status: 201 });
}
