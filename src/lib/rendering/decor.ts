/**
 * Original decorative illustrations, drawn entirely in code.
 *
 * Each decor function receives the element's box size and resolved colours
 * and returns SVG nodes in local coordinates (0,0 → w,h). Randomised decor
 * (confetti, stars, …) uses a seeded generator so the same project always
 * renders identically in the editor and in exports.
 */
import type { DecorId } from "./decor-ids";
import { h, type VNode } from "./vnode";

export interface DecorContext {
  w: number;
  h: number;
  colors: string[];
  seed: number;
  density: number;
  strokeWidth: number;
  /** Unique prefix for ids (filters, clip paths) inside this SVG document. */
  uid: string;
}

/* ----------------------------- helpers ----------------------------- */

export function seededRandom(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const color = (ctx: DecorContext, i: number) => ctx.colors[i % ctx.colors.length] ?? "#000000";

/** Scales a drawing authored in a vbW×vbH space to fit the box (like "meet"). */
function fit(ctx: DecorContext, vbW: number, vbH: number, nodes: VNode[]): VNode {
  const s = Math.min(ctx.w / vbW, ctx.h / vbH);
  const tx = (ctx.w - vbW * s) / 2;
  const ty = (ctx.h - vbH * s) / 2;
  return h("g", { transform: `translate(${r1(tx)} ${r1(ty)}) scale(${Math.round(s * 10000) / 10000})` }, nodes);
}

function leafPath(length: number, width: number): string {
  const L = r1(length);
  const W = r1(width);
  return `M0 0 Q${r1(L * 0.45)} ${-W} ${L} 0 Q${r1(L * 0.45)} ${W} 0 0Z`;
}

function leaf(x: number, y: number, angle: number, length: number, width: number, fill: string, vein?: string): VNode {
  return h("g", { transform: `translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})` }, [
    h("path", { d: leafPath(length, width), fill }),
    vein ? h("path", { d: `M0 0 L${r1(length * 0.85)} 0`, stroke: vein, "stroke-width": r1(Math.max(1, width * 0.08)), "stroke-linecap": "round", fill: "none", opacity: 0.6 }) : null,
  ]);
}

function sparklePath(r: number): string {
  const q = r1(r * 0.18);
  const R = r1(r);
  return `M0 ${-R} Q${q} ${-q} ${R} 0 Q${q} ${q} 0 ${R} Q${-q} ${q} ${-R} 0 Q${-q} ${-q} 0 ${-R}Z`;
}

function heartPath(s: number): string {
  const k = s / 100;
  const p = (x: number, y: number) => `${r1(x * k)} ${r1(y * k)}`;
  return `M${p(0, 30)} C${p(0, 0)} ${p(-50, 0)} ${p(-50, 30)} C${p(-50, 60)} ${p(0, 80)} ${p(0, 100)} C${p(0, 80)} ${p(50, 60)} ${p(50, 30)} C${p(50, 0)} ${p(0, 0)} ${p(0, 30)}Z`;
}

function flower(cx: number, cy: number, r: number, petals: number, petalColor: string, innerColor: string, centerColor: string, rotate = 0): VNode {
  const outer: VNode[] = [];
  for (let i = 0; i < petals; i++) {
    const a = (360 / petals) * i + rotate;
    outer.push(h("ellipse", { cx: 0, cy: r1(-r * 0.52), rx: r1(r * 0.36), ry: r1(r * 0.55), fill: petalColor, transform: `rotate(${r1(a)})` }));
  }
  const inner: VNode[] = [];
  for (let i = 0; i < petals; i++) {
    const a = (360 / petals) * i + rotate + 180 / petals;
    inner.push(h("ellipse", { cx: 0, cy: r1(-r * 0.3), rx: r1(r * 0.2), ry: r1(r * 0.34), fill: innerColor, transform: `rotate(${r1(a)})` }));
  }
  return h("g", { transform: `translate(${r1(cx)} ${r1(cy)})` }, [
    ...outer,
    ...inner,
    h("circle", { cx: 0, cy: 0, r: r1(r * 0.2), fill: centerColor }),
    h("circle", { cx: r1(-r * 0.06), cy: r1(-r * 0.06), r: r1(r * 0.07), fill: "#FFFFFF", opacity: 0.35 }),
  ]);
}

/** Smooth closed curve through points (Catmull–Rom converted to cubic Béziers). */
function closedCurve(points: Array<[number, number]>): string {
  const n = points.length;
  let d = `M${r1(points[0]![0])} ${r1(points[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d}Z`;
}

/* ----------------------------- decor ------------------------------ */

function confetti(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const count = Math.min(180, Math.max(6, Math.round(((ctx.w * ctx.h) / 9000) * ctx.density)));
  const nodes: VNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = rand() * ctx.w;
    const y = rand() * ctx.h;
    const c = color(ctx, i);
    const kind = rand();
    const rot = rand() * 360;
    const s = 8 + rand() * 14;
    if (kind < 0.3) {
      nodes.push(h("circle", { cx: r1(x), cy: r1(y), r: r1(s * 0.45), fill: c }));
    } else if (kind < 0.6) {
      nodes.push(h("rect", { x: r1(-s * 0.3), y: r1(-s * 0.8), width: r1(s * 0.6), height: r1(s * 1.6), rx: 2, fill: c, transform: `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})` }));
    } else if (kind < 0.8) {
      nodes.push(h("path", { d: `M${r1(-s)} 0 q${r1(s / 2)} ${r1(-s / 1.6)} ${r1(s)} 0 t${r1(s)} 0`, stroke: c, "stroke-width": r1(s * 0.28), fill: "none", "stroke-linecap": "round", transform: `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})` }));
    } else {
      nodes.push(h("path", { d: `M0 ${r1(-s * 0.7)} L${r1(s * 0.6)} ${r1(s * 0.5)} L${r1(-s * 0.6)} ${r1(s * 0.5)}Z`, fill: c, transform: `translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})` }));
    }
  }
  return nodes;
}

