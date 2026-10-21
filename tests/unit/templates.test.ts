import { describe, expect, it } from "vitest";
import { renderInvitation } from "@/lib/rendering/render";
import { availableFormats, createProjectFromTemplate } from "@/lib/rendering/scene";
import { CATEGORIES } from "@/lib/templates/categories";
import { FORMAT_SIZES, templateDefinitionSchema } from "@/lib/templates/schema";
import { STARTER_TEMPLATES } from "@/templates/starter";

describe("starter template library", () => {
  it("contains at least 16 templates with unique slugs and two per category", () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(STARTER_TEMPLATES.map((t) => t.slug)).size).toBe(STARTER_TEMPLATES.length);
    for (const c of CATEGORIES) expect(STARTER_TEMPLATES.filter((t) => t.category === c.slug).length).toBeGreaterThanOrEqual(2);
  });

  it.each(STARTER_TEMPLATES.map((t) => [t.slug, t] as const))("%s is a valid definition that renders sample data without overflow", (_slug, t) => {
    const def = templateDefinitionSchema.parse(t.definition);
    expect(def.fields.some((f) => f.type === "image")).toBe(true);
    expect(def.palettes.length).toBeGreaterThanOrEqual(1);
    const project = createProjectFromTemplate(def, { slug: t.slug, version: 1 });
    for (const format of availableFormats(def)) {
      const result = renderInvitation(def, project, { format, imageHref: () => "data:," });
      expect(result.width).toBe(FORMAT_SIZES[format].width);
      expect(result.height).toBe(FORMAT_SIZES[format].height);
      expect(result.overflow).toEqual([]);
    }
  });
});

describe("template definition validation", () => {
  const valid = templateDefinitionSchema.parse(STARTER_TEMPLATES[0]!.definition);
  const clone = () => JSON.parse(JSON.stringify(valid));

  it("rejects text that references unknown fields", () => {
    const d = clone();
    d.formats.portrait.elements.push({ ...d.formats.portrait.elements.find((e: { type: string }) => e.type === "text"), id: "bad", content: "{no_such_field}" });
    expect(templateDefinitionSchema.safeParse(d).success).toBe(false);
  });

  it("rejects layouts with the wrong export dimensions", () => {
    const d = clone();
    d.formats.portrait.width = 1000;
    expect(templateDefinitionSchema.safeParse(d).error?.issues[0]?.message).toMatch(/1080×1920/);
  });

  it("rejects duplicate element ids and duplicate field keys", () => {
    const d = clone();
    d.formats.portrait.elements[1].id = d.formats.portrait.elements[0].id;
    expect(templateDefinitionSchema.safeParse(d).success).toBe(false);
    const f = clone();
    f.fields.push({ ...f.fields[0] });
    expect(templateDefinitionSchema.safeParse(f).success).toBe(false);
  });

  it("requires maxLength on editable text fields and sample images for photo slots", () => {
    const d = clone();
    delete d.fields.find((f: { type: string }) => f.type === "text").maxLength;
    expect(templateDefinitionSchema.safeParse(d).success).toBe(false);
    const s = clone();
    s.sampleImages = {};
    expect(templateDefinitionSchema.safeParse(s).success).toBe(false);
  });

  it("rejects unsafe colours and unknown fonts", () => {
    const d = clone();
    d.palettes[0].colors.text = "red; background:url(x)";
    expect(templateDefinitionSchema.safeParse(d).success).toBe(false);
    const f = clone();
    f.fontSets[0].display = "comic-sans";
    expect(templateDefinitionSchema.safeParse(f).success).toBe(false);
  });
});
