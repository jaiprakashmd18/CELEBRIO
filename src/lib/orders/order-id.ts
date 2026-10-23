const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Reads our order id from the confirmation page's query string. Payment
 * providers append their own parameters to the return URL (Razorpay adds
 * razorpay_payment_id, razorpay_payment_link_reference_id, …), sometimes
 * without a proper "&", so the value may carry trailing text. The order id
 * is only used to look up the signed-in buyer's own order — it never marks
 * anything as paid.
 */
export function extractOrderId(params: Record<string, string | string[] | undefined>): string | null {
  const candidates = [params.order, params.razorpay_payment_link_reference_id].flat();
  for (const value of candidates) {
    const match = typeof value === "string" ? UUID_PREFIX.exec(value.trim()) : null;
    if (match) return match[0].toLowerCase();
  }
  return null;
}
