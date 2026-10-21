import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Constant-time comparison of two hex signatures. */
export function signaturesMatch(expectedHex: string, receivedHex: string): boolean {
  if (!/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length !== expectedHex.length) return false;
  return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHex, "hex"));
}