function balloons(ctx: DecorContext): VNode[] {
  const one = (cx: number, cy: number, rx: number, c: string, tilt: number, stringTo: [number, number]) => {
    const ry = rx * 1.22;
    const knotY = cy + ry;
    return h("g", {}, [
      h("path", { d: `M${cx} ${r1(knotY + 8)} C${r1(cx - 18)} ${r1(knotY + 60)} ${r1(stringTo[0] + 24)} ${r1(stringTo[1] - 70)} ${stringTo[0]} ${stringTo[1]}`, stroke: c, "stroke-width": 2.2, fill: "none", opacity: 0.7 }),
      h("g", { transform: `rotate(${tilt} ${cx} ${cy})` }, [
        h("ellipse", { cx, cy, rx, ry: r1(ry), fill: c }),
        h("path", { d: `M${cx - 9} ${r1(knotY + 10)} L${cx} ${r1(knotY - 2)} L${cx + 9} ${r1(knotY + 10)}Z`, fill: c }),
        h("ellipse", { cx: r1(cx - rx * 0.38), cy: r1(cy - ry * 0.42), rx: r1(rx * 0.16), ry: r1(ry * 0.26), fill: "#FFFFFF", opacity: 0.45, transform: `rotate(-20 ${r1(cx - rx * 0.38)} ${r1(cy - ry * 0.42)})` }),
      ]),
    ]);
  };
  return [
    fit(ctx, 320, 480, [
      one(110, 120, 70, color(ctx, 1), -10, [165, 470]),
      one(225, 105, 66, color(ctx, 2), 9, [165, 470]),
      one(165, 210, 74, color(ctx, 0), 0, [165, 470]),
    ]),
  ];
}

