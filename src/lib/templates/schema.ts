/**
 * The canonical template and project schemas.
 *
 * - A TemplateDefinition describes a design: its layouts per output format,
 *   editable fields, colour palettes and font sets. It is stored as JSONB in
 *   `templates.template_definition` and snapshotted in `template_versions`.
 * - ProjectData describes one customer's invitation: the field values, photos,
 *   chosen palette/fonts/format and any advanced-editor overrides. Both editor
 *   modes read and write exactly this structure, and the export engine renders
 *   from it, so switching modes or exporting never loses edits.
 *
 * Every definition and project is validated with these Zod schemas on the
 * server before it is stored or rendered.
 */
import { z } from "zod";
import { FONT_FAMILY_IDS } from "@/lib/rendering/fonts";
import { DECOR_IDS } from "@/lib/rendering/decor-ids";

export const TEMPLATE_SCHEMA_VERSION = 1;
export const PROJECT_SCHEMA_VERSION = 1;

export const FORMAT_IDS = ["portrait", "square", "landscape"] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const FORMAT_SIZES: Record<FormatId, { width: number; height: number; label: string }> = {
  portrait: { width: 1080, height: 1920, label: "Portrait 1080 × 1920" },
  square: { width: 1080, height: 1080, label: "Square 1080 × 1080" },
  landscape: { width: 1920, height: 1080, label: "Landscape 1920 × 1080" },
};

export const PALETTE_KEYS = ["background", "surface", "primary", "secondary", "accent", "text", "muted"] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex values like #FAF8F3");

/** A colour is either a literal hex value or a reference into the active palette. */
export const colorTokenSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|palette\.(background|surface|primary|secondary|accent|text|muted))$/, "Invalid colour");
export type ColorToken = z.infer<typeof colorTokenSchema>;

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,47}$/, "IDs use lowercase letters, numbers, - and _");
const fieldKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Field keys use lowercase letters, numbers and _");

export const paletteSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(40),
  colors: z.object({
    background: hexColor,
    surface: hexColor,
    primary: hexColor,
    secondary: hexColor,
    accent: hexColor,
    text: hexColor,
    muted: hexColor,
  }),
});
export type Palette = z.infer<typeof paletteSchema>;

export const fontFamilySchema = z.enum(FONT_FAMILY_IDS);
export const FONT_ROLES = ["display", "script", "body"] as const;
export type FontRole = (typeof FONT_ROLES)[number];

export const fontSetSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(40),
  display: fontFamilySchema,
  script: fontFamilySchema,
  body: fontFamilySchema,
});
export type FontSet = z.infer<typeof fontSetSchema>;

export const FIELD_TYPES = ["text", "multiline", "date", "time", "image"] as const;
export const FIELD_GROUPS = ["names", "event", "details", "rsvp", "message", "photos"] as const;

export const fieldDefinitionSchema = z
  .object({
    key: fieldKeySchema,
    label: z.string().min(1).max(60),
    type: z.enum(FIELD_TYPES),
    group: z.enum(FIELD_GROUPS),
    required: z.boolean(),
    maxLength: z.number().int().min(1).max(600).optional(),
    placeholder: z.string().max(120).optional(),
    help: z.string().max(200).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type !== "image" && field.maxLength === undefined) {
      ctx.addIssue({ code: "custom", message: `Text field "${field.key}" needs a maxLength`, path: ["maxLength"] });
    }
  });
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

export const textStyleSchema = z.object({
  fontRole: z.enum(FONT_ROLES),
  /** Optional explicit family; overrides the role's font from the font set. */
  fontFamily: fontFamilySchema.optional(),
  fontSize: z.number().min(8).max(600),
  minFontSize: z.number().min(8).max(600),
  weight: z.union([z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]),
  italic: z.boolean(),
  color: colorTokenSchema,
  align: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  /** Letter spacing in em. */
  letterSpacing: z.number().min(-0.1).max(1),
  lineHeight: z.number().min(0.7).max(3),
  transform: z.enum(["none", "uppercase"]),
  maxLines: z.number().int().min(1).max(30),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

const baseElement = {
  id: idSchema,
  name: z.string().min(1).max(60),
  x: z.number().min(-4000).max(8000),
  y: z.number().min(-4000).max(8000),
  w: z.number().min(1).max(8000),
  h: z.number().min(1).max(8000),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  /** Locked elements are decorative and cannot be selected in the advanced editor. */
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
};

export const textElementSchema = z.object({
  ...baseElement,
  type: z.literal("text"),
  /**
   * Text content. `{field_key}` placeholders are replaced with field values;
   * formatters are available, e.g. `{event_date|long}` or `{event_time|time}`.
   */
  content: z.string().max(800),
  style: textStyleSchema,
});

export const imageElementSchema = z.object({
  ...baseElement,
  type: z.literal("image"),
  field: fieldKeySchema,
  frame: z.object({
    shape: z.enum(["rect", "rounded", "circle", "arch"]),
    radius: z.number().min(0).max(2000).default(0),
    stroke: colorTokenSchema.optional(),
    strokeWidth: z.number().min(0).max(80).default(0),
  }),
  filter: z.enum(["none", "grayscale", "warm", "cool"]).default("none"),
});

export const shapeElementSchema = z.object({
  ...baseElement,
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "line"]),
  fill: z.union([colorTokenSchema, z.literal("none")]).default("none"),
  fillOpacity: z.number().min(0).max(1).default(1),
  stroke: colorTokenSchema.optional(),
  strokeWidth: z.number().min(0).max(200).default(0),
  radius: z.number().min(0).max(4000).default(0),
  dash: z.array(z.number().min(0).max(200)).max(4).optional(),
});

