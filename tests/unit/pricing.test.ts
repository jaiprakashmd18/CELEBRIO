import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";
import { PricingError, availablePackages, calculateQuote, type PricedTemplate } from "@/lib/pricing";

const base: PricedTemplate = { priceAmount: 4900, multiFormatPriceAmount: 14900, currency: "INR", isFree: false, supportedFormats: ["portrait", "square", "landscape"] };

describe("calculateQuote", () => {
  it("charges the single-format price for the project's format only", () => {
    const q = calculateQuote(base, "single_format", "square");
    expect(q).toMatchObject({ amountMinor: 4900, currency: "INR", formats: ["square"], isFree: false });
    expect(q.fileTypes).toEqual(["png", "jpeg", "pdf"]);
  });

  it("charges the package price for every supported format", () => {
    const q = calculateQuote(base, "multi_format", "portrait");
    expect(q.amountMinor).toBe(14900);
    expect(q.formats).toEqual(["portrait", "square", "landscape"]);
  });

  it("returns zero for free templates in any package", () => {
    const free = { ...base, priceAmount: 0, multiFormatPriceAmount: 0, isFree: true };
    expect(calculateQuote(free, "single_format", "portrait").amountMinor).toBe(0);
    expect(calculateQuote(free, "multi_format", "portrait")).toMatchObject({ amountMinor: 0, isFree: true });
  });

  it("rejects formats the template does not support", () => {
    expect(() => calculateQuote({ ...base, supportedFormats: ["portrait"] }, "single_format", "landscape")).toThrow(PricingError);
  });

  it("does not offer the multi-format package without a price or with one format", () => {
    expect(availablePackages({ ...base, multiFormatPriceAmount: null })).toEqual(["single_format"]);
    expect(availablePackages({ ...base, supportedFormats: ["portrait"] })).toEqual(["single_format"]);
    expect(() => calculateQuote({ ...base, multiFormatPriceAmount: null }, "multi_format", "portrait")).toThrow(/not available/);
  });

  it("rejects non-integer or negative amounts and bad currency codes", () => {
    expect(() => calculateQuote({ ...base, priceAmount: 49.5 }, "single_format", "portrait")).toThrow(PricingError);
    expect(() => calculateQuote({ ...base, priceAmount: -1 }, "single_format", "portrait")).toThrow(PricingError);
    expect(() => calculateQuote({ ...base, currency: "rupees" }, "single_format", "portrait")).toThrow(/ISO 4217/);
  });

  it("never converts currency implicitly — the quote keeps the template's currency and amount", () => {
    const usd = calculateQuote({ ...base, currency: "USD", priceAmount: 299 }, "single_format", "portrait");
    expect(usd).toMatchObject({ currency: "USD", amountMinor: 299 });
    const inr = calculateQuote(base, "single_format", "portrait");
    expect(inr).toMatchObject({ currency: "INR", amountMinor: 4900 });
  });
});

describe("formatMoney", () => {
  it("formats minor units per currency", () => {
    expect(formatMoney(4900, "INR")).toBe("₹49");
    expect(formatMoney(14950, "INR")).toBe("₹149.50");
    expect(formatMoney(500, "JPY")).toMatch(/500/);
  });
  it("refuses fractional minor units", () => {
    expect(() => formatMoney(10.5, "INR")).toThrow();
  });
});
