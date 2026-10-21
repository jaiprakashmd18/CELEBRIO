/**
 * The Celebrio rendering engine: TemplateDefinition + ProjectData → SVG tree.
 *
 * Used by the live preview in both editor modes (via <InvitationSvg/>), by the
 * template preview generator, and by the server export engine. Customer text
 * is only ever placed inside <text> nodes and escaped by the serialiser, so it
 * can never be interpreted as markup.
 */
import { FALLBACK_FONT_CSS_NAME, FONT_FAMILIES, resolveFace, type FontFamilyId } from "./fonts";
import { renderDecor } from "./decor";
import { resolveContent } from "./format-text";
import { availableFormats, fontSetFor, layoutFor, paletteFor, resolveColor, resolveElements } from "./scene";
import { fitText, fontVerticalMetrics } from "./text-layout";
import { h, type VNode } from "./vnode";
import { SAMPLE_IMAGES } from "@/lib/templates/samples";
import {
  FORMAT_SIZES,
  type Background,
  type FormatId,
  type ImageElement,
  type ImageSource,
  type ImageValue,
  type Palette,
  type ProjectData,
  type TemplateDefinition,
  type TemplateElement,
  type TextElement,
} from "@/lib/templates/schema";

export interface RenderOptions {
  format?: FormatId;
  /** Unique id prefix when several invitations appear on one page. */
  idPrefix?: string;
  /** Adds the visible "Celebrio preview" watermark used for unpaid previews. */
  watermark?: boolean;
  /** Turns an image source into an href (URL in the browser, data URI on the server). */
  imageHref: (source: ImageSource) => string | null;
}

