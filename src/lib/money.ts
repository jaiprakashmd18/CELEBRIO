/**
 * Money helpers. Amounts are always integer minor units (e.g. paise) paired
 * with an explicit ISO 4217 currency code. Nothing here converts currencies.
 */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX"]);

export function minorUnitsPerMajor(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}

export function formatMoney(amountMinor: number, currency: string): string {
  if (!Number.isInteger(amountMinor)) throw new Error("Amounts must be integer minor units");
  const major = amountMinor / minorUnitsPerMajor(currency);
  const locale = currency.toUpperCase() === "INR" ? "en-IN" : "en";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}
