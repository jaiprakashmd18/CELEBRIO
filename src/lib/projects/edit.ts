/**
 * Pure, immutable edit operations on ProjectData. Both editor modes use these
 * functions, so every change ends up in the same canonical structure.
 */
import { layoutFor } from "@/lib/rendering/scene";
import {
  FORMAT_SIZES,
  type ElementPatch,
  type FormatId,
  type FormatOverrides,
  type ImageElement,
  type ImageValue,
  type ProjectData,
  type TemplateDefinition,
  type TemplateElement,
  type TextElement,
} from "@/lib/templates/schema";

function overridesFor(project: ProjectData, format: FormatId): FormatOverrides {
  return project.overrides[format] ?? { elements: {}, added: [] };
}

function withOverrides(project: ProjectData, format: FormatId, next: FormatOverrides): ProjectData {
  return { ...project, overrides: { ...project.overrides, [format]: next } };
}

export function setField(project: ProjectData, key: string, value: string): ProjectData {
  return { ...project, fields: { ...project.fields, [key]: value } };
}

export function setImage(project: ProjectData, key: string, value: ImageValue | null | undefined): ProjectData {
  const images = { ...project.images };
  if (value === undefined) delete images[key];
  else images[key] = value;
  return { ...project, images };
}

export function isAddedElement(project: ProjectData, format: FormatId, id: string): boolean {
  return overridesFor(project, format).added.some((el) => el.id === id);
}

/** Keeps an element at least partly on the canvas (safe boundaries). */
export function clampGeometry(patch: ElementPatch, current: { x: number; y: number; w: number; h: number }, format: FormatId): ElementPatch {
  const { width, height } = FORMAT_SIZES[format];
  const w = Math.min(Math.max(patch.w ?? current.w, 10), width * 2);
  const h = Math.min(Math.max(patch.h ?? current.h, 10), height * 2);
  const next: ElementPatch = { ...patch };
  if (patch.w !== undefined) next.w = Math.round(w);
  if (patch.h !== undefined) next.h = Math.round(h);
  if (patch.x !== undefined) next.x = Math.round(Math.min(Math.max(patch.x, -w * 0.75), width - w * 0.25));
  if (patch.y !== undefined) next.y = Math.round(Math.min(Math.max(patch.y, -h * 0.75), height - h * 0.25));
  return next;
}

/** Applies a patch to a template element (stored as an override) or to an added element. */
export function patchElement(project: ProjectData, format: FormatId, id: string, patch: ElementPatch): ProjectData {
  const o = overridesFor(project, format);
  const added = o.added.find((el) => el.id === id);
  if (added) {
    const { style, content, filter, ...geometry } = patch;
    let next = { ...added, ...stripUndefined(geometry) } as TextElement | ImageElement;
    if (next.type === "text") {
      if (style) next = { ...next, style: { ...next.style, ...stripUndefined(style) } };
      if (content !== undefined) next = { ...next, content };
    }
    if (next.type === "image" && filter) next = { ...next, filter };
    return withOverrides(project, format, { ...o, added: o.added.map((el) => (el.id === id ? next : el)) });
  }
  const existing = o.elements[id] ?? {};
  const merged: ElementPatch = { ...existing, ...stripUndefined(patch) };
  if (patch.style) merged.style = { ...(existing.style ?? {}), ...stripUndefined(patch.style) };
  return withOverrides(project, format, { ...o, elements: { ...o.elements, [id]: merged } });
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

let idCounter = 0;
export function newElementId(prefix: string): string {
  idCounter = (idCounter + 1) % 10000;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`.slice(0, 48);
}

export function addTextElement(project: ProjectData, format: FormatId, partial: Partial<TextElement> = {}): { project: ProjectData; id: string } {
  const { width, height } = FORMAT_SIZES[format];
  const id = partial.id ?? newElementId("text");
  const el: TextElement = {
    id,
    name: "Custom text",
    type: "text",
    x: Math.round(width * 0.15),
    y: Math.round(height / 2 - 60),
    w: Math.round(width * 0.7),
    h: 120,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    flipX: false,
    flipY: false,
    content: "Your text here",
    style: {
      fontRole: "body",
      fontSize: 56,
      minFontSize: 20,
      weight: 400,
      italic: false,
      color: "palette.text",
      align: "center",
      verticalAlign: "middle",
      letterSpacing: 0,
      lineHeight: 1.2,
      transform: "none",
      maxLines: 3,
    },
    ...partial,
  };
  const o = overridesFor(project, format);
  return { project: withOverrides(project, format, { ...o, added: [...o.added, el] }), id };
}

/** Duplicates a text or image element as a new, independent added element. */
export function duplicateElement(project: ProjectData, format: FormatId, source: TemplateElement): { project: ProjectData; id: string | null } {
  if (source.type !== "text" && source.type !== "image") return { project, id: null };
  const id = newElementId(source.type === "text" ? "text" : "photo");
  const copy = { ...source, id, name: `${source.name} copy`, x: source.x + 30, y: source.y + 30, locked: false, hidden: false } as TextElement | ImageElement;
  const o = overridesFor(project, format);
  const order = o.order ? [...o.order, id] : undefined;
  return { project: withOverrides(project, format, { ...o, added: [...o.added, copy], order }), id };
}

/** Removes an added element, or hides a template element (templates are never mutated). */
export function deleteElement(project: ProjectData, format: FormatId, id: string): ProjectData {
  const o = overridesFor(project, format);
  if (o.added.some((el) => el.id === id)) {
    const elements = { ...o.elements };
    delete elements[id];
    return withOverrides(project, format, { ...o, added: o.added.filter((el) => el.id !== id), elements, order: o.order?.filter((x) => x !== id) });
  }
  return patchElement(project, format, id, { hidden: true });
}

/** Moves an element one step up (+1) or down (-1) in the layer order. */
export function moveLayer(project: ProjectData, format: FormatId, ordered: TemplateElement[], id: string, direction: 1 | -1 | "top" | "bottom"): ProjectData {
  const ids = ordered.map((el) => el.id);
  const index = ids.indexOf(id);
  if (index < 0) return project;
  ids.splice(index, 1);
  let target: number;
  if (direction === "top") target = ids.length;
  else if (direction === "bottom") target = 0;
  else target = Math.min(Math.max(index + direction, 0), ids.length);
  ids.splice(target, 0, id);
  const o = overridesFor(project, format);
  return withOverrides(project, format, { ...o, order: ids });
}

export function resetFormat(project: ProjectData, format: FormatId): ProjectData {
  const overrides = { ...project.overrides };
  delete overrides[format];
  return { ...project, overrides };
}

/**
 * Text editing in the advanced editor: when an element simply shows one field
 * ("{name_one}"), edit the field itself so automatic mode stays in sync;
 * otherwise store custom content for that element.
 */
export function editElementText(project: ProjectData, format: FormatId, el: TextElement, text: string): ProjectData {
  const single = /^\{([a-z][a-z0-9_]*)\}$/.exec(el.content.trim());
  if (single && !isAddedElement(project, format, el.id)) return setField(project, single[1]!, text);
  return patchElement(project, format, el.id, { content: text });
}

export function elementEditableText(project: ProjectData, el: TextElement): string {
  const single = /^\{([a-z][a-z0-9_]*)\}$/.exec(el.content.trim());
  if (single) return project.fields[single[1]!] ?? "";
  return el.content;
}

export function templateElementIds(def: TemplateDefinition, format: FormatId): Set<string> {
  return new Set(layoutFor(def, format).elements.map((el) => el.id));
}
