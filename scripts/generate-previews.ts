/**
 * Renders a preview image for every starter template and format using the
 * production export engine, with each template's sample content.
 * Output: public/templates/previews/<slug>-<format>.webp
 *
 * Run: npm run templates:previews   (optionally pass slugs to limit)
 * Set PREVIEW_DEBUG_DIR to also write full-size PNGs for inspection.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { STARTER_TEMPLATES } from "../src/templates/starter";
import { templateDefinitionSchema } from "../src/lib/templates/schema";
import { availableFormats, createProjectFromTemplate } from "../src/lib/rendering/scene";
import { loadSampleImage, renderPng } from "../src/lib/exports/rasterize";

const OUT = path.join(process.cwd(), "public", "templates", "previews");
const DEBUG = process.env.PREVIEW_DEBUG_DIR;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (DEBUG) fs.mkdirSync(DEBUG, { recursive: true });
  const only = process.argv.slice(2);
  for (const t of STARTER_TEMPLATES) {
    if (only.length && !only.includes(t.slug)) continue;
    const def = templateDefinitionSchema.parse(t.definition);
    const project = createProjectFromTemplate(def, { slug: t.slug, version: 1 });
    for (const format of availableFormats(def)) {
      const png = await renderPng(def, project, { format, watermark: false, loadImage: loadSampleImage });
      await sharp(png).resize({ width: format === "landscape" ? 960 : 720 }).webp({ quality: 82 }).toFile(path.join(OUT, `${t.slug}-${format}.webp`));
      if (DEBUG) fs.writeFileSync(path.join(DEBUG, `${t.slug}-${format}.png`), await sharp(png).resize({ width: 540 }).png().toBuffer());
      console.log(`✓ ${t.slug} (${format})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
