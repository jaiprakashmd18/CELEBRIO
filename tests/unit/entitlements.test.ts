import { describe, expect, it } from "vitest";
import { decideCleanExport, type EntitlementRecord } from "@/lib/entitlements";

const OWNER = "user-a";
const paid: EntitlementRecord = { status: "active", allowed_formats: ["portrait"], allowed_file_types: ["png", "jpeg", "pdf"], order_status: "paid" };

describe("clean export authorisation", () => {
  const decide = (over: Partial<Parameters<typeof decideCleanExport>[0]>) =>
    decideCleanExport({ userId: OWNER, projectOwnerId: OWNER, entitlements: [paid], format: "portrait", fileType: "png", ...over });

  it("allows the owner with a paid entitlement covering the format", () => {
    expect(decide({})).toEqual({ allowed: true });
    expect(decide({ fileType: "pdf" })).toEqual({ allowed: true });
  });
  it("requires authentication", () => expect(decide({ userId: null })).toMatchObject({ allowed: false, reason: "not_authenticated" }));
  it("blocks other users even if they own an entitlement", () => expect(decide({ userId: "user-b" })).toMatchObject({ reason: "not_owner" }));
  it("requires payment when there is no entitlement", () => expect(decide({ entitlements: [] })).toMatchObject({ reason: "payment_required" }));
  it("ignores entitlements whose order is not paid", () => expect(decide({ entitlements: [{ ...paid, order_status: "pending" }] })).toMatchObject({ reason: "payment_required" }));
  it("blocks formats not included in the purchase", () => expect(decide({ format: "landscape" })).toMatchObject({ reason: "format_not_included" }));
  it("blocks refunded or revoked purchases", () => {
    expect(decide({ entitlements: [{ ...paid, status: "revoked" }] })).toMatchObject({ reason: "revoked" });
    expect(decide({ entitlements: [{ ...paid, order_status: "refunded" }] })).toMatchObject({ reason: "revoked" });
  });
  it("blocks file types not included", () => expect(decide({ entitlements: [{ ...paid, allowed_file_types: ["png"] }], fileType: "pdf" })).toMatchObject({ reason: "file_type_not_included" }));
  it("combines multiple purchases for the same project", () => {
    expect(decide({ entitlements: [paid, { ...paid, allowed_formats: ["square", "landscape"] }], format: "landscape" })).toEqual({ allowed: true });
  });
});
