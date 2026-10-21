/**
 * Pure purchase-entitlement rules used before generating any clean export.
 * The data passed in is always loaded on the server from the database.
 */
import type { FormatId } from "@/lib/templates/schema";

export type ExportFileType = "png" | "jpeg" | "pdf";

export interface EntitlementRecord {
  status: "active" | "revoked";
  allowed_formats: string[];
  allowed_file_types: string[];
  order_status: string;
}

export type ExportDecision =
  | { allowed: true }
  | { allowed: false; reason: "not_authenticated" | "not_owner" | "payment_required" | "format_not_included" | "file_type_not_included" | "revoked" };

export function decideCleanExport(input: {
  userId: string | null;
  projectOwnerId: string;
  entitlements: EntitlementRecord[];
  format: FormatId;
  fileType: ExportFileType;
}): ExportDecision {
  if (!input.userId) return { allowed: false, reason: "not_authenticated" };
  if (input.userId !== input.projectOwnerId) return { allowed: false, reason: "not_owner" };
  const valid = input.entitlements.filter((e) => e.status === "active" && e.order_status === "paid");
  if (valid.length === 0) {
    const hadRevoked = input.entitlements.some((e) => e.status === "revoked" || ["refunded", "disputed"].includes(e.order_status));
    return { allowed: false, reason: hadRevoked ? "revoked" : "payment_required" };
  }
  const coversFormat = valid.filter((e) => e.allowed_formats.includes(input.format));
  if (coversFormat.length === 0) return { allowed: false, reason: "format_not_included" };
  if (!coversFormat.some((e) => e.allowed_file_types.includes(input.fileType))) return { allowed: false, reason: "file_type_not_included" };
  return { allowed: true };
}

export const EXPORT_DENIAL_MESSAGES: Record<Exclude<ExportDecision, { allowed: true }>["reason"], string> = {
  not_authenticated: "Please sign in to download your invitation.",
  not_owner: "You don't have access to this invitation.",
  payment_required: "Unlock this invitation to download the full-quality file without a watermark.",
  format_not_included: "Your purchase doesn't include this format. Choose a purchased format or upgrade to the multi-format package.",
  file_type_not_included: "Your purchase doesn't include this file type.",
  revoked: "Access to this purchase has been revoked (for example after a refund). Contact support if you think this is a mistake.",
};