function sparkles(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const count = Math.min(60, Math.max(3, Math.round(((ctx.w * ctx.h) / 40000) * ctx.density)));
  const nodes: VNode[] = [];
  for (let i = 0; i < count; i++) {
    const r = 8 + rand() * 26;
    nodes.push(h("path", { d: sparklePath(r), fill: color(ctx, i), opacity: r1(0.55 + rand() * 0.45), transform: `translate(${r1(r + rand() * (ctx.w - 2 * r))} ${r1(r + rand() * (ctx.h - 2 * r))})` }));
  }
  return nodes;
}

function starfield(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const count = Math.min(240, Math.max(10, Math.round(((ctx.w * ctx.h) / 6000) * ctx.density)));
  const nodes: VNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = rand() * ctx.w;
    const y = rand() * ctx.h;
    if (rand() < 0.12) {
      nodes.push(h("path", { d: sparklePath(6 + rand() * 10), fill: color(ctx, i), transform: `translate(${r1(x)} ${r1(y)})` }));
    } else {
      nodes.push(h("circle", { cx: r1(x), cy: r1(y), r: r1(1.2 + rand() * 2.8), fill: color(ctx, i), opacity: r1(0.4 + rand() * 0.6) }));
    }
  }
  return nodes;
}

function crescentMoon(ctx: DecorContext): VNode[] {
  const R = 100;
  return [
    fit(ctx, 220, 220, [
      h("g", { transform: "translate(120 110) rotate(-20)" }, [
        h("path", { d: `M0 ${-R} A${R} ${R} 0 0 0 0 ${R} A${R * 0.58} ${R} 0 0 1 0 ${-R}Z`, fill: color(ctx, 0) }),
        h("circle", { cx: -62, cy: -20, r: 7, fill: color(ctx, 1), opacity: 0.35 }),
        h("circle", { cx: -50, cy: 30, r: 10, fill: color(ctx, 1), opacity: 0.25 }),
        h("circle", { cx: -75, cy: 10, r: 4, fill: color(ctx, 1), opacity: 0.3 }),
      ]),
    ]),
  ];
}

function cloud(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  return [
    fit(ctx, 300, 150, [
      h("g", {}, [
        h("circle", { cx: 95, cy: 85, r: 48, fill: c }),
        h("circle", { cx: 160, cy: 62, r: 60, fill: c }),
        h("circle", { cx: 220, cy: 90, r: 42, fill: c }),
        h("rect", { x: 50, y: 85, width: 210, height: 50, rx: 25, fill: c }),
      ]),
    ]),
  ];
}

function botanicalBranch(ctx: DecorContext): VNode[] {
  const leafColor = color(ctx, 0);
  const accent = color(ctx, 1);
  const vb = { w: 200, h: 600 };
  const nodes: VNode[] = [h("path", { d: "M100 590 C 92 450 118 300 96 160 C 88 100 104 50 100 10", stroke: leafColor, "stroke-width": 3.2, fill: "none", "stroke-linecap": "round" })];
  const steps = 13;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const y = 590 - t * 570;
    const x = 100 + Math.sin(t * 6.2) * 8;
    const side = i % 2 === 0 ? 1 : -1;
    const len = 70 - t * 34;
    const angle = side === 1 ? -35 - t * 15 : -145 + t * 15;
    nodes.push(leaf(x, y, angle, len, len * 0.34, i % 3 === 0 ? accent : leafColor, i % 3 === 0 ? leafColor : accent));
  }
  nodes.push(leaf(100, 12, -90, 34, 12, leafColor));
  return [fit(ctx, vb.w, vb.h, nodes)];
}