export const decorElementSchema = z.object({
  ...baseElement,
  type: z.literal("decor"),
  decor: z.enum(DECOR_IDS),
  colors: z.array(colorTokenSchema).min(1).max(4),
  seed: z.number().int().min(0).max(100000).default(1),
  density: z.number().min(0.1).max(4).default(1),
  strokeWidth: z.number().min(0.5).max(40).default(3),
});

export const elementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  shapeElementSchema,
  decorElementSchema,
]);
export type TemplateElement = z.infer<typeof elementSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type DecorElement = z.infer<typeof decorElementSchema>;
export type ElementInput = z.input<typeof elementSchema>;

export const backgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: colorTokenSchema }),
  z.object({
    type: z.literal("linear"),
    from: colorTokenSchema,
    to: colorTokenSchema,
    angle: z.number().min(0).max(360),
  }),
  z.object({ type: z.literal("radial"), from: colorTokenSchema, to: colorTokenSchema }),
]);
export type Background = z.infer<typeof backgroundSchema>;

export const layoutSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  background: backgroundSchema,
  elements: z.array(elementSchema).min(1).max(150),
});
export type Layout = z.infer<typeof layoutSchema>;

export const SAMPLE_IMAGE_IDS = [
  "sunset-couple",
  "garden-couple",
  "balloons",
  "city-lights",
  "graduate",
  "nursery",
  "brunch-table",
  "celebration",
  "birthday-portrait",
  "golden-hour",
] as const;
export type SampleImageId = (typeof SAMPLE_IMAGE_IDS)[number];

export const templateDefinitionSchema = z
  .object({
    schemaVersion: z.literal(TEMPLATE_SCHEMA_VERSION),
    fields: z.array(fieldDefinitionSchema).min(1).max(40),
    palettes: z.array(paletteSchema).min(1).max(8),
    fontSets: z.array(fontSetSchema).min(1).max(6),
    defaultPaletteId: idSchema,
    defaultFontSetId: idSchema,
    defaultFormat: z.enum(FORMAT_IDS),
    formats: z.object({
      portrait: layoutSchema.optional(),
      square: layoutSchema.optional(),
      landscape: layoutSchema.optional(),
    }),
    sampleData: z.record(z.string(), z.string().max(600)),
    sampleImages: z.record(z.string(), z.enum(SAMPLE_IMAGE_IDS)),
    capabilities: z.object({
      advancedEditor: z.boolean(),
      paletteSwitch: z.boolean(),
      fontSwitch: z.boolean(),
      formatSwitch: z.boolean(),
    }),
  })
  .superRefine((def, ctx) => {
    const fieldKeys = new Set<string>();
    for (const f of def.fields) {
      if (fieldKeys.has(f.key)) ctx.addIssue({ code: "custom", message: `Duplicate field key "${f.key}"`, path: ["fields"] });
      fieldKeys.add(f.key);
    }
    if (!def.palettes.some((p) => p.id === def.defaultPaletteId)) {
      ctx.addIssue({ code: "custom", message: "defaultPaletteId does not match any palette", path: ["defaultPaletteId"] });
    }
    if (!def.fontSets.some((f) => f.id === def.defaultFontSetId)) {
      ctx.addIssue({ code: "custom", message: "defaultFontSetId does not match any font set", path: ["defaultFontSetId"] });
    }
    if (!def.formats[def.defaultFormat]) {
      ctx.addIssue({ code: "custom", message: "defaultFormat has no layout", path: ["defaultFormat"] });
    }
    const imageFields = new Set(def.fields.filter((f) => f.type === "image").map((f) => f.key));
    for (const formatId of FORMAT_IDS) {
      const layout = def.formats[formatId];
      if (!layout) continue;
      const size = FORMAT_SIZES[formatId];
      if (layout.width !== size.width || layout.height !== size.height) {
        ctx.addIssue({
          code: "custom",
          message: `${formatId} layout must be ${size.width}×${size.height}`,
          path: ["formats", formatId],
        });
      }
      const ids = new Set<string>();
      layout.elements.forEach((el, index) => {
        const path = ["formats", formatId, "elements", index];
        if (ids.has(el.id)) ctx.addIssue({ code: "custom", message: `Duplicate element id "${el.id}"`, path });
        ids.add(el.id);
        if (el.type === "image" && !imageFields.has(el.field)) {
          ctx.addIssue({ code: "custom", message: `Image element "${el.id}" uses unknown image field "${el.field}"`, path });
        }
        if (el.type === "text") {
          for (const key of extractPlaceholderKeys(el.content)) {
            if (!fieldKeys.has(key)) {
              ctx.addIssue({ code: "custom", message: `Text element "${el.id}" references unknown field "${key}"`, path });
            }
          }
          if (el.style.minFontSize > el.style.fontSize) {
            ctx.addIssue({ code: "custom", message: `Text element "${el.id}" has minFontSize above fontSize`, path });
          }
        }
        if (el.x + el.w < 0 || el.y + el.h < 0 || el.x > layout.width || el.y > layout.height) {
          ctx.addIssue({ code: "custom", message: `Element "${el.id}" is entirely outside the canvas`, path });
        }
      });
    }
    for (const f of def.fields) {
      if (f.type === "image" && !def.sampleImages[f.key]) {
        ctx.addIssue({ code: "custom", message: `Image field "${f.key}" needs a sample image`, path: ["sampleImages"] });
      }
      if (f.type !== "image" && f.required && !def.sampleData[f.key]) {
        ctx.addIssue({ code: "custom", message: `Required field "${f.key}" needs sample data`, path: ["sampleData"] });
      }
    }
  });
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;
export type TemplateDefinitionInput = z.input<typeof templateDefinitionSchema>;

