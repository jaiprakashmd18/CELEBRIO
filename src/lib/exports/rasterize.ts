/**
 * Server-side rasteriser: canonical project → SVG → PNG / JPEG / PDF.
 *
 * Uses resvg (a Rust SVG renderer, no headless browser required) with the
 * bundled OFL font files, so exports are deterministic and work on serverless
 * platforms. All images are embedded as data URIs before rendering, so the
 * renderer never fetches anything from the network.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { allFontFiles } from "@/lib/rendering/fonts";
import { renderInvitation } from "@/lib/rendering/render";
import { toSvgDocument } from "@/lib/rendering/vnode";
import type { FormatId, ImageSource, ProjectData, TemplateDefinition } from "@/lib/templates/schema";

export const EXPORT_FILE_TYPES = ["png", "jpeg", "pdf"] as const;
export type ExportFileType = (typeof EXPORT_FILE_TYPES)[number];

/** Physical print size used for PDFs: the design keeps its exact aspect ratio. */
export const PDF_PAGE_INCHES: Record<FormatId, { width: number; height: number }> = {
  portrait: { width: 6, height: 10.6667 },
  square: { width: 6, height: 6 },
  landscape: { width: 10.6667, height: 6 },
};
export const PDF_DPI = 300;

const PUBLIC_DIR = path.join(process.cwd(), "public");
let fontFilesCache: string[] | null = null;

function fontFiles(): string[] {
  fontFilesCache ??= allFontFiles().map((f) => path.join(PUBLIC_DIR, "fonts", f));
  return fontFilesCache;
}

export type ImageBytesLoader = (source: ImageSource) => Promise<{ bytes: Buffer; mime: string } | null>;

/** Loads built-in sample images from public/templates/samples. */
export async function loadSampleImage(source: ImageSource): Promise<{ bytes: Buffer; mime: string } | null> {
  if (source.kind !== "sample") return null;
  const bytes = await fs.readFile(path.join(PUBLIC_DIR, "templates", "samples", `${source.id}.jpg`));
  return { bytes, mime: "image/jpeg" };
}

function sourceKey(source: ImageSource): string {
  if (source.kind === "sample") return `sample:${source.id}`;
  if (source.kind === "asset") return `asset:${source.assetId}`;
  return `local:${source.localId}`;
}

export interface RasterOptions {
  format: FormatId;
  watermark: boolean;
  /** Output width in pixels; height follows the design's aspect ratio. */
  outputWidth?: number;
  loadImage: ImageBytesLoader;
}

export async function buildSvg(def: TemplateDefinition, project: ProjectData, opts: Omit<RasterOptions, "outputWidth">): Promise<{ svg: string; width: number; height: number }> {
  // Collect every image the design uses, then embed each one as a data URI.
  const sources = new Map<string, ImageSource>();
  renderInvitation(def, project, {
    format: opts.format,
    imageHref: (src) => {
      sources.set(sourceKey(src), src);
      return "about:blank";
    },
  });
  const dataUris = new Map<string, string>();
  await Promise.all(
    [...sources.entries()].map(async ([key, src]) => {
      const loaded = await opts.loadImage(src);
      if (loaded) dataUris.set(key, `data:${loaded.mime};base64,${loaded.bytes.toString("base64")}`);
    }),
  );
  const result = renderInvitation(def, project, {
    format: opts.format,
    watermark: opts.watermark,
    idPrefix: "x",
    imageHref: (src) => dataUris.get(sourceKey(src)) ?? null,
  });
  return { svg: toSvgDocument(result.root), width: result.width, height: result.height };
}

export async function renderPng(def: TemplateDefinition, project: ProjectData, opts: RasterOptions): Promise<Buffer> {
  const { svg, width } = await buildSvg(def, project, opts);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: opts.outputWidth ?? width },
    font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: "Inter" },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  });
  return Buffer.from(resvg.render().asPng());
}

export async function renderExport(
  def: TemplateDefinition,
  project: ProjectData,
  fileType: ExportFileType,
  opts: Omit<RasterOptions, "outputWidth">,
): Promise<{ bytes: Buffer; mime: string; extension: string; width: number; height: number }> {
  if (fileType === "pdf") {
    const page = PDF_PAGE_INCHES[opts.format];
    const pxWidth = Math.round(page.width * PDF_DPI);
    const png = await renderPng(def, project, { ...opts, outputWidth: pxWidth });
    const doc = await PDFDocument.create();
    doc.setTitle("Celebrio invitation");
    doc.setCreator("Celebrio");
    doc.setProducer("Celebrio export engine");
    const image = await doc.embedPng(png);
    const pageWidthPt = page.width * 72;
    const pageHeightPt = page.height * 72;
    const pdfPage = doc.addPage([pageWidthPt, pageHeightPt]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
    const bytes = Buffer.from(await doc.save());
    return { bytes, mime: "application/pdf", extension: "pdf", width: Math.round(pageWidthPt), height: Math.round(pageHeightPt) };
  }
  const png = await renderPng(def, project, opts);
  const meta = await sharp(png).metadata();
  if (fileType === "jpeg") {
    const bytes = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
    return { bytes, mime: "image/jpeg", extension: "jpg", width: meta.width ?? 0, height: meta.height ?? 0 };
  }
  const bytes = await sharp(png).png({ compressionLevel: 8 }).toBuffer();
  return { bytes, mime: "image/png", extension: "png", width: meta.width ?? 0, height: meta.height ?? 0 };
}
