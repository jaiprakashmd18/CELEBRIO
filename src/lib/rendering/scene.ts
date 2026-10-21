/**
 * Combines a template definition with a customer's project data to produce
 * the final list of elements for one output format. This is the single place
 * where advanced-editor overrides are applied, so both editor modes and the
 * export engine always agree on what the invitation looks like.
 */
import {
  FORMAT_IDS,
  type ColorToken,
  type FontSet,
  type FormatId,
  type FormatOverrides,
  type Layout,
  type Palette,
  type ProjectData,
  type TemplateDefinition,
  type TemplateElement,
} from "@/lib/templates/schema";

export function availableFormats(def: TemplateDefinition): FormatId[] {
  return FORMAT_IDS.filter((f) => def.formats[f]);
}

export function layoutFor(def: TemplateDefinition, format: FormatId): Layout {
  const layout = def.formats[format] ?? def.formats[def.defaultFormat];
  if (!layout) throw new Error("Template has no layout");
  return layout;
}

export function paletteFor(def: TemplateDefinition, paletteId: string): Palette {
  return def.palettes.find((p) => p.id === paletteId) ?? def.palettes.find((p) => p.id === def.defaultPaletteId) ?? def.palettes[0]!;
}

export function fontSetFor(def: TemplateDefinition, fontSetId: string): FontSet {
  return def.fontSets.find((f) => f.id === fontSetId) ?? def.fontSets.find((f) => f.id === def.defaultFontSetId) ?? def.fontSets[0]!;
}

export function resolveColor(token: ColorToken | "none" | undefined, palette: Palette): string {
  if (!token || token === "none") return "none";
  if (token.startsWith("#")) return token;
  const key = token.slice("palette.".length) as keyof Palette["colors"];
  return palette.colors[key] ?? "#000000";
}

/** Applies overrides (moves, edits, added elements, layer order) for one format. */
export function resolveElements(def: TemplateDefinition, project: ProjectData, format: FormatId): TemplateElement[] {
  const layout = layoutFor(def, format);
  const overrides: FormatOverrides | undefined = project.overrides[format];
  const patched: TemplateElement[] = layout.elements.map((el) => {
    const patch = overrides?.elements[el.id];
    if (!patch) return el;
    const { style, fill, colors, filter, content, ...geometry } = patch;
    const next = { ...el, ...geometry } as TemplateElement;
    if (next.type === "text") {
      if (style) next.style = { ...next.style, ...style };
      if (content !== undefined) next.content = content;
    }
    if (next.type === "shape" && fill !== undefined) next.fill = fill;
    if (next.type === "decor" && colors) next.colors = colors;
    if (next.type === "image" && filter) next.filter = filter;
    return next;
  });
  const all = [...patched, ...(overrides?.added ?? [])];
  if (overrides?.order && overrides.order.length > 0) {
    const rank = new Map(overrides.order.map((id, i) => [id, i]));
    all.sort((a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1));
  }
  return all;
}

/** Creates a fresh project from a template, pre-filled with its sample content. */
export function createProjectFromTemplate(
  def: TemplateDefinition,
  meta: { slug: string; version: number },
  options: { useSampleData?: boolean } = {},
): ProjectData {
  const useSample = options.useSampleData ?? true;
  const fields: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.type === "image") continue;
    fields[f.key] = useSample ? (def.sampleData[f.key] ?? "") : "";
  }
  return {
    schemaVersion: 1,
    templateSlug: meta.slug,
    templateVersion: meta.version,
    format: def.defaultFormat,
    paletteId: def.defaultPaletteId,
    fontSetId: def.defaultFontSetId,
    fields,
    images: {},
    overrides: {},
  };
}
