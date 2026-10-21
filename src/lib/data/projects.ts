import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { templateDefinitionSchema, type TemplateDefinition } from "@/lib/templates/schema";

export interface ProjectRow {
  id: string;
  owner_id: string;
  template_id: string;
  template_version: number;
  title: string;
  editor_mode: "auto" | "advanced";
  project_data: unknown;
  status: "draft" | "purchased" | "archived";
  revision: number;
  created_at: string;
  updated_at: string;
}

export const PROJECT_COLUMNS = "id, owner_id, template_id, template_version, title, editor_mode, project_data, status, revision, created_at, updated_at";

/** Loads a template definition at a specific version (projects stay pinned to the version they started with). */
export async function loadTemplateVersion(supabase: SupabaseClient, templateId: string, version: number): Promise<TemplateDefinition | null> {
  const { data } = await supabase.from("template_versions").select("definition").eq("template_id", templateId).eq("version", version).maybeSingle();
  if (!data) return null;
  const parsed = templateDefinitionSchema.safeParse(data.definition);
  return parsed.success ? parsed.data : null;
}

export async function loadTemplateMeta(supabase: SupabaseClient, templateId: string) {
  const { data } = await supabase
    .from("templates")
    .select("id, slug, name, version, price_amount, multi_format_price_amount, currency, is_free, supported_formats, is_published, is_archived")
    .eq("id", templateId)
    .maybeSingle();
  return data as
    | {
        id: string;
        slug: string;
        name: string;
        version: number;
        price_amount: number;
        multi_format_price_amount: number | null;
        currency: string;
        is_free: boolean;
        supported_formats: string[];
        is_published: boolean;
        is_archived: boolean;
      }
    | null;
}

/** Returns which of the given asset ids belong to the user. */
export async function ownedAssetIds(supabase: SupabaseClient, userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await supabase.from("project_assets").select("id").eq("owner_id", userId).in("id", ids);
  return new Set((data ?? []).map((r) => r.id as string));
}
