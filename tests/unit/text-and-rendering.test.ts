import { describe, expect, it } from "vitest";
import { applyFormatter, resolveContent } from "@/lib/rendering/format-text";
import { computeImagePlacement, renderInvitation } from "@/lib/rendering/render";
import { createProjectFromTemplate } from "@/lib/rendering/scene";
import { fitText, measureText, wrapText } from "@/lib/rendering/text-layout";
import { serializeVNode } from "@/lib/rendering/vnode";
import { FORMAT_SIZES, templateDefinitionSchema } from "@/lib/templates/schema";
import { STARTER_TEMPLATES } from "@/templates/starter";

const font = { family: "inter" as const, weight: 400, italic: false };

describe("text layout", () => {
  it("measures wider text as wider and scales with font size and letter spacing", () => {
    expect(measureText("WWWW", font, 40)).toBeGreaterThan(measureText("iiii", font, 40));
    expect(measureText("Hello", font, 80)).toBeCloseTo(measureText("Hello", font, 40) * 2, 5);
    expect(measureText("Hello", font, 40, 0.2)).toBeGreaterThan(measureText("Hello", font, 40));
  });

  it("wraps words within the width and keeps explicit line breaks", () => {
    const measure = (s: string) => measureText(s, font, 40);
    const lines = wrapText("The quick brown fox jumps over the lazy dog", 300, measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(300);
    expect(wrapText("one\ntwo", 1000, measure)).toEqual(["one", "two"]);
  });

  it("breaks a single word longer than the box", () => {
    const measure = (s: string) => measureText(s, font, 40);
    const lines = wrapText("Supercalifragilisticexpialidocious", 200, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("Supercalifragilisticexpialidocious");
  });

  it("shrinks text within limits before giving up", () => {
    const r = fitText({ text: "Maximilian Alexander", font, maxWidth: 400, maxHeight: 100, fontSize: 80, minFontSize: 30, lineHeight: 1.1, letterSpacing: 0, maxLines: 1 });
    expect(r.overflow).toBe(false);
    expect(r.fontSize).toBeLessThan(80);
    expect(r.fontSize).toBeGreaterThanOrEqual(30);
    expect(r.lines).toHaveLength(1);
  });

  it("truncates with an ellipsis and reports overflow when text cannot fit", () => {
    const r = fitText({ text: "word ".repeat(80), font, maxWidth: 300, maxHeight: 90, fontSize: 40, minFontSize: 30, lineHeight: 1.2, letterSpacing: 0, maxLines: 2 });
    expect(r.overflow).toBe(true);
    expect(r.lines.length).toBeLessThanOrEqual(2);
    expect(r.lines.at(-1)?.endsWith("…")).toBe(true);
  });
});

describe("content formatting", () => {
  it("formats dates and times deterministically", () => {
    expect(applyFormatter("2027-03-13", "long")).toBe("Saturday, 13 March 2027");
    expect(applyFormatter("2027-03-13", undefined)).toBe("13 March 2027");
    expect(applyFormatter("2027-03-13", "dots")).toBe("13 · 03 · 27");
    expect(applyFormatter("2027-03-01", "daymonth")).toBe("1st March");
    expect(applyFormatter("19:30", "time")).toBe("7:30 PM");
    expect(applyFormatter("00:00", "time")).toBe("12 AM");
  });

  it("hides lines whose fields are all empty", () => {
    expect(resolveContent("RSVP {rsvp}", { rsvp: "" })).toBeNull();
    expect(resolveContent("RSVP {rsvp}", { rsvp: "Asha" })).toBe("RSVP Asha");
    expect(resolveContent("Static text", {})).toBe("Static text");
  });
});

describe("aspect ratio and image placement", () => {
  it("defines the three export formats", () => {
    expect(FORMAT_SIZES.portrait).toMatchObject({ width: 1080, height: 1920 });
    expect(FORMAT_SIZES.square).toMatchObject({ width: 1080, height: 1080 });
    expect(FORMAT_SIZES.landscape).toMatchObject({ width: 1920, height: 1080 });
  });

  it("fill covers the frame and fit shows the whole photo, both preserving aspect ratio", () => {
    const value = { width: 1200, height: 800, fit: "fill" as const, crop: { zoom: 1, offsetX: 0, offsetY: 0 } };
    const fill = computeImagePlacement(value, 500, 500);
    expect(fill.width / fill.height).toBeCloseTo(1.5, 5);
    expect(fill.width).toBeGreaterThanOrEqual(500);
    expect(fill.height).toBeGreaterThanOrEqual(500);
    const fit = computeImagePlacement({ ...value, fit: "fit" }, 500, 500);
    expect(fit.width / fit.height).toBeCloseTo(1.5, 5);
    expect(fit.width).toBeLessThanOrEqual(500);
    expect(fit.height).toBeLessThanOrEqual(500);
  });

  it("offsets pan the photo to its edges and zoom enlarges it", () => {
    const value = { width: 1000, height: 500, fit: "fill" as const, crop: { zoom: 1, offsetX: -1, offsetY: 0 } };
    expect(computeImagePlacement(value, 400, 400).x).toBeCloseTo(0, 5);
    const right = computeImagePlacement({ ...value, crop: { zoom: 1, offsetX: 1, offsetY: 0 } }, 400, 400);
    expect(right.x + right.width).toBeCloseTo(400, 5);
    const zoomed = computeImagePlacement({ ...value, crop: { zoom: 2, offsetX: 0, offsetY: 0 } }, 400, 400);
    expect(zoomed.width).toBeCloseTo(right.width * 2, 5);
  });
});

describe("rendering safety", () => {
  const t = STARTER_TEMPLATES.find((x) => x.slug === "peach-confetti")!;
  const def = templateDefinitionSchema.parse(t.definition);

  it("escapes customer text so it can never become markup", () => {
    const project = createProjectFromTemplate(def, { slug: t.slug, version: 1 });
    project.fields.celebrant_name = `<script>alert("x")</script>`;
    const svg = serializeVNode(renderInvitation(def, project, { imageHref: () => null }).root);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("adds the visible watermark only when requested", () => {
    const project = createProjectFromTemplate(def, { slug: t.slug, version: 1 });
    expect(serializeVNode(renderInvitation(def, project, { imageHref: () => null, watermark: true }).root)).toContain("CELEBRIO PREVIEW");
    expect(serializeVNode(renderInvitation(def, project, { imageHref: () => null }).root)).not.toContain("CELEBRIO PREVIEW");
  });

  it("refuses to serialise tags outside the SVG allow-list", () => {
    expect(() => serializeVNode({ t: "foreignObject", a: {} })).toThrow(/Unsupported/);
    expect(() => serializeVNode({ t: "rect", a: { "on load": "x" } })).toThrow(/Invalid attribute/);
  });
});