function floralCorner(ctx: DecorContext): VNode[] {
  const petal = color(ctx, 0);
  const leafC = color(ctx, 1);
  const center = color(ctx, 2);
  const petal2 = color(ctx, 3);
  const nodes: VNode[] = [];
  // leaf sprays along both edges
  const sprayH: Array<[number, number, number, number]> = [
    [150, 40, 15, 70], [205, 62, -20, 62], [255, 34, 10, 54], [305, 50, -12, 44], [345, 30, 4, 34],
  ];
  for (const [x, y, a, len] of sprayH) nodes.push(leaf(x - len * 0.9, y, a, len, len * 0.33, leafC, center));
  const sprayV: Array<[number, number, number, number]> = [
    [40, 150, 75, 70], [62, 205, 110, 62], [34, 255, 80, 54], [50, 305, 102, 44], [30, 345, 86, 34],
  ];
  for (const [x, y, a, len] of sprayV) nodes.push(leaf(x, y - len * 0.9, a, len, len * 0.33, leafC, center));
  nodes.push(h("path", { d: "M10 10 C 120 30 260 40 380 20", stroke: leafC, "stroke-width": 2.4, fill: "none", opacity: 0.8 }));
  nodes.push(h("path", { d: "M10 10 C 30 120 40 260 20 380", stroke: leafC, "stroke-width": 2.4, fill: "none", opacity: 0.8 }));
  nodes.push(flower(78, 78, 70, 6, petal, petal2, center, 10));
  nodes.push(flower(175, 112, 36, 5, petal2, petal, center, 30));
  nodes.push(flower(112, 178, 32, 5, petal2, petal, center, 0));
  for (const [x, y] of [[228, 120], [128, 232], [210, 170]] as Array<[number, number]>) {
    nodes.push(h("circle", { cx: x, cy: y, r: 7, fill: petal, opacity: 0.85 }));
  }
  return [fit(ctx, 400, 400, nodes)];
}

function bloom(ctx: DecorContext): VNode[] {
  return [fit(ctx, 200, 200, [flower(100, 100, 92, 7, color(ctx, 0), color(ctx, 1), color(ctx, 2), ctx.seed % 50)])];
}

function leafSprig(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  const nodes: VNode[] = [h("path", { d: "M60 290 C 58 200 64 110 60 20", stroke: c, "stroke-width": 2.6, fill: "none", "stroke-linecap": "round" })];
  for (let i = 0; i < 6; i++) {
    const y = 250 - i * 42;
    const len = 52 - i * 5;
    nodes.push(leaf(60, y, -40 - i * 4, len, len * 0.36, i % 2 ? color(ctx, 1) : c));
    nodes.push(leaf(60, y - 12, -140 + i * 4, len, len * 0.36, i % 2 ? c : color(ctx, 1)));
  }
  nodes.push(leaf(60, 22, -90, 30, 11, c));
  return [fit(ctx, 120, 300, nodes)];
}

function goldFrame(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  const sw = ctx.strokeWidth;
  const inset = sw * 4 + 10;
  const nodes: VNode[] = [
    h("rect", { x: r1(sw / 2), y: r1(sw / 2), width: r1(ctx.w - sw), height: r1(ctx.h - sw), fill: "none", stroke: c, "stroke-width": sw }),
    h("rect", { x: inset, y: inset, width: r1(ctx.w - inset * 2), height: r1(ctx.h - inset * 2), fill: "none", stroke: c, "stroke-width": r1(Math.max(1, sw / 2.5)) }),
  ];
  const d = inset * 0.9;
  for (const [x, y] of [[inset, inset], [ctx.w - inset, inset], [inset, ctx.h - inset], [ctx.w - inset, ctx.h - inset]] as Array<[number, number]>) {
    nodes.push(h("path", { d: `M${r1(x)} ${r1(y - d)} L${r1(x + d)} ${r1(y)} L${r1(x)} ${r1(y + d)} L${r1(x - d)} ${r1(y)}Z`, fill: color(ctx, 1), stroke: c, "stroke-width": r1(Math.max(1, sw / 2)) }));
  }
  return nodes;
}