export interface RenderResult {
  root: VNode;
  width: number;
  height: number;
  format: FormatId;
  /** Ids of text elements whose text had to be truncated. */
  overflow: string[];
  elements: TemplateElement[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function backgroundNodes(bg: Background, palette: Palette, w: number, hgt: number, uid: string): VNode[] {
  if (bg.type === "solid") return [h("rect", { x: 0, y: 0, width: w, height: hgt, fill: resolveColor(bg.color, palette) })];
  const id = `${uid}-bg`;
  if (bg.type === "linear") {
    const a = ((bg.angle - 90) * Math.PI) / 180;
    const x = Math.cos(a) / 2;
    const y = Math.sin(a) / 2;
    return [
      h("defs", {}, [
        h("linearGradient", { id, x1: r2(0.5 - x), y1: r2(0.5 - y), x2: r2(0.5 + x), y2: r2(0.5 + y) }, [
          h("stop", { offset: 0, "stop-color": resolveColor(bg.from, palette) }),
          h("stop", { offset: 1, "stop-color": resolveColor(bg.to, palette) }),
        ]),
      ]),
      h("rect", { x: 0, y: 0, width: w, height: hgt, fill: `url(#${id})` }),
    ];
  }
  return [
    h("defs", {}, [
      h("radialGradient", { id, cx: 0.5, cy: 0.45, r: 0.75 }, [
        h("stop", { offset: 0, "stop-color": resolveColor(bg.from, palette) }),
        h("stop", { offset: 1, "stop-color": resolveColor(bg.to, palette) }),
      ]),
    ]),
    h("rect", { x: 0, y: 0, width: w, height: hgt, fill: `url(#${id})` }),
  ];
}

function transformFor(el: TemplateElement): string | undefined {
  const parts: string[] = [];
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  if (el.rotation) parts.push(`rotate(${r2(el.rotation)} ${r2(cx)} ${r2(cy)})`);
  if (el.flipX || el.flipY) {
    parts.push(`translate(${r2(cx)} ${r2(cy)}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1}) translate(${r2(-cx)} ${r2(-cy)})`);
  }
  return parts.length ? parts.join(" ") : undefined;
}

/** Where to draw an image of size iw×ih inside a w×h frame for the given crop. */
export function computeImagePlacement(value: Pick<ImageValue, "width" | "height" | "fit" | "crop">, w: number, hgt: number) {
  const base = value.fit === "fill" ? Math.max(w / value.width, hgt / value.height) : Math.min(w / value.width, hgt / value.height);
  const scale = base * value.crop.zoom;
  const rw = value.width * scale;
  const rh = value.height * scale;
  const x = (w - rw) * (0.5 + value.crop.offsetX / 2);
  const y = (hgt - rh) * (0.5 + value.crop.offsetY / 2);
  return { x, y, width: rw, height: rh };
}

function framePath(el: ImageElement): VNode {
  const { x, y, w, h: hh } = el;
  switch (el.frame.shape) {
    case "circle":
      return h("ellipse", { cx: r2(x + w / 2), cy: r2(y + hh / 2), rx: r2(w / 2), ry: r2(hh / 2) });
    case "rounded":
      return h("rect", { x, y, width: w, height: hh, rx: Math.min(el.frame.radius || 24, w / 2, hh / 2) });
    case "arch": {
      const r = w / 2;
      return h("path", { d: `M${r2(x)} ${r2(y + hh)} L${r2(x)} ${r2(y + r)} A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + w)} ${r2(y + r)} L${r2(x + w)} ${r2(y + hh)}Z` });
    }
    default:
      return h("rect", { x, y, width: w, height: hh, rx: el.frame.radius || undefined });
  }
}

const FILTER_MATRICES: Record<string, string> = {
  grayscale: "0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0",
  warm: "1.08 0.04 0 0 0.02 0 1 0 0 0.01 0 0 0.88 0 0 0 0 0 1 0",
  cool: "0.9 0 0 0 0 0 1 0.04 0 0 0 0.06 1.1 0 0.02 0 0 0 1 0",
};

function defaultImageValue(def: TemplateDefinition, field: string): ImageValue | null {
  const sampleId = def.sampleImages[field];
  if (!sampleId) return null;
  const sample = SAMPLE_IMAGES[sampleId];
  return { source: { kind: "sample", id: sampleId }, width: sample.width, height: sample.height, fit: "fill", crop: { zoom: 1, offsetX: 0, offsetY: 0 } };
}

function renderImage(el: ImageElement, def: TemplateDefinition, project: ProjectData, palette: Palette, opts: RenderOptions, uid: string): VNode {
  const explicit = project.images[el.field];
  const value = explicit === undefined ? defaultImageValue(def, el.field) : explicit;
  const clipId = `${uid}-clip-${el.id}`;
  const href = value ? opts.imageHref(value.source) : null;
  const children: VNode[] = [h("defs", {}, [h("clipPath", { id: clipId }, [framePath(el)])])];

  if (value && href) {
    const p = computeImagePlacement(value, el.w, el.h);
    let filterAttr: string | undefined;
    if (el.filter !== "none" && FILTER_MATRICES[el.filter]) {
      const filterId = `${uid}-filter-${el.id}`;
      children.push(h("defs", {}, [h("filter", { id: filterId }, [h("feColorMatrix", { type: "matrix", values: FILTER_MATRICES[el.filter] })])]));
      filterAttr = `url(#${filterId})`;
    }
    children.push(
      h("g", { "clip-path": `url(#${clipId})` }, [
        h("rect", { x: el.x, y: el.y, width: el.w, height: el.h, fill: resolveColor("palette.surface", palette) }),
        h("image", { href, x: r2(el.x + p.x), y: r2(el.y + p.y), width: r2(p.width), height: r2(p.height), preserveAspectRatio: "none", filter: filterAttr }),
      ]),
    );
  } else {
    // Empty photo slot: soft placeholder with a simple camera glyph.
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const s = Math.min(el.w, el.h) * 0.12;
    const muted = resolveColor("palette.muted", palette);
    children.push(
      h("g", { "clip-path": `url(#${clipId})` }, [
        h("rect", { x: el.x, y: el.y, width: el.w, height: el.h, fill: resolveColor("palette.surface", palette) }),
        h("rect", { x: r2(cx - s), y: r2(cy - s * 0.65), width: r2(s * 2), height: r2(s * 1.4), rx: r2(s * 0.25), fill: "none", stroke: muted, "stroke-width": r2(Math.max(2, s * 0.1)) }),
        h("circle", { cx: r2(cx), cy: r2(cy + s * 0.05), r: r2(s * 0.38), fill: "none", stroke: muted, "stroke-width": r2(Math.max(2, s * 0.1)) }),
      ]),
    );
  }
  if (el.frame.stroke && el.frame.strokeWidth > 0) {
    const outline = framePath(el);
    outline.a.fill = "none";
    outline.a.stroke = resolveColor(el.frame.stroke, palette);
    outline.a["stroke-width"] = el.frame.strokeWidth;
    children.push(outline);
  }
  return h("g", { transform: transformFor(el), opacity: el.opacity < 1 ? el.opacity : undefined, "data-el": el.id }, children);
}

function fontFamilyAttr(family: FontFamilyId): string {
  return `${FONT_FAMILIES[family].cssName}, ${FALLBACK_FONT_CSS_NAME}`;
}

function renderText(el: TextElement, fields: Record<string, string>, palette: Palette, fontFamily: FontFamilyId): { node: VNode | null; overflow: boolean } {
  const resolved = resolveContent(el.content, fields);
  if (resolved === null || resolved === "") return { node: null, overflow: false };
  const s = el.style;
  const text = s.transform === "uppercase" ? resolved.toUpperCase() : resolved;
  const face = resolveFace(fontFamily, s.weight, s.italic);
  const font = { family: fontFamily, weight: face.weight, italic: face.italic };
  const fitted = fitText({
    text,
    font,
    maxWidth: el.w,
    maxHeight: el.h,
    fontSize: s.fontSize,
    minFontSize: s.minFontSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    maxLines: s.maxLines,
  });
  const { ascent, descent } = fontVerticalMetrics(font);
  const fs = fitted.fontSize;
  const lh = fitted.lineHeightPx;
  const blockHeight = fitted.lines.length * lh;
  let top = el.y;
  if (s.verticalAlign === "middle") top = el.y + (el.h - blockHeight) / 2;
  if (s.verticalAlign === "bottom") top = el.y + el.h - blockHeight;
  const ls = s.letterSpacing * fs;
  let x = el.x;
  let anchor = "start";
  if (s.align === "center") {
    x = el.x + el.w / 2 + ls / 2;
    anchor = "middle";
  } else if (s.align === "right") {
    x = el.x + el.w + ls;
    anchor = "end";
  }
  const lines = fitted.lines.map((line, i) => {
    const baseline = top + i * lh + (lh - (ascent + descent) * fs) / 2 + ascent * fs;
    return h("text", { x: r2(x), y: r2(baseline) }, [line]);
  });
  const node = h(
    "g",
    {
      transform: transformFor(el),
      opacity: el.opacity < 1 ? el.opacity : undefined,
      "font-family": fontFamilyAttr(fontFamily),
      "font-size": r2(fs),
      "font-weight": face.weight,
      "font-style": face.italic ? "italic" : undefined,
      "letter-spacing": ls ? r2(ls) : undefined,
      "text-anchor": anchor,
      fill: resolveColor(s.color, palette),
      "data-el": el.id,
    },
    lines,
  );
  return { node, overflow: fitted.overflow };
}

function watermarkNodes(w: number, hgt: number): VNode[] {
  const rows: VNode[] = [];
  const step = 260;
  const label = "CELEBRIO PREVIEW   ·   CELEBRIO PREVIEW   ·   CELEBRIO PREVIEW";
  for (let y = -hgt; y < hgt * 2; y += step) {
    rows.push(h("text", { x: -w, y }, [label]));
  }
  const badgeW = Math.min(w * 0.6, 560);
  return [
    h("g", { transform: `rotate(-30 ${w / 2} ${hgt / 2})`, "font-family": "Inter", "font-size": 54, "font-weight": 600, "letter-spacing": 8, fill: "#20201F", opacity: 0.16 }, rows),
    h("g", { transform: `rotate(-30 ${w / 2} ${hgt / 2})`, "font-family": "Inter", "font-size": 54, "font-weight": 600, "letter-spacing": 8, fill: "#FFFFFF", opacity: 0.22 }, rows.map((r) => h("text", { x: Number(r.a.x) + 3, y: Number(r.a.y) + 3 }, r.c as string[]))),
    h("rect", { x: r2((w - badgeW) / 2), y: r2(hgt / 2 - 44), width: r2(badgeW), height: 88, rx: 44, fill: "#20201F", opacity: 0.72 }),
    h("text", { x: r2(w / 2), y: r2(hgt / 2 + 14), "text-anchor": "middle", "font-family": "Inter", "font-size": 36, "font-weight": 600, "letter-spacing": 6, fill: "#FFFFFF" }, ["CELEBRIO PREVIEW"]),
  ];
}

export function renderInvitation(def: TemplateDefinition, project: ProjectData, opts: RenderOptions): RenderResult {
  const formats = availableFormats(def);
  const format = opts.format && formats.includes(opts.format) ? opts.format : formats.includes(project.format) ? project.format : def.defaultFormat;
  const layout = layoutFor(def, format);
  const { width, height } = FORMAT_SIZES[format];
  const palette = paletteFor(def, project.paletteId);
  const fontSet = fontSetFor(def, project.fontSetId);
  const uid = opts.idPrefix ?? "inv";
  const elements = resolveElements(def, project, format);
  const overflow: string[] = [];
  const nodes: VNode[] = [...backgroundNodes(layout.background, palette, width, height, uid)];

  for (const el of elements) {
    if (el.hidden) continue;
    if (el.type === "text") {
      const family = el.style.fontFamily ?? fontSet[el.style.fontRole];
      const { node, overflow: over } = renderText(el, project.fields, palette, family);
      if (over) overflow.push(el.id);
      if (node) nodes.push(node);
    } else if (el.type === "image") {
      nodes.push(renderImage(el, def, project, palette, opts, uid));
    } else if (el.type === "shape") {
      const fill = resolveColor(el.fill, palette);
      const stroke = el.stroke ? resolveColor(el.stroke, palette) : undefined;
      const common = {
        fill: el.shape === "line" ? "none" : fill,
        "fill-opacity": el.fillOpacity < 1 ? el.fillOpacity : undefined,
        stroke,
        "stroke-width": stroke ? el.strokeWidth : undefined,
        "stroke-dasharray": el.dash?.join(" "),
        "stroke-linecap": el.shape === "line" ? "round" : undefined,
        transform: transformFor(el),
        opacity: el.opacity < 1 ? el.opacity : undefined,
        "data-el": el.id,
      };
      if (el.shape === "rect") nodes.push(h("rect", { x: el.x, y: el.y, width: el.w, height: el.h, rx: el.radius || undefined, ...common }));
      else if (el.shape === "ellipse") nodes.push(h("ellipse", { cx: r2(el.x + el.w / 2), cy: r2(el.y + el.h / 2), rx: r2(el.w / 2), ry: r2(el.h / 2), ...common }));
      else nodes.push(h("line", { x1: el.x, y1: r2(el.y + el.h / 2), x2: el.x + el.w, y2: r2(el.y + el.h / 2), ...common }));
    } else if (el.type === "decor") {
      const colors = el.colors.map((c) => resolveColor(c, palette));
      const inner = renderDecor(el.decor, { w: el.w, h: el.h, colors, seed: el.seed, density: el.density, strokeWidth: el.strokeWidth, uid: `${uid}-${el.id}` });
      const t = [`translate(${r2(el.x)} ${r2(el.y)})`];
      if (el.rotation) t.unshift(`rotate(${r2(el.rotation)} ${r2(el.x + el.w / 2)} ${r2(el.y + el.h / 2)})`);
      if (el.flipX || el.flipY) t.push(`translate(${r2(el.w / 2)} ${r2(el.h / 2)}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1}) translate(${r2(-el.w / 2)} ${r2(-el.h / 2)})`);
      nodes.push(h("g", { transform: t.join(" "), opacity: el.opacity < 1 ? el.opacity : undefined, "data-el": el.id }, inner));
    }
  }

  if (opts.watermark) nodes.push(h("g", { "pointer-events": "none" }, watermarkNodes(width, height)));

  const root = h("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${width} ${height}`, width, height }, nodes);
  return { root, width, height, format, overflow, elements };
}
