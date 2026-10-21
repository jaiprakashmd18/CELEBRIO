/**
 * Server-authoritative pricing. Prices always come from the template record in
 * the database; nothing the browser sends can change the amount charged.
 */
import { FORMAT_IDS, type FormatId } from "@/lib/templates/schema";

export const PACKAGE_IDS = ["single_format", "multi_format"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];
export const EXPORT_FILE_TYPES_ALL = ["png", "jpeg", "pdf"] as const;

export interface PricedTemplate {
  priceAmount: number;
  multiFormatPriceAmount: number | null;
  currency: string;
  isFree: boolean;
  supportedFormats: FormatId[];
}

export interface Quote {
  package: PackageId;
  amountMinor: number;
  currency: string;
  formats: FormatId[];
  fileTypes: Array<(typeof EXPORT_FILE_TYPES_ALL)[number]>;
  isFree: boolean;
}

export class PricingError extends Error {
  constructor(
    public code: "format_not_supported" | "package_not_available" | "invalid_price" | "invalid_currency",
    message: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export const PACKAGE_LABELS: Record<PackageId, { title: string; description: string }> = {
  single_format: {
    title: "Single format",
    description: "Your invitation in the format you designed, as high-resolution PNG, JPEG and print-ready PDF.",
  },
  multi_format: {
    title: "Multi-format package",
    description: "Every format this design supports (portrait, square and/or landscape), each as PNG, JPEG and PDF.",
  },
};

function assertValid(template: PricedTemplate) {
  if (!/^[A-Z]{3}$/.test(template.currency)) throw new PricingError("invalid_currency", "Currency must be an ISO 4217 code");
  for (const amount of [template.priceAmount, template.multiFormatPriceAmount]) {
    if (amount !== null && (!Number.isInteger(amount) || amount < 0)) {
      throw new PricingError("invalid_price", "Prices must be non-negative integer minor units");
    }
  }
}

export function availablePackages(template: PricedTemplate): PackageId[] {
  const packages: PackageId[] = ["single_format"];
  if (template.multiFormatPriceAmount !== null && template.supportedFormats.length > 1) packages.push("multi_format");
  return packages;
}

export function calculateQuote(template: PricedTemplate, pkg: PackageId, projectFormat: FormatId): Quote {
  assertValid(template);
  if (!template.supportedFormats.includes(projectFormat)) {
    throw new PricingError("format_not_supported", "This template does not support the selected format");
  }
  if (!availablePackages(template).includes(pkg)) {
    throw new PricingError("package_not_available", "This package is not available for this template");
  }
  const formats = pkg === "single_format" ? [projectFormat] : FORMAT_IDS.filter((f) => template.supportedFormats.includes(f));
  const amount = template.isFree ? 0 : pkg === "single_format" ? template.priceAmount : template.multiFormatPriceAmount!;
  return { package: pkg, amountMinor: amount, currency: template.currency, formats, fileTypes: [...EXPORT_FILE_TYPES_ALL], isFree: amount === 0 };
}
