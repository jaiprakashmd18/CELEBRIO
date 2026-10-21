/**
 * Deterministic text measurement, wrapping and fitting.
 *
 * SVG has no automatic line wrapping, so the engine breaks lines itself using
 * pre-computed advance widths (font-metrics.json). The same code runs in the
 * browser and on the server, so line breaks are identical everywhere.
 */
import metricsJson from "./font-metrics.json";
import { FALLBACK_FONT_FILE, resolveFace, type FontFamilyId } from "./fonts";

interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  avg: number;
  w: Record<string, number>;
}

const METRICS = metricsJson as unknown as Record<string, FontMetrics>;

export interface FontSpec {
  family: FontFamilyId;
  weight: number;
  italic: boolean;
}

function metricsFor(spec: FontSpec): FontMetrics {
  const face = resolveFace(spec.family, spec.weight, spec.italic);
  const m = METRICS[face.file];
  if (!m) throw new Error(`Missing font metrics for ${face.file}. Run "npm run fonts:metrics".`);
  return m;
}

const fallback = METRICS[FALLBACK_FONT_FILE];

function charAdvance(m: FontMetrics, cp: number): number {
  const key = cp.toString(36);
  const own = m.w[key];
  if (own !== undefined) return own / m.unitsPerEm;
  const fb = fallback?.w[key];
  if (fb !== undefined && fallback) return fb / fallback.unitsPerEm;
  return m.avg / m.unitsPerEm;
}

/** Width of `text` in pixels at `fontSize`, including letter spacing (em). */
export function measureText(text: string, spec: FontSpec, fontSize: number, letterSpacingEm = 0): number {
  const m = metricsFor(spec);
  let width = 0;
  let count = 0;
  for (const ch of text) {
    width += charAdvance(m, ch.codePointAt(0)!);
    count++;
  }
  return (width + Math.max(0, count - 1) * letterSpacingEm) * fontSize;
}

export function fontVerticalMetrics(spec: FontSpec): { ascent: number; descent: number } {
  const m = metricsFor(spec);
  return { ascent: m.ascender / m.unitsPerEm, descent: Math.abs(m.descender) / m.unitsPerEm };
}

/** Breaks a single word that is wider than the box into pieces. */
function breakLongWord(word: string, maxWidth: number, measure: (s: string) => number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const ch of word) {
    if (current && measure(current + ch) > maxWidth) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Greedy word wrap that respects explicit newlines. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (measure(word) > maxWidth) {
        const pieces = breakLongWord(word, maxWidth, measure);
        lines.push(...pieces.slice(0, -1));
        current = pieces[pieces.length - 1] ?? "";
      } else {
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

export interface FitOptions {
  text: string;
  font: FontSpec;
  maxWidth: number;
  maxHeight: number;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  letterSpacing: number;
  maxLines: number;
}

export interface FitResult {
  lines: string[];
  fontSize: number;
  lineHeightPx: number;
  /** True when the text had to be truncated even at the minimum font size. */
  overflow: boolean;
}

/**
 * Finds the largest font size (between fontSize and minFontSize) at which the
 * text fits inside the box within maxLines. If it never fits, the text is
 * truncated with an ellipsis at minFontSize and `overflow` is reported so the
 * editor can warn the customer before they pay.
 */
export function fitText(opts: FitOptions): FitResult {
  const { text, font, maxWidth, maxHeight, lineHeight, letterSpacing, maxLines } = opts;
  const start = Math.max(opts.fontSize, opts.minFontSize);
  const min = Math.min(opts.fontSize, opts.minFontSize);
  const step = Math.max(1, start / 40);

  for (let size = start; size >= min - 0.001; size -= step) {
    const measure = (s: string) => measureText(s, font, size, letterSpacing);
    const lines = wrapText(text, maxWidth, measure);
    const heightNeeded = lines.length * size * lineHeight;
    if (lines.length <= maxLines && heightNeeded <= maxHeight + 0.5) {
      return { lines, fontSize: size, lineHeightPx: size * lineHeight, overflow: false };
    }
  }

  const size = min;
  const measure = (s: string) => measureText(s, font, size, letterSpacing);
  const allLines = wrapText(text, maxWidth, measure);
  const linesThatFit = Math.max(1, Math.min(maxLines, Math.floor((maxHeight + 0.5) / (size * lineHeight))));
  const lines = allLines.slice(0, linesThatFit);
  if (allLines.length > linesThatFit) {
    let last = lines[lines.length - 1] ?? "";
    while (last.length > 0 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return { lines, fontSize: size, lineHeightPx: size * lineHeight, overflow: true };
}
