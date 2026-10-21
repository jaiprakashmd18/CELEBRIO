/**
 * Small authoring helpers for the starter templates. They only fill in
 * sensible defaults; the resulting objects are plain TemplateDefinition JSON
 * and are validated with the same Zod schema used for admin-created templates.
 */
import type { DecorId } from "@/lib/rendering/decor-ids";
import type {
  Background,
  ColorToken,
  ElementInput,
  FieldDefinition,
  FormatId,
  TemplateDefinitionInput,
  TextStyle,
} from "@/lib/templates/schema";

type TextOpts = Partial<TextStyle> & { size: number; min?: number; rot?: number; name?: string; opacity?: number };

export function text(id: string, x: number, y: number, w: number, h: number, content: string, o: TextOpts): ElementInput {
  const { size, min, rot, name, opacity, ...style } = o;
  return {
    id,
    name: name ?? id.replace(/[-_]/g, " "),
    type: "text",
    x,
    y,
    w,
    h,
    rotation: rot ?? 0,
    opacity: opacity ?? 1,
    content,
    style: {
      fontRole: "body",
      fontSize: size,
      minFontSize: min ?? Math.round(size * 0.55),
      weight: 400,
      italic: false,
      color: "palette.text",
      align: "center",
      verticalAlign: "middle",
      letterSpacing: 0,
      lineHeight: 1.2,
      transform: "none",
      maxLines: 1,
      ...style,
    },
  };
}

export function photo(
  id: string,
  field: string,
  x: number,
  y: number,
  w: number,
  h: number,
  frame: { shape: "rect" | "rounded" | "circle" | "arch"; radius?: number; stroke?: ColorToken; strokeWidth?: number },
  o: { rot?: number; filter?: "none" | "grayscale" | "warm" | "cool" } = {},
): ElementInput {
  return {
    id,
    name: id.replace(/[-_]/g, " "),
    type: "image",
    field,
    x,
    y,
    w,
    h,
    rotation: o.rot ?? 0,
    frame: { shape: frame.shape, radius: frame.radius ?? 0, stroke: frame.stroke, strokeWidth: frame.strokeWidth ?? 0 },
    filter: o.filter ?? "none",
  };
}

export function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: ColorToken | "none",
  o: { radius?: number; stroke?: ColorToken; strokeWidth?: number; opacity?: number; fillOpacity?: number; rot?: number; locked?: boolean } = {},
): ElementInput {
  return {
    id,
    name: id.replace(/[-_]/g, " "),
    type: "shape",
    shape: "rect",
    x,
    y,
    w,
    h,
    fill,
    radius: o.radius ?? 0,
    stroke: o.stroke,
    strokeWidth: o.strokeWidth ?? 0,
    opacity: o.opacity ?? 1,
    fillOpacity: o.fillOpacity ?? 1,
    rotation: o.rot ?? 0,
    locked: o.locked ?? true,
  };
}

export function ellipse(id: string, x: number, y: number, w: number, h: number, fill: ColorToken | "none", o: { stroke?: ColorToken; strokeWidth?: number; opacity?: number } = {}): ElementInput {
  return { id, name: id.replace(/[-_]/g, " "), type: "shape", shape: "ellipse", x, y, w, h, fill, stroke: o.stroke, strokeWidth: o.strokeWidth ?? 0, opacity: o.opacity ?? 1, locked: true };
}

export function hline(id: string, x: number, y: number, w: number, stroke: ColorToken, strokeWidth = 2, o: { dash?: number[]; opacity?: number } = {}): ElementInput {
  return { id, name: id.replace(/[-_]/g, " "), type: "shape", shape: "line", x, y: y - 10, w, h: 20, stroke, strokeWidth, dash: o.dash, opacity: o.opacity ?? 1, locked: true };
}

export function decor(
  id: string,
  kind: DecorId,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: ColorToken[],
  o: { seed?: number; density?: number; strokeWidth?: number; rot?: number; flipX?: boolean; flipY?: boolean; opacity?: number; locked?: boolean } = {},
): ElementInput {
  return {
    id,
    name: id.replace(/[-_]/g, " "),
    type: "decor",
    decor: kind,
    x,
    y,
    w,
    h,
    colors,
    seed: o.seed ?? 1,
    density: o.density ?? 1,
    strokeWidth: o.strokeWidth ?? 3,
    rotation: o.rot ?? 0,
    flipX: o.flipX ?? false,
    flipY: o.flipY ?? false,
    opacity: o.opacity ?? 1,
    locked: o.locked ?? true,
  };
}

export const SIZES: Record<FormatId, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

export function layout(format: FormatId, background: Background, elements: ElementInput[]) {
  return { ...SIZES[format], background, elements };
}

/* Reusable field definitions ---------------------------------------- */

export const F = {
  photo: (label = "Main photo", key = "photo"): FieldDefinition => ({ key, label, type: "image", group: "photos", required: false, help: "JPEG, PNG or WebP. Drag inside the frame to reposition." }),
  date: (label = "Event date"): FieldDefinition => ({ key: "event_date", label, type: "date", group: "event", required: true, maxLength: 10 }),
  time: (label = "Start time"): FieldDefinition => ({ key: "event_time", label, type: "time", group: "event", required: true, maxLength: 5 }),
  venue: (): FieldDefinition => ({ key: "venue", label: "Venue name", type: "text", group: "details", required: true, maxLength: 60, placeholder: "e.g. The Garden Courtyard" }),
  address: (): FieldDefinition => ({ key: "address", label: "Address", type: "text", group: "details", required: false, maxLength: 90, placeholder: "Street, city" }),
  rsvp: (): FieldDefinition => ({ key: "rsvp", label: "RSVP details", type: "text", group: "rsvp", required: false, maxLength: 60, placeholder: "e.g. Priya · +91 98765 43210" }),
  text: (key: string, label: string, maxLength: number, required = true, group: FieldDefinition["group"] = "names", placeholder?: string): FieldDefinition => ({ key, label, type: "text", group, required, maxLength, placeholder }),
  message: (key = "message", label = "Personal message", maxLength = 160): FieldDefinition => ({ key, label, type: "multiline", group: "message", required: false, maxLength }),
};

export const ALL_CAPS = { advancedEditor: true, paletteSwitch: true, fontSwitch: true, formatSwitch: true } as const;

export interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
  category: "birthday" | "anniversary" | "wedding" | "engagement" | "graduation" | "baby-shower" | "party" | "other";
  tags: string[];
  style: "classic" | "modern" | "playful" | "romantic" | "minimal" | "bold";
  colorFamily: "warm" | "cool" | "dark" | "pastel" | "neutral";
  priceAmount: number;
  multiFormatPriceAmount: number | null;
  isFree: boolean;
  definition: TemplateDefinitionInput;
}
