/**
 * Generates public/brand/og.png (1200×630 social sharing image) using a real
 * starter template rendered by the export engine. Run: npm run brand:assets
 */
import path from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { STARTER_TEMPLATES } from "../src/templates/starter";
import { templateDefinitionSchema } from "../src/lib/templates/schema";
import { createProjectFromTemplate } from "../src/lib/rendering/scene";
import { loadSampleImage, renderPng } from "../src/lib/exports/rasterize";
import { allFontFiles } from "../src/lib/rendering/fonts";

async function main() {
  const picks = ["modern-elegance", "peach-confetti", "midnight-celebration"];
  const cards: Buffer[] = [];
  for (const slug of picks) {
    const t = STARTER_TEMPLATES.find((x) => x.slug === slug)!;
    const def = templateDefinitionSchema.parse(t.definition);
    const png = await renderPng(def, createProjectFromTemplate(def, { slug, version: 1 }), { format: "portrait", watermark: false, outputWidth: 270, loadImage: loadSampleImage });
    cards.push(png);
  }
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FAF8F3"/>
    <circle cx="1050" cy="-40" r="320" fill="#C98283" opacity="0.15"/><circle cx="80" cy="640" r="260" fill="#B89A62" opacity="0.14"/>
    <text x="70" y="250" font-family="Playfair Display" font-size="84" fill="#20201F">Celebrio</text>
    <text x="72" y="320" font-family="Playfair Display" font-style="italic" font-size="38" fill="#A85E60">Make Every Moment Beautiful.</text>
    <text x="72" y="390" font-family="Inter" font-size="24" fill="#77746E">Digital invitations for every celebration.</text></svg>`;
  const fontFiles = allFontFiles().map((f) => path.join(process.cwd(), "public", "fonts", f));
  const bg = new Resvg(text, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" } }).render().asPng();
  await sharp(bg)
    .composite(cards.map((c, i) => ({ input: c, left: 660 + i * 175, top: 60 + (i % 2) * 30 })))
    .png()
    .toFile(path.join(process.cwd(), "public", "brand", "og.png"));
  console.log("Wrote public/brand/og.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
