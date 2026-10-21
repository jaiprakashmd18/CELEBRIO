import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { listAllPublishedSlugs } from "@/lib/data/catalog";
import { CATEGORIES } from "@/lib/templates/categories";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const staticPages = ["", "/templates", "/pricing", "/how-it-works", "/faq", "/contact", "/privacy", "/terms", "/refund-policy", "/acceptable-use", "/cookies"];
  const slugs = await listAllPublishedSlugs().catch(() => []);
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...CATEGORIES.map((c) => ({ url: `${base}/invitations/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...slugs.map((slug) => ({ url: `${base}/templates/${slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
