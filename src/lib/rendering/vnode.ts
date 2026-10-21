/**
 * A tiny virtual SVG tree. The layout engine produces VNodes once; they are
 * serialised either to an SVG string (server export) or to React elements
 * (browser preview). One tree, two serialisers → identical output.
 */
export type Attr = string | number | undefined;

export interface VNode {
  t: string;
  a: Record<string, Attr>;
  c?: Array<VNode | string>;
}

export function h(t: string, a: Record<string, Attr> = {}, c?: Array<VNode | string | null | false | undefined>): VNode {
  const children = c?.filter((x): x is VNode | string => x !== null && x !== false && x !== undefined);
  return children && children.length > 0 ? { t, a, c: children } : { t, a };
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text so that customer input can never become markup. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);
}

const ALLOWED_TAGS = new Set([
  "svg", "g", "defs", "rect", "circle", "ellipse", "line", "path", "polygon", "polyline", "text", "tspan",
  "image", "clipPath", "linearGradient", "radialGradient", "stop", "filter", "feGaussianBlur", "feColorMatrix",
  "feMerge", "feMergeNode", "feFlood", "feComposite", "pattern", "mask", "title",
]);

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function serializeVNode(node: VNode | string): string {
  if (typeof node === "string") return escapeXml(node);
  if (!ALLOWED_TAGS.has(node.t)) throw new Error(`Unsupported SVG tag: ${node.t}`);
  let attrs = "";
  for (const [key, value] of Object.entries(node.a)) {
    if (value === undefined) continue;
    if (!/^[a-zA-Z][a-zA-Z0-9:-]*$/.test(key)) throw new Error(`Invalid attribute name: ${key}`);
    const v = typeof value === "number" ? formatNumber(value) : value;
    attrs += ` ${key}="${escapeXml(v)}"`;
  }
  if (!node.c || node.c.length === 0) return `<${node.t}${attrs}/>`;
  return `<${node.t}${attrs}>${node.c.map(serializeVNode).join("")}</${node.t}>`;
}

export function toSvgDocument(root: VNode): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${serializeVNode(root)}`;
}
