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

import { extractOrderId } from "@/lib/orders/order-id";

describe("order id on the payment return page", () => {
  const id = "3f2a9c1e-5d0e-4b0a-9c1f-3f7c2a1e9d11";
  it("reads a clean order id", () => expect(extractOrderId({ order: id })).toBe(id));
  it("tolerates provider parameters appended without '&'", () => {
    expect(extractOrderId({ order: `${id}?razorpay_payment_id=pay_123` })).toBe(id);
  });
  it("falls back to Razorpay's reference id", () => {
    expect(extractOrderId({ razorpay_payment_link_reference_id: id })).toBe(id);
  });
  it("rejects anything that isn't an order id", () => {
    expect(extractOrderId({ order: "../../admin" })).toBeNull();
    expect(extractOrderId({})).toBeNull();
  });
});
