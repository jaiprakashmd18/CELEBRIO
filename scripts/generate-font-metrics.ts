/**
 * Generates src/lib/rendering/font-metrics.json from the TTF files in
 * public/fonts. The metrics (advance widths, ascender, descender) let the
 * browser and the server compute identical line breaks without loading the
 * font binaries into the layout engine.
 *
 * Run: npm run fonts:metrics   (only needed after adding or changing fonts)
 */
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import { allFontFiles } from "../src/lib/rendering/fonts";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const OUT = path.join(process.cwd(), "src", "lib", "rendering", "font-metrics.json");

const RANGES: Array<[number, number]> = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0x17f], // Latin-1 Supplement + Latin Extended-A
  [0x2010, 0x2027], // dashes, quotes, bullets, ellipsis
  [0x20b9, 0x20b9], // Indian rupee sign
  [0x2600, 0x2665], // a few symbols (hearts, stars) where fonts provide them
  [0x0900, 0x097f], // Devanagari (fallback font)
];

interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  /** Average advance used for characters missing from the table. */
  avg: number;
  /** Map of code point (base 36) → advance width in font units. */
  w: Record<string, number>;
}

const result: Record<string, FontMetrics> = {};

for (const file of allFontFiles()) {
  const buffer = fs.readFileSync(path.join(FONT_DIR, file));
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const widths: Record<string, number> = {};
  let total = 0;
  let count = 0;
  for (const [start, end] of RANGES) {
    for (let cp = start; cp <= end; cp++) {
      const glyph = font.charToGlyph(String.fromCodePoint(cp));
      if (!glyph || glyph.index === 0) continue;
      const adv = Math.round(glyph.advanceWidth ?? 0);
      widths[cp.toString(36)] = adv;
      if (cp >= 0x61 && cp <= 0x7a) {
        total += adv;
        count++;
      }
    }
  }
  result[file] = {
    unitsPerEm: font.unitsPerEm,
    ascender: font.tables.hhea?.ascender ?? font.ascender,
    descender: font.tables.hhea?.descender ?? font.descender,
    avg: Math.round(count ? total / count : font.unitsPerEm * 0.5),
    w: widths,
  };
  console.log(`${file}: ${Object.keys(widths).length} glyphs`);
}

fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`Wrote ${OUT}`);
