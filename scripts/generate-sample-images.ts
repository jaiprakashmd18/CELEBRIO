/**
 * Generates the built-in sample "photos" used by starter templates.
 *
 * These are original flat illustrations drawn in SVG here and rasterised to
 * JPEG, so Celebrio ships with sample imagery that has no third-party
 * licensing restrictions. Run: npm run templates:samples
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { SAMPLE_IMAGES } from "../src/lib/templates/samples";
import type { SampleImageId } from "../src/lib/templates/schema";

const OUT = path.join(process.cwd(), "public", "templates", "samples");
fs.mkdirSync(OUT, { recursive: true });

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grad = (id: string, stops: Array<[number, string]>, vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;

const hills = (w: number, h: number, base: number, amp: number, color: string, phase: number) => {
  let d = `M0 ${h}`;
  for (let x = 0; x <= w; x += w / 20) d += ` L${x} ${base + Math.sin(x / w * Math.PI * 2 + phase) * amp}`;
  return `<path d="${d} L${w} ${h}Z" fill="${color}"/>`;
};

const person = (x: number, y: number, s: number, color: string, dress = false) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${color}">
    <circle cx="0" cy="-150" r="28"/>
    ${dress ? `<path d="M-26 -118 Q0 -128 26 -118 L52 40 L-52 40Z"/>` : `<path d="M-30 -118 Q0 -126 30 -118 L36 -10 L22 60 L6 60 L0 -10 L-6 60 L-22 60 L-36 -10Z"/>`}
  </g>`;

const scenes: Record<SampleImageId, (w: number, h: number) => string> = {
  "sunset-couple": (w, h) => `<defs>${grad("s", [[0, "#F6B48F"], [0.55, "#F9D8B5"], [1, "#FBEBDD"]])}</defs>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
    <circle cx="${w * 0.62}" cy="${h * 0.52}" r="${w * 0.17}" fill="#FFF1DA" opacity="0.95"/>
    ${hills(w, h, h * 0.66, 30, "#E9A88A", 0.4)}${hills(w, h, h * 0.74, 40, "#C97D6A", 2)}${hills(w, h, h * 0.84, 26, "#8E4E4B", 4)}
    ${person(w * 0.44, h * 0.84, 2.2, "#4A2A2C")}${person(w * 0.54, h * 0.84, 2.0, "#4A2A2C", true)}
    <path d="M${w * 0.49} ${h * 0.84 - 250} q20 -30 40 0" stroke="#4A2A2C" stroke-width="6" fill="none"/>`,
  "garden-couple": (w, h) => `<defs>${grad("s", [[0, "#DDE8D5"], [1, "#F5F1E6"]])}</defs>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
    <path d="M${w * 0.2} ${h} L${w * 0.2} ${h * 0.38} A${w * 0.3} ${w * 0.3} 0 0 1 ${w * 0.8} ${h * 0.38} L${w * 0.8} ${h}" fill="none" stroke="#7E9470" stroke-width="40"/>
    ${Array.from({ length: 40 }, (_, i) => { const a = Math.PI + (i / 39) * Math.PI; const r = w * 0.3; return `<circle cx="${w * 0.5 + Math.cos(a) * r}" cy="${h * 0.38 + Math.sin(a) * r}" r="${22 + (i % 3) * 8}" fill="${["#E8B4AE", "#F4D6CF", "#9DB08F"][i % 3]}"/>`; }).join("")}
    ${hills(w, h, h * 0.86, 12, "#9DB08F", 1)}
    ${person(w * 0.45, h * 0.86, 2.4, "#3F4B3A")}${person(w * 0.56, h * 0.86, 2.2, "#F7F2EA", true)}`,
  balloons: (w, h) => {
    const r = rng(4);
    const colors = ["#E5735F", "#F6B48F", "#D9A441", "#8CC7B5", "#F28DB2"];
    let b = "";
    for (let i = 0; i < 14; i++) {
      const x = r() * w; const y = h * 0.1 + r() * h * 0.6; const rx = 70 + r() * 60;
      b += `<path d="M${x} ${y + rx * 1.2} q-30 ${h * 0.2} 10 ${h}" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 1.2}" fill="${colors[i % 5]}"/><ellipse cx="${x - rx * 0.35}" cy="${y - rx * 0.45}" rx="${rx * 0.15}" ry="${rx * 0.28}" fill="#fff" opacity="0.4"/>`;
    }
    return `<defs>${grad("s", [[0, "#BFE3F2"], [1, "#FDF1E7"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>
      <ellipse cx="${w * 0.2}" cy="${h * 0.15}" rx="160" ry="60" fill="#fff" opacity="0.8"/><ellipse cx="${w * 0.8}" cy="${h * 0.3}" rx="200" ry="70" fill="#fff" opacity="0.7"/>${b}`;
  },
  "city-lights": (w, h) => {
    const r = rng(8);
    let bld = "";
    let x = 0;
    while (x < w) {
      const bw = 80 + r() * 140; const bh = h * (0.25 + r() * 0.45);
      bld += `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" fill="${r() > 0.5 ? "#1B1830" : "#241F3D"}"/>`;
      for (let wy = h - bh + 20; wy < h - 20; wy += 34) for (let wx = x + 14; wx < x + bw - 20; wx += 30) if (r() > 0.55) bld += `<rect x="${wx}" y="${wy}" width="12" height="18" fill="#E6CF9A" opacity="${0.5 + r() * 0.5}"/>`;
      x += bw + 6;
    }
    let stars = "";
    for (let i = 0; i < 120; i++) stars += `<circle cx="${r() * w}" cy="${r() * h * 0.5}" r="${1 + r() * 2.5}" fill="#fff" opacity="${0.3 + r() * 0.7}"/>`;
    return `<defs>${grad("s", [[0, "#0F0C1C"], [0.6, "#3A2D5C"], [1, "#7A4E6E"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>${stars}<circle cx="${w * 0.78}" cy="${h * 0.2}" r="70" fill="#F7EBD0"/>${bld}`;
  },
  graduate: (w, h) => {
    const r = rng(12);
    let conf = "";
    for (let i = 0; i < 70; i++) conf += `<rect x="${r() * w}" y="${r() * h * 0.6}" width="12" height="26" fill="${["#C6A15B", "#1F2A44", "#E4572E", "#ffffff"][i % 4]}" transform="rotate(${r() * 360} ${r() * w} ${r() * h})"/>`;
    return `<defs>${grad("s", [[0, "#9CC3E6"], [1, "#EAF2F7"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>${conf}
      ${hills(w, h, h * 0.86, 10, "#8DB580", 1)}
      <g transform="translate(${w * 0.5} ${h * 0.86}) scale(3)" fill="#1F2A44"><circle cx="0" cy="-150" r="26"/><path d="M-34 -120 Q0 -128 34 -120 L46 50 L-46 50Z"/><path d="M-30 -112 L-80 -200 L-68 -206 L-20 -120Z"/><path d="M30 -112 L80 -200 L92 -194 L40 -110Z"/></g>
      <g transform="translate(${w * 0.5} ${h * 0.2}) rotate(-15)"><path d="M0 -40 L120 0 L0 40 L-120 0Z" fill="#1F2A44"/><path d="M0 0 L70 20 L70 70" stroke="#C6A15B" stroke-width="6" fill="none"/></g>`;
  },
  nursery: (w, h) => `<defs>${grad("s", [[0, "#FCE9E6"], [1, "#FFF7F2"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>
    <rect y="${h * 0.78}" width="${w}" height="${h * 0.22}" fill="#EED6CC"/>
    <g transform="translate(${w * 0.5} ${h * 0.1})"><line x1="0" y1="0" x2="0" y2="120" stroke="#A9C5A0" stroke-width="6"/><line x1="-220" y1="120" x2="220" y2="120" stroke="#A9C5A0" stroke-width="6"/>
    ${[-200, -70, 70, 200].map((x, i) => `<line x1="${x}" y1="120" x2="${x}" y2="${220 + (i % 2) * 60}" stroke="#A9C5A0" stroke-width="3"/><circle cx="${x}" cy="${250 + (i % 2) * 60}" r="34" fill="${["#E89AA6", "#F6C9A8", "#A9C5A0", "#F2D58C"][i]}"/>`).join("")}</g>
    <g transform="translate(${w * 0.18} ${h * 0.5})"><rect width="${w * 0.64}" height="${h * 0.3}" rx="30" fill="#FFFFFF" stroke="#E2B8B0" stroke-width="10"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${40 + i * (w * 0.64 - 80) / 8}" y="20" width="12" height="${h * 0.3 - 40}" fill="#F1D8D2"/>`).join("")}</g>
    <ellipse cx="${w * 0.5}" cy="${h * 0.86}" rx="${w * 0.36}" ry="40" fill="#E2B8B0" opacity="0.5"/>`,
  "brunch-table": (w, h) => `<defs>${grad("s", [[0, "#FFE8B0"], [1, "#FFF6E0"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>
    <rect y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="#F7D79B"/>
    ${[0.25, 0.55, 0.8].map((x, i) => `<g transform="translate(${w * x} ${h * (0.7 + (i % 2) * 0.08)})"><ellipse rx="170" ry="70" fill="#FFFFFF"/><ellipse rx="120" ry="46" fill="${["#F28C28", "#5B8C5A", "#E4572E"][i]}" opacity="0.85"/></g>`).join("")}
    <g transform="translate(${w * 0.42} ${h * 0.4})"><rect x="-60" y="-80" width="120" height="140" rx="20" fill="#FFFFFF"/><path d="M60 -50 q50 0 50 40 q0 40 -50 40" fill="none" stroke="#FFFFFF" stroke-width="18"/><rect x="-50" y="-70" width="100" height="30" fill="#8A5A3B"/></g>
    <circle cx="${w * 0.75}" cy="${h * 0.38}" r="70" fill="#FFD25A"/><circle cx="${w * 0.75}" cy="${h * 0.38}" r="56" fill="#FFF4C2"/>`,
  celebration: (w, h) => {
    const r = rng(17);
    let lights = "";
    for (let k = 0; k < 3; k++) {
      const y0 = h * (0.12 + k * 0.12);
      lights += `<path d="M0 ${y0} Q${w / 2} ${y0 + 140} ${w} ${y0}" stroke="#4A3B2A" stroke-width="4" fill="none"/>`;
      for (let i = 1; i < 16; i++) { const t = i / 16; const x = t * w; const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + 140) + t * t * y0; lights += `<circle cx="${x}" cy="${y + 14}" r="14" fill="#FFE29A"/><circle cx="${x}" cy="${y + 14}" r="30" fill="#FFE29A" opacity="0.2"/>`; }
    }
    let people = "";
    for (let i = 0; i < 9; i++) people += person(w * (0.08 + i * 0.105), h * 0.98, 1.6 + r() * 0.6, "#2E2433", i % 2 === 0);
    return `<defs>${grad("s", [[0, "#2E2A4F"], [1, "#B5677A"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>${lights}${people}`;
  },
  "birthday-portrait": (w, h) => `<defs>${grad("s", [[0, "#F9D9E2"], [1, "#FFF3EA"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>
    <g transform="translate(${w * 0.5} ${h * 0.72})"><rect x="-300" y="-160" width="600" height="220" rx="30" fill="#F6B48F"/><rect x="-300" y="-160" width="600" height="60" rx="30" fill="#FFFFFF"/>
    <rect x="-220" y="-330" width="440" height="180" rx="26" fill="#E5735F"/><rect x="-220" y="-330" width="440" height="50" rx="26" fill="#FFFFFF"/>
    ${[-120, -40, 40, 120].map((x) => `<rect x="${x - 10}" y="-430" width="20" height="100" rx="8" fill="#8CC7B5"/><path d="M${x} -470 q18 22 0 40 q-18 -18 0 -40" fill="#F2B544"/>`).join("")}
    <ellipse cx="0" cy="70" rx="380" ry="40" fill="#E2B8B0" opacity="0.5"/></g>`,
  "golden-hour": (w, h) => `<defs>${grad("s", [[0, "#F2C46D"], [0.6, "#F7DFA8"], [1, "#FBF0D6"]])}</defs><rect width="${w}" height="${h}" fill="url(#s)"/>
    <circle cx="${w * 0.3}" cy="${h * 0.5}" r="${h * 0.16}" fill="#FFF4D6"/>
    ${hills(w, h, h * 0.6, 40, "#D9A35E", 0.3)}${hills(w, h, h * 0.72, 30, "#B37A47", 2.4)}${hills(w, h, h * 0.86, 20, "#7C4F33", 5)}`,
};

async function main() {
  for (const [id, meta] of Object.entries(SAMPLE_IMAGES) as Array<[SampleImageId, (typeof SAMPLE_IMAGES)[SampleImageId]]>) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}" viewBox="0 0 ${meta.width} ${meta.height}">${scenes[id](meta.width, meta.height)}</svg>`;
    const png = new Resvg(svg).render().asPng();
    await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(OUT, `${id}.jpg`));
    console.log(`✓ ${id}.jpg`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
