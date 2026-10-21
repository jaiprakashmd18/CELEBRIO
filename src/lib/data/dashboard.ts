import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectDataSchema, templateDefinitionSchema, type ProjectData, type TemplateDefinition } from "@/lib/templates/schema";

export interface DashboardProject {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  templateName: string;
  definition: TemplateDefinition | null;
  data: ProjectData | null;
}

/** Lists the signed-in user's projects (RLS-scoped) with their pinned template definitions. */
export async function listMyProjects(supabase: SupabaseClient, opts: { status?: "draft" | "purchased"; limit?: number } = {}): Promise<DashboardProject[]> {
  let q = supabase.from("projects").select("id, title, status, updated_at, template_id, template_version, project_data, templates(name)").order("updated_at", { ascending: false }).limit(opts.limit ?? 60);
  if (opts.status) q = q.eq("status", opts.status);
  const { data: rows } = await q;
  if (!rows?.length) return [];
  const templateIds = [...new Set(rows.map((r) => r.template_id as string))];
  const { data: versions } = await supabase.from("template_versions").select("template_id, version, definition").in("template_id", templateIds);
  const defs = new Map<string, TemplateDefinition>();
  for (const v of versions ?? []) {
    const parsed = templateDefinitionSchema.safeParse(v.definition);
    if (parsed.success) defs.set(`${v.template_id}:${v.version}`, parsed.data);
  }
  return rows.map((r) => {
    const parsed = projectDataSchema.safeParse(r.project_data);
    const t = Array.isArray(r.templates) ? r.templates[0] : r.templates;
    return {
      id: r.id as string,
      title: r.title as string,
      status: r.status as string,
      updatedAt: r.updated_at as string,
      templateName: (t as { name?: string } | null)?.name ?? "Template",
      definition: defs.get(`${r.template_id}:${r.template_version}`) ?? null,
      data: parsed.success ? parsed.data : null,
    };
  });
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