function decoCorners(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  const sw = ctx.strokeWidth;
  const size = Math.min(ctx.w, ctx.h) * 0.22;
  const corner = (): VNode[] => {
    const parts: VNode[] = [];
    for (let i = 0; i < 3; i++) {
      const o = i * sw * 3.2;
      parts.push(h("path", { d: `M${r1(o)} ${r1(size)} L${r1(o)} ${r1(o)} L${r1(size)} ${r1(o)}`, fill: "none", stroke: c, "stroke-width": i === 0 ? sw : r1(sw * 0.6) }));
    }
    const R = size * 0.55;
    const o = sw * 9;
    parts.push(h("path", { d: `M${r1(o)} ${r1(o + R)} A${r1(R)} ${r1(R)} 0 0 0 ${r1(o + R)} ${r1(o)}`, fill: "none", stroke: c, "stroke-width": r1(sw * 0.6) }));
    for (let k = 1; k < 5; k++) {
      const a = (Math.PI / 2) * (k / 5);
      parts.push(h("line", { x1: r1(o), y1: r1(o), x2: r1(o + Math.cos(a) * R * 0.9), y2: r1(o + Math.sin(a) * R * 0.9), stroke: c, "stroke-width": r1(sw * 0.45) }));
    }
    parts.push(h("circle", { cx: r1(o), cy: r1(o), r: r1(sw * 1.4), fill: color(ctx, 1) }));
    return parts;
  };
  return [
    h("g", {}, corner()),
    h("g", { transform: `translate(${r1(ctx.w)} 0) scale(-1 1)` }, corner()),
    h("g", { transform: `translate(0 ${r1(ctx.h)}) scale(1 -1)` }, corner()),
    h("g", { transform: `translate(${r1(ctx.w)} ${r1(ctx.h)}) scale(-1 -1)` }, corner()),
  ];
}

function laurel(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  const branch = (mirror: boolean): VNode => {
    const parts: VNode[] = [h("path", { d: "M200 285 C 110 270 50 200 60 80", stroke: c, "stroke-width": 3, fill: "none", "stroke-linecap": "round" })];
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const x = 200 - 140 * t + Math.sin(t * Math.PI) * -12;
      const y = 285 - 205 * t * t - 20 * t;
      const ang = -150 + t * 70;
      parts.push(leaf(x, y, ang, 44 - t * 10, 15, i % 2 ? color(ctx, 1) : c));
      parts.push(leaf(x, y, ang + 75, 40 - t * 10, 14, c));
    }
    return h("g", mirror ? { transform: "translate(400 0) scale(-1 1)" } : {}, parts);
  };
  return [fit(ctx, 400, 300, [branch(false), branch(true)])];
}

function gradCap(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  const tassel = color(ctx, 1);
  return [
    fit(ctx, 220, 170, [
      h("path", { d: "M55 78 L55 125 C 80 150 140 150 165 125 L165 78Z", fill: c }),
      h("path", { d: "M110 20 L210 62 L110 104 L10 62Z", fill: c }),
      h("path", { d: "M110 30 L190 62 L110 94 L30 62Z", fill: "#FFFFFF", opacity: 0.08 }),
      h("path", { d: "M110 62 L178 80 L178 130", stroke: tassel, "stroke-width": 4, fill: "none" }),
      h("rect", { x: 171, y: 128, width: 14, height: 28, rx: 4, fill: tassel }),
      h("circle", { cx: 110, cy: 62, r: 7, fill: tassel }),
    ]),
  ];
}

