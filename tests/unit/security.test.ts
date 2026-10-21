import { describe, expect, it } from "vitest";
import { checkUpload, detectImageType } from "@/lib/security/file-validation";
import { safeNextPath } from "@/lib/security/redirect";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`);

describe("upload validation", () => {
  it("detects real image signatures", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
    expect(detectImageType(SVG)).toBeNull();
  });
  it("rejects SVG and other active content even when labelled as an image", () => {
    expect(checkUpload({ declaredType: "image/svg+xml", size: SVG.length, head: SVG, maxBytes: 1e6 })).toMatchObject({ ok: false, code: "unsupported_type" });
    expect(checkUpload({ declaredType: "image/png", size: SVG.length, head: SVG, maxBytes: 1e6 })).toMatchObject({ ok: false, code: "unsupported_type" });
  });
  it("rejects mismatched types, empty and oversized files", () => {
    expect(checkUpload({ declaredType: "image/png", size: 100, head: JPEG, maxBytes: 1e6 })).toMatchObject({ ok: false, code: "type_mismatch" });
    expect(checkUpload({ declaredType: "image/jpeg", size: 0, head: JPEG, maxBytes: 1e6 })).toMatchObject({ ok: false, code: "empty" });
    expect(checkUpload({ declaredType: "image/jpeg", size: 9e6, head: JPEG, maxBytes: 8e6 })).toMatchObject({ ok: false, code: "too_large" });
    expect(checkUpload({ declaredType: "image/jpeg", size: 100, head: JPEG, maxBytes: 8e6 })).toEqual({ ok: true, type: "image/jpeg" });
  });
});

describe("redirect safety", () => {
  it("only allows same-site paths", () => {
    expect(safeNextPath("/dashboard/drafts")).toBe("/dashboard/drafts");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath(null, "/x")).toBe("/x");
  });
});
