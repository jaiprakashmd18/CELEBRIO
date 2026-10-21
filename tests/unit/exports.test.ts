import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { PDF_DPI, PDF_PAGE_INCHES, loadSampleImage, renderExport } from "@/lib/exports/rasterize";
import { availableFormats, createProjectFromTemplate } from "@/lib/rendering/scene";
import { FORMAT_SIZES, templateDefinitionSchema } from "@/lib/templates/schema";
import { STARTER_TEMPLATES } from "@/templates/starter";

const opts = { watermark: false, loadImage: loadSampleImage };

describe("export engine", () => {
  const t = STARTER_TEMPLATES.find((x) => x.slug === "our-story")!;
  const def = templateDefinitionSchema.parse(t.definition);
  const project = createProjectFromTemplate(def, { slug: t.slug, version: 1 });

  it.each(["portrait", "square", "landscape"] as const)("renders a %s PNG at the exact export size", async (format) => {
    const out = await renderExport(def, { ...project, format }, "png", { ...opts, format });
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("png");
    expect([meta.width, meta.height]).toEqual([FORMAT_SIZES[format].width, FORMAT_SIZES[format].height]);
  });

  it("renders a valid high-quality JPEG", async () => {
    const out = await renderExport(def, project, "jpeg", { ...opts, format: "portrait" });
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([1080, 1920]);
  });

  it("renders a PDF whose page matches the design's proportions at 300 DPI", async () => {
    const out = await renderExport(def, project, "pdf", { ...opts, format: "portrait" });
    expect(out.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(out.bytes);
    const page = doc.getPage(0);
    expect(page.getWidth()).toBeCloseTo(PDF_PAGE_INCHES.portrait.width * 72, 1);
    expect(page.getHeight() / page.getWidth()).toBeCloseTo(1920 / 1080, 2);
    expect(PDF_DPI).toBe(300);
  });

  it.each(STARTER_TEMPLATES.map((x) => [x.slug, x] as const))("%s renders non-blank images in every format", async (_slug, tpl) => {
    const d = templateDefinitionSchema.parse(tpl.definition);
    const p = createProjectFromTemplate(d, { slug: tpl.slug, version: 1 });
    for (const format of availableFormats(d)) {
      const out = await renderExport(d, { ...p, format }, "png", { ...opts, format });
      const stats = await sharp(out.bytes).stats();
      const spread = stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0);
      expect(spread).toBeGreaterThan(10);
    }
  });

  it("applies the watermark to previews", async () => {
    const clean = await renderExport(def, project, "png", { ...opts, format: "portrait" });
    const marked = await renderExport(def, project, "png", { ...opts, watermark: true, format: "portrait" });
    expect(Buffer.compare(clean.bytes, marked.bytes)).not.toBe(0);
  });
});