function geometric(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const cell = Math.max(60, 180 / ctx.density);
  const cols = Math.max(1, Math.round(ctx.w / cell));
  const rows = Math.max(1, Math.round(ctx.h / cell));
  const cw = ctx.w / cols;
  const ch = ctx.h / rows;
  const nodes: VNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.35) continue;
      const x = c * cw;
      const y = r * ch;
      const s = Math.min(cw, ch) * 0.8;
      const cx = x + cw / 2;
      const cy = y + ch / 2;
      const col = color(ctx, Math.floor(rand() * 10));
      const k = rand();
      if (k < 0.25) nodes.push(h("circle", { cx: r1(cx), cy: r1(cy), r: r1(s / 2), fill: col }));
      else if (k < 0.45) nodes.push(h("path", { d: `M${r1(cx - s / 2)} ${r1(cy + s / 2)} A${r1(s / 2)} ${r1(s / 2)} 0 0 1 ${r1(cx + s / 2)} ${r1(cy + s / 2)}Z`, fill: col }));
      else if (k < 0.65) nodes.push(h("path", { d: `M${r1(cx - s / 2)} ${r1(cy + s / 2)} L${r1(cx)} ${r1(cy - s / 2)} L${r1(cx + s / 2)} ${r1(cy + s / 2)}Z`, fill: col }));
      else if (k < 0.8) nodes.push(h("rect", { x: r1(cx - s / 2), y: r1(cy - s / 2), width: r1(s), height: r1(s), fill: col }));
      else {
        for (let i = 0; i < 4; i++) nodes.push(h("rect", { x: r1(cx - s / 2), y: r1(cy - s / 2 + (i * s) / 4), width: r1(s), height: r1(s / 8), fill: col }));
      }
    }
  }
  return nodes;
}

function hearts(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const count = Math.min(40, Math.max(1, Math.round(((ctx.w * ctx.h) / 50000) * ctx.density)));
  const nodes: VNode[] = [];
  for (let i = 0; i < count; i++) {
    const s = 24 + rand() * 46;
    const x = s / 2 + rand() * Math.max(1, ctx.w - s);
    const y = rand() * Math.max(1, ctx.h - s);
    nodes.push(h("path", { d: heartPath(s), fill: color(ctx, i), opacity: r1(0.5 + rand() * 0.5), transform: `translate(${r1(x)} ${r1(y)}) rotate(${r1(rand() * 40 - 20)})` }));
  }
  return nodes;
}

function ring(ctx: DecorContext): VNode[] {
  const band = color(ctx, 0);
  const gem = color(ctx, 1);
  const sw = 10;
  return [
    fit(ctx, 200, 240, [
      h("ellipse", { cx: 100, cy: 150, rx: 70, ry: 72, fill: "none", stroke: band, "stroke-width": sw }),
      h("path", { d: "M70 56 L82 40 L118 40 L130 56 L100 90Z", fill: gem, stroke: band, "stroke-width": 3, "stroke-linejoin": "round" }),
      h("path", { d: "M70 56 L130 56 M82 40 L92 56 L100 90 L108 56 L118 40", fill: "none", stroke: band, "stroke-width": 2, "stroke-linejoin": "round" }),
      h("path", { d: "M88 82 L100 90 L112 82", fill: "none", stroke: band, "stroke-width": 3 }),
      h("path", { d: sparklePath(14), fill: band, transform: "translate(160 36)" }),
      h("path", { d: sparklePath(8), fill: band, transform: "translate(40 30)" }),
    ]),
  ];
}

