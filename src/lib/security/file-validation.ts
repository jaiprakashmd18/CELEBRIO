/**
 * Upload validation. The declared MIME type is never trusted on its own: the
 * file's leading bytes ("magic numbers") must match a supported raster format.
 * SVG, HTML and other active content are rejected because they never match.
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export type UploadCheck =
  | { ok: true; type: AllowedImageType }
  | { ok: false; code: "empty" | "too_large" | "unsupported_type" | "type_mismatch"; message: string };

export function checkUpload(input: { declaredType: string; size: number; head: Uint8Array; maxBytes: number }): UploadCheck {
  if (input.size === 0) return { ok: false, code: "empty", message: "The file is empty." };
  if (input.size > input.maxBytes) {
    return { ok: false, code: "too_large", message: `Photos can be up to ${Math.floor(input.maxBytes / 1_000_000)} MB. Try a smaller image.` };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(input.declaredType)) {
    return { ok: false, code: "unsupported_type", message: "Please upload a JPEG, PNG or WebP image." };
  }
  const detected = detectImageType(input.head);
  if (!detected) return { ok: false, code: "unsupported_type", message: "This file isn't a valid JPEG, PNG or WebP image." };
  if (detected !== input.declaredType) {
    return { ok: false, code: "type_mismatch", message: "The file's contents don't match its type. Please re-save the image and try again." };
  }
  return { ok: true, type: detected };
}

export const MIN_IMAGE_SIDE = 200;
