/**
 * Font registry shared by the browser editor and the server export engine.
 *
 * Every font here is licensed under the SIL Open Font License (see
 * public/fonts/licenses). The same TTF files are:
 *   - served to browsers through @font-face rules (src/app/fonts.css), and
 *   - loaded by the server renderer (resvg) when exporting PNG/JPEG/PDF.
 * Because both sides use identical files and identical line-breaking
 * (see text-layout.ts), the export matches what the customer saw.
 */

export const FONT_FAMILY_IDS = [
  "playfair",
  "cormorant",
  "inter",
  "greatvibes",
  "montserrat",
  "bebas",
  "josefin",
  "dmserif",
  "pacifico",
] as const;

export type FontFamilyId = (typeof FONT_FAMILY_IDS)[number];

export type FontWeight = 300 | 400 | 500 | 600 | 700 | 800;

export interface FontFace {
  file: string;
  weight: FontWeight;
  italic: boolean;
}

export interface FontFamily {
  id: FontFamilyId;
  /** CSS / SVG family name. Must match the name embedded in the TTF. */
  cssName: string;
  label: string;
  category: "serif" | "sans" | "script" | "display";
  faces: FontFace[];
}

export const FONT_FAMILIES: Record<FontFamilyId, FontFamily> = {
  playfair: {
    id: "playfair",
    cssName: "Playfair Display",
    label: "Playfair Display",
    category: "serif",
    faces: [
      { file: "PlayfairDisplay-Regular.ttf", weight: 400, italic: false },
      { file: "PlayfairDisplay-Italic.ttf", weight: 400, italic: true },
      { file: "PlayfairDisplay-Bold.ttf", weight: 700, italic: false },
    ],
  },
  cormorant: {
    id: "cormorant",
    cssName: "Cormorant Garamond",
    label: "Cormorant Garamond",
    category: "serif",
    faces: [
      { file: "CormorantGaramond-Regular.ttf", weight: 400, italic: false },
      { file: "CormorantGaramond-Italic.ttf", weight: 400, italic: true },
      { file: "CormorantGaramond-SemiBold.ttf", weight: 600, italic: false },
    ],
  },
  inter: {
    id: "inter",
    cssName: "Inter",
    label: "Inter",
    category: "sans",
    faces: [
      { file: "Inter-Regular.ttf", weight: 400, italic: false },
      { file: "Inter-Medium.ttf", weight: 500, italic: false },
      { file: "Inter-SemiBold.ttf", weight: 600, italic: false },
      { file: "Inter-Bold.ttf", weight: 700, italic: false },
    ],
  },
  greatvibes: {
    id: "greatvibes",
    cssName: "Great Vibes",
    label: "Great Vibes",
    category: "script",
    faces: [{ file: "GreatVibes-Regular.ttf", weight: 400, italic: false }],
  },
  montserrat: {
    id: "montserrat",
    cssName: "Montserrat",
    label: "Montserrat",
    category: "sans",
    faces: [
      { file: "Montserrat-Regular.ttf", weight: 400, italic: false },
      { file: "Montserrat-SemiBold.ttf", weight: 600, italic: false },
      { file: "Montserrat-ExtraBold.ttf", weight: 800, italic: false },
    ],
  },
  bebas: {
    id: "bebas",
    cssName: "Bebas Neue",
    label: "Bebas Neue",
    category: "display",
    faces: [{ file: "BebasNeue-Regular.ttf", weight: 400, italic: false }],
  },
  josefin: {
    id: "josefin",
    cssName: "Josefin Sans",
    label: "Josefin Sans",
    category: "sans",
    faces: [
      { file: "JosefinSans-Light.ttf", weight: 300, italic: false },
      { file: "JosefinSans-SemiBold.ttf", weight: 600, italic: false },
    ],
  },
  dmserif: {
    id: "dmserif",
    cssName: "DM Serif Display",
    label: "DM Serif Display",
    category: "serif",
    faces: [
      { file: "DMSerifDisplay-Regular.ttf", weight: 400, italic: false },
      { file: "DMSerifDisplay-Italic.ttf", weight: 400, italic: true },
    ],
  },
  pacifico: {
    id: "pacifico",
    cssName: "Pacifico",
    label: "Pacifico",
    category: "script",
    faces: [{ file: "Pacifico-Regular.ttf", weight: 400, italic: false }],
  },
};

/** Fallback font for Devanagari (Hindi, Marathi, …) characters. */
export const FALLBACK_FONT_FILE = "NotoSansDevanagari-Regular.ttf";
export const FALLBACK_FONT_CSS_NAME = "Noto Sans Devanagari";

export function isFontFamilyId(value: string): value is FontFamilyId {
  return (FONT_FAMILY_IDS as readonly string[]).includes(value);
}

/**
 * Picks the closest available face for a requested weight/style so that the
 * browser and resvg never synthesise a different face from what we measured.
 */
export function resolveFace(family: FontFamilyId, weight: number, italic: boolean): FontFace {
  const faces = FONT_FAMILIES[family].faces;
  const sameStyle = faces.filter((f) => f.italic === italic);
  const pool = sameStyle.length > 0 ? sameStyle : faces;
  let best = pool[0]!;
  for (const face of pool) {
    if (Math.abs(face.weight - weight) < Math.abs(best.weight - weight)) best = face;
  }
  return best;
}

export function allFontFiles(): string[] {
  const files = Object.values(FONT_FAMILIES).flatMap((f) => f.faces.map((face) => face.file));
  return [...files, FALLBACK_FONT_FILE];
}
