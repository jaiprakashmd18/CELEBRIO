import { describe, expect, it } from "vitest";
import { addTextElement, clampGeometry, deleteElement, duplicateElement, editElementText, moveLayer, patchElement, resetFormat, setField } from "@/lib/projects/edit";
import { missingRequiredFields, validateProjectForTemplate } from "@/lib/projects/validate";
import { resolveElements, createProjectFromTemplate } from "@/lib/rendering/scene";
import { templateDefinitionSchema, type TextElement } from "@/lib/templates/schema";
import { STARTER_TEMPLATES } from "@/templates/starter";

const t = STARTER_TEMPLATES.find((x) => x.slug === "ivory-botanicals")!;
const def = templateDefinitionSchema.parse(t.definition);
const fresh = () => createProjectFromTemplate(def, { slug: t.slug, version: 1 });
const opts = { templateSlug: t.slug, templateVersion: 1 };
const ASSET = "0b8f4c8e-5d0e-4b0a-9c1f-3f7c2a1e9d11";

describe("project validation (server side)", () => {
  it("accepts a fresh project", () => {
    expect(validateProjectForTemplate(def, fresh(), opts).ok).toBe(true);
  });

  it("rejects text longer than the field's limit and unknown fields", () => {
    const tooLong = setField(fresh(), "name_one", "x".repeat(31));
    expect(validateProjectForTemplate(def, tooLong, opts)).toMatchObject({ ok: false });
    const unknown = setField(fresh(), "hacker_field", "x");
    expect(validateProjectForTemplate(def, unknown, opts)).toMatchObject({ ok: false });
  });

  it("rejects a project for another template or version", () => {
    expect(validateProjectForTemplate(def, fresh(), { ...opts, templateVersion: 2 }).ok).toBe(false);
    expect(validateProjectForTemplate(def, fresh(), { ...opts, templateSlug: "golden-years" }).ok).toBe(false);
  });

  it("rejects photos that belong to someone else and browser-only photos", () => {
    const p = fresh();
    p.images.photo = { source: { kind: "asset", assetId: ASSET }, width: 1000, height: 1000, fit: "fill", crop: { zoom: 1, offsetX: 0, offsetY: 0 } };
    expect(validateProjectForTemplate(def, p, { ...opts, ownedAssetIds: new Set() }).ok).toBe(false);
    expect(validateProjectForTemplate(def, p, { ...opts, ownedAssetIds: new Set([ASSET]) }).ok).toBe(true);
    const local = fresh();
    local.images.photo = { source: { kind: "local", localId: "abc12345-xyz" }, width: 10, height: 10, fit: "fill", crop: { zoom: 1, offsetX: 0, offsetY: 0 } };
    expect(validateProjectForTemplate(def, local, opts).ok).toBe(false);
  });

  it("rejects out-of-bounds geometry, bad colours and overrides for unknown elements", () => {
    const far = patchElement(fresh(), "portrait", "venue", { x: 99999 });
    expect(validateProjectForTemplate(def, far, opts).ok).toBe(false);
    const colour = patchElement(fresh(), "portrait", "venue", { style: { color: "javascript:alert(1)" as never } });
    expect(validateProjectForTemplate(def, colour, opts).ok).toBe(false);
    const ghost = patchElement(fresh(), "portrait", "not-there", { x: 10 });
    expect(validateProjectForTemplate(def, ghost, opts).ok).toBe(false);
  });

  it("lists required fields that are still empty", () => {
    expect(missingRequiredFields(def, fresh())).toEqual([]);
    expect(missingRequiredFields(def, setField(fresh(), "venue", " "))).toEqual(["Venue name"]);
  });
});

describe("shared edit operations", () => {
  it("advanced edits are stored as overrides and render in both modes", () => {
    const p = patchElement(fresh(), "portrait", "venue", { x: 200, style: { fontSize: 70 } });
    const el = resolveElements(def, p, "portrait").find((e) => e.id === "venue") as TextElement;
    expect(el.x).toBe(200);
    expect(el.style.fontSize).toBe(70);
    expect(el.style.color).toBe("palette.text");
    expect(resolveElements(def, p, "square").find((e) => e.id === "venue")?.x).not.toBe(200);
  });

  it("editing a field-bound text element updates the field (keeps automatic mode in sync)", () => {
    const el = def.formats.portrait!.elements.find((e) => e.id === "name-one") as TextElement;
    const p = editElementText(fresh(), "portrait", el, "Meera");
    expect(p.fields.name_one).toBe("Meera");
  });

  it("deleting a template element hides it; deleting an added element removes it", () => {
    const hidden = deleteElement(fresh(), "portrait", "venue");
    expect(resolveElements(def, hidden, "portrait").find((e) => e.id === "venue")?.hidden).toBe(true);
    const { project, id } = addTextElement(fresh(), "portrait");
    expect(resolveElements(def, project, "portrait").some((e) => e.id === id)).toBe(true);
    expect(resolveElements(def, deleteElement(project, "portrait", id), "portrait").some((e) => e.id === id)).toBe(false);
  });

  it("duplicates and reorders layers", () => {
    const src = resolveElements(def, fresh(), "portrait").find((e) => e.id === "venue")!;
    const dup = duplicateElement(fresh(), "portrait", src);
    expect(dup.id).toBeTruthy();
    const ordered = resolveElements(def, dup.project, "portrait");
    const moved = moveLayer(dup.project, "portrait", ordered, "venue", "bottom");
    expect(resolveElements(def, moved, "portrait")[0]?.id).toBe("venue");
    expect(resolveFormatReset()).toBe(true);
    function resolveFormatReset() {
      return resetFormat(moved, "portrait").overrides.portrait === undefined;
    }
  });

  it("keeps elements within safe canvas bounds", () => {
    const safe = clampGeometry({ x: 5000, y: -5000 }, { x: 0, y: 0, w: 400, h: 100 }, "portrait");
    expect(safe.x).toBeLessThanOrEqual(1080 - 100);
    expect(safe.y).toBeGreaterThanOrEqual(-75);
  });
});
