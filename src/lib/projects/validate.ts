/**
 * Server-side validation of a customer's project against its template.
 * The Zod schema checks structure and safe bounds (positions, sizes, colours,
 * fonts, lengths); this adds the template-specific rules.
 */
import { availableFormats, layoutFor } from "@/lib/rendering/scene";
import { projectDataSchema, type ProjectData, type TemplateDefinition } from "@/lib/templates/schema";

export interface ProjectValidationOptions {
  templateSlug: string;
  templateVersion: number;
  /** Asset ids the current user owns; any other reference is rejected. */
  ownedAssetIds?: Set<string>;
  /** Guests may hold browser-only images; stored projects may not. */
  allowLocalImages?: boolean;
}

export type ProjectValidationResult = { ok: true; data: ProjectData } | { ok: false; errors: string[] };

export function collectAssetIds(project: ProjectData): string[] {
  const ids = new Set<string>();
  for (const value of Object.values(project.images)) {
    if (value?.source.kind === "asset") ids.add(value.source.assetId);
  }
  return [...ids];
}

export function validateProjectForTemplate(def: TemplateDefinition, input: unknown, opts: ProjectValidationOptions): ProjectValidationResult {
  const parsed = projectDataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "project"}: ${i.message}`) };
  }
  const data = parsed.data;
  const errors: string[] = [];

  if (data.templateSlug !== opts.templateSlug) errors.push("Project belongs to a different template");
  if (data.templateVersion !== opts.templateVersion) errors.push("Project template version does not match");
  if (!availableFormats(def).includes(data.format)) errors.push("Format is not supported by this template");
  if (!def.palettes.some((p) => p.id === data.paletteId)) errors.push("Unknown colour palette");
  if (!def.fontSets.some((f) => f.id === data.fontSetId)) errors.push("Unknown font set");

  const fields = new Map(def.fields.map((f) => [f.key, f]));
  for (const [key, value] of Object.entries(data.fields)) {
    const field = fields.get(key);
    if (!field || field.type === "image") {
      errors.push(`Unknown text field "${key}"`);
      continue;
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) errors.push(`"${field.label}" is longer than ${field.maxLength} characters`);
    if (field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push(`"${field.label}" must be a date`);
    if (field.type === "time" && value && !/^\d{2}:\d{2}$/.test(value)) errors.push(`"${field.label}" must be a time`);
  }

  const addedImageFields = new Set<string>();
  for (const format of Object.keys(data.overrides) as Array<keyof ProjectData["overrides"]>) {
    const o = data.overrides[format];
    if (!o) continue;
    if (!def.formats[format]) {
      errors.push(`Overrides for unsupported format "${format}"`);
      continue;
    }
    const templateIds = new Set(layoutFor(def, format).elements.map((el) => el.id));
    for (const id of Object.keys(o.elements)) {
      if (!templateIds.has(id) && !o.added.some((a) => a.id === id)) errors.push(`Override for unknown element "${id}"`);
    }
    for (const el of o.added) {
      if (templateIds.has(el.id)) errors.push(`Added element id "${el.id}" clashes with the template`);
      if (el.type === "image") addedImageFields.add(el.field);
    }
    if (o.order) {
      const known = new Set([...templateIds, ...o.added.map((a) => a.id)]);
      if (o.order.some((id) => !known.has(id))) errors.push("Layer order references unknown elements");
    }
  }

  const imageFields = new Set(def.fields.filter((f) => f.type === "image").map((f) => f.key));
  for (const [key, value] of Object.entries(data.images)) {
    if (!imageFields.has(key) && !addedImageFields.has(key)) errors.push(`Unknown image field "${key}"`);
    if (!value) continue;
    if (value.source.kind === "local" && !opts.allowLocalImages) errors.push("Photos must be uploaded before saving");
    if (value.source.kind === "asset" && opts.ownedAssetIds && !opts.ownedAssetIds.has(value.source.assetId)) {
      errors.push("A photo in this project does not belong to your account");
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

/** Required text fields that are still empty — shown to the customer before checkout. */
export function missingRequiredFields(def: TemplateDefinition, project: ProjectData): string[] {
  return def.fields.filter((f) => f.type !== "image" && f.required && !(project.fields[f.key] ?? "").trim()).map((f) => f.label);
}