function sunburst(ctx: DecorContext): VNode[] {
  const rays = Math.max(8, Math.round(24 * ctx.density));
  const cx = ctx.w / 2;
  const cy = ctx.h / 2;
  const R = Math.hypot(ctx.w, ctx.h) / 2;
  const nodes: VNode[] = [];
  for (let i = 0; i < rays; i++) {
    if (i % 2) continue;
    const a1 = (i / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    nodes.push(h("path", { d: `M${r1(cx)} ${r1(cy)} L${r1(cx + Math.cos(a1) * R)} ${r1(cy + Math.sin(a1) * R)} L${r1(cx + Math.cos(a2) * R)} ${r1(cy + Math.sin(a2) * R)}Z`, fill: color(ctx, 0) }));
  }
  return nodes;
}

function citrus(ctx: DecorContext): VNode[] {
  const slice = (cx: number, cy: number, r: number, rind: string, flesh: string): VNode => {
    const parts: VNode[] = [h("circle", { cx, cy, r, fill: rind }), h("circle", { cx, cy, r: r1(r * 0.86), fill: "#FFFDF5" })];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 360;
      parts.push(h("path", { d: `M0 ${r1(-r * 0.12)} L${r1(r * 0.27)} ${r1(-r * 0.74)} A${r1(r * 0.76)} ${r1(r * 0.76)} 0 0 1 ${r1(-r * 0.27)} ${r1(-r * 0.74)}Z`, fill: flesh, transform: `translate(${cx} ${cy}) rotate(${a})` }));
    }
    return h("g", {}, parts);
  };
  return [
    fit(ctx, 300, 300, [
      leaf(150, 170, -60, 90, 30, color(ctx, 2), color(ctx, 1)),
      leaf(150, 170, -120, 70, 24, color(ctx, 2)),
      slice(95, 190, 72, color(ctx, 0), color(ctx, 1)),
      slice(205, 120, 58, color(ctx, 0), color(ctx, 1)),
    ]),
  ];
}