const PLACEHOLDER_RE = /\{([a-z][a-z0-9_]*)(?:\|([a-z0-9]+))?\}/g;

export function extractPlaceholderKeys(content: string): string[] {
  return [...content.matchAll(PLACEHOLDER_RE)].map((m) => m[1]!);
}

export { PLACEHOLDER_RE };

/* ------------------------------------------------------------------ */
/* Project data                                                        */
/* ------------------------------------------------------------------ */

export const imageSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sample"), id: z.enum(SAMPLE_IMAGE_IDS) }),
  z.object({ kind: z.literal("asset"), assetId: z.string().uuid() }),
  /** Only valid in a guest's browser; converted to an asset when the guest signs in. */
  z.object({ kind: z.literal("local"), localId: z.string().regex(/^[a-z0-9-]{8,64}$/) }),
]);
export type ImageSource = z.infer<typeof imageSourceSchema>;

export const imageValueSchema = z.object({
  source: imageSourceSchema,
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  fit: z.enum(["fill", "fit"]),
  crop: z.object({
    zoom: z.number().min(1).max(4),
    offsetX: z.number().min(-1).max(1),
    offsetY: z.number().min(-1).max(1),
  }),
});
export type ImageValue = z.infer<typeof imageValueSchema>;

/** Properties the advanced editor may change on an existing template element. */
export const elementPatchSchema = z.object({
  x: z.number().min(-4000).max(8000).optional(),
  y: z.number().min(-4000).max(8000).optional(),
  w: z.number().min(10).max(8000).optional(),
  h: z.number().min(10).max(8000).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(1).optional(),
  hidden: z.boolean().optional(),
  content: z.string().max(800).optional(),
  style: textStyleSchema.partial().optional(),
  fill: z.union([colorTokenSchema, z.literal("none")]).optional(),
  colors: z.array(colorTokenSchema).min(1).max(4).optional(),
  filter: z.enum(["none", "grayscale", "warm", "cool"]).optional(),
});
export type ElementPatch = z.infer<typeof elementPatchSchema>;

export const formatOverridesSchema = z.object({
  elements: z.record(idSchema, elementPatchSchema).default({}),
  /** Elements the customer added in the advanced editor (text or extra photos). */
  added: z.array(z.union([textElementSchema, imageElementSchema])).max(30).default([]),
  /** Custom layer order (bottom → top) when the customer reordered layers. */
  order: z.array(idSchema).max(200).optional(),
});
export type FormatOverrides = z.infer<typeof formatOverridesSchema>;

export const projectDataSchema = z.object({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  templateSlug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  templateVersion: z.number().int().min(1),
  format: z.enum(FORMAT_IDS),
  paletteId: idSchema,
  fontSetId: idSchema,
  fields: z.record(fieldKeySchema, z.string().max(600)),
  images: z.record(fieldKeySchema, imageValueSchema.nullable()),
  overrides: z.object({
    portrait: formatOverridesSchema.optional(),
    square: formatOverridesSchema.optional(),
    landscape: formatOverridesSchema.optional(),
  }),
});
export type ProjectData = z.infer<typeof projectDataSchema>;