function neonZigzag(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const filterId = `${ctx.uid}-glow`;
  const nodes: VNode[] = [
    h("defs", {}, [h("filter", { id: filterId, x: "-20%", y: "-20%", width: "140%", height: "140%" }, [h("feGaussianBlur", { stdDeviation: r1(ctx.strokeWidth * 1.4), result: "blur" }), h("feMerge", {}, [h("feMergeNode", { in: "blur" }), h("feMergeNode", { in: "SourceGraphic" })])])]),
  ];
  const lines = Math.max(1, Math.round(3 * ctx.density));
  for (let i = 0; i < lines; i++) {
    const y0 = ((i + 0.5) / lines) * ctx.h;
    const amp = Math.min(ctx.h / lines / 3, 40);
    const seg = 40 + rand() * 30;
    let d = `M0 ${r1(y0)}`;
    for (let x = seg, k = 0; x <= ctx.w + seg; x += seg, k++) d += ` L${r1(Math.min(x, ctx.w))} ${r1(y0 + (k % 2 ? -amp : amp))}`;
    nodes.push(h("path", { d, stroke: color(ctx, i), "stroke-width": ctx.strokeWidth, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round", filter: `url(#${filterId})` }));
  }
  return nodes;
}

function divider(ctx: DecorContext): VNode[] {
  const c = color(ctx, 0);
  const cy = ctx.h / 2;
  const cx = ctx.w / 2;
  const d = Math.min(ctx.h / 2.2, 14);
  const sw = Math.max(1, ctx.strokeWidth / 2);
  return [
    h("line", { x1: 0, y1: r1(cy), x2: r1(cx - d * 2.4), y2: r1(cy), stroke: c, "stroke-width": sw }),
    h("line", { x1: r1(cx + d * 2.4), y1: r1(cy), x2: r1(ctx.w), y2: r1(cy), stroke: c, "stroke-width": sw }),
    h("path", { d: `M${r1(cx)} ${r1(cy - d)} L${r1(cx + d)} ${r1(cy)} L${r1(cx)} ${r1(cy + d)} L${r1(cx - d)} ${r1(cy)}Z`, fill: color(ctx, 1) }),
    h("circle", { cx: r1(cx - d * 1.7), cy: r1(cy), r: r1(d * 0.22), fill: c }),
    h("circle", { cx: r1(cx + d * 1.7), cy: r1(cy), r: r1(d * 0.22), fill: c }),
  ];
}

function dotGrid(ctx: DecorContext): VNode[] {
  const gap = Math.max(14, 36 / ctx.density);
  const nodes: VNode[] = [];
  const r = Math.max(1.2, ctx.strokeWidth / 1.5);
  for (let y = gap / 2; y < ctx.h; y += gap) {
    for (let x = gap / 2; x < ctx.w; x += gap) nodes.push(h("circle", { cx: r1(x), cy: r1(y), r: r1(r), fill: color(ctx, 0) }));
  }
  return nodes;
}

function squiggle(ctx: DecorContext): VNode[] {
  const cy = ctx.h / 2;
  const wave = Math.max(30, 60 / ctx.density);
  const amp = Math.min(ctx.h / 2 - ctx.strokeWidth, 18);
  let d = `M0 ${r1(cy)}`;
  for (let x = 0; x < ctx.w; x += wave) d += ` q${r1(wave / 4)} ${r1(-amp)} ${r1(wave / 2)} 0 t${r1(wave / 2)} 0`;
  return [h("path", { d, stroke: color(ctx, 0), "stroke-width": ctx.strokeWidth, fill: "none", "stroke-linecap": "round" })];
}

function blob(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const pts: Array<[number, number]> = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.78 + rand() * 0.22;
    pts.push([ctx.w / 2 + Math.cos(a) * (ctx.w / 2) * k, ctx.h / 2 + Math.sin(a) * (ctx.h / 2) * k]);
  }
  return [h("path", { d: closedCurve(pts), fill: color(ctx, 0) })];
}

function archFrame(ctx: DecorContext): VNode[] {
  const sw = ctx.strokeWidth;
  const arch = (inset: number) => {
    const w = ctx.w - inset * 2;
    const r = w / 2;
    const top = inset + r;
    return `M${r1(inset)} ${r1(ctx.h - inset)} L${r1(inset)} ${r1(top)} A${r1(r)} ${r1(r)} 0 0 1 ${r1(ctx.w - inset)} ${r1(top)} L${r1(ctx.w - inset)} ${r1(ctx.h - inset)}Z`;
  };
  return [
    h("path", { d: arch(sw / 2), fill: "none", stroke: color(ctx, 0), "stroke-width": sw }),
    h("path", { d: arch(sw * 4), fill: "none", stroke: color(ctx, 1), "stroke-width": r1(Math.max(1, sw / 2.5)) }),
  ];
}

function wave(ctx: DecorContext): VNode[] {
  const rand = seededRandom(ctx.seed);
  const bands = Math.max(1, Math.min(4, ctx.colors.length));
  const nodes: VNode[] = [];
  for (let b = 0; b < bands; b++) {
    const base = (ctx.h / (bands + 1)) * (b + 1) * 0.9;
    const amp = ctx.h * 0.08;
    const phase = rand() * Math.PI * 2;
    let d = `M0 ${r1(base)}`;
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const x = (ctx.w / steps) * i;
      const y = base + Math.sin((i / steps) * Math.PI * 2 + phase) * amp;
      d += ` L${r1(x)} ${r1(y)}`;
    }
    d += ` L${r1(ctx.w)} ${r1(ctx.h)} L0 ${r1(ctx.h)}Z`;
    nodes.push(h("path", { d, fill: color(ctx, b) }));
  }
  return nodes;
}

const DECOR: Record<DecorId, (ctx: DecorContext) => VNode[]> = {
  confetti,
  balloons,
  sparkles,
  starfield,
  "crescent-moon": crescentMoon,
  cloud,
  "botanical-branch": botanicalBranch,
  "floral-corner": floralCorner,
  bloom,
  "leaf-sprig": leafSprig,
  "gold-frame": goldFrame,
  "deco-corners": decoCorners,
  laurel,
  "grad-cap": gradCap,
  geometric,
  hearts,
  ring,
  sunburst,
  citrus,
  "neon-zigzag": neonZigzag,
  divider,
  "dot-grid": dotGrid,
  squiggle,
  blob,
  "arch-frame": archFrame,
  wave,
};

export function renderDecor(id: DecorId, ctx: DecorContext): VNode[] {
  return DECOR[id](ctx);
}

export { heartPath, sparklePath };
