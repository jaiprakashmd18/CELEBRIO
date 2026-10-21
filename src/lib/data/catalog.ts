import "server-only";
import { isSupabaseConfigured, serverEnv } from "@/config/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { CATEGORIES, type CategorySlug } from "@/lib/templates/categories";
import { FORMAT_IDS, templateDefinitionSchema, type FormatId, type TemplateDefinition } from "@/lib/templates/schema";
import { STARTER_TEMPLATES } from "@/templates/starter";

/**
 * Public catalogue access. Reads published templates from Supabase using a
 * cookie-less anonymous client (RLS only exposes published templates).
 *
 * When Supabase is not configured in local development, the 16 starter
 * templates are served from code so the gallery and editor can be explored
 * immediately. Production builds refuse to run without Supabase.
 */

export interface CatalogTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  tags: string[];
  style: string;
  colorFamily: string;
  previewPath: string | null;
  supportedFormats: FormatId[];
  priceAmount: number;
  multiFormatPriceAmount: number | null;
  currency: string;
  isFree: boolean;
  version: number;
  useCount: number;
  publishedAt: string | null;
}

export interface CatalogTemplateWithDefinition extends CatalogTemplate {
  definition: TemplateDefinition;
}

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc", "popular"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const PRICE_FILTERS = ["free", "standard", "premium"] as const;
export type PriceFilter = (typeof PRICE_FILTERS)[number];
export const STYLE_OPTIONS = ["classic", "modern", "playful", "romantic", "minimal", "bold"] as const;
export const COLOR_OPTIONS = ["warm", "cool", "dark", "pastel", "neutral"] as const;

/** Price threshold (minor units) between "standard" and "premium" filters. */
export const PREMIUM_THRESHOLD = 4900;

export interface CatalogQuery {
  q?: string;
  category?: string;
  style?: string;
  color?: string;
  orientation?: FormatId;
  price?: PriceFilter;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface CatalogPage {
  items: CatalogTemplate[];
  total: number;
  page: number;
  pageSize: number;
  hasPopularityData: boolean;
}

const TEMPLATE_COLUMNS =
  "id, slug, name, description, tags, style, color_family, preview_path, supported_formats, price_amount, multi_format_price_amount, currency, is_free, version, use_count, published_at, categories!inner(slug, name)";

interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  style: string;
  color_family: string;
  preview_path: string | null;
  supported_formats: string[];
  price_amount: number;
  multi_format_price_amount: number | null;
  currency: string;
  is_free: boolean;
  version: number;
  use_count: number;
  published_at: string | null;
  categories: { slug: string; name: string } | { slug: string; name: string }[];
  template_definition?: unknown;
}

export function mapTemplateRow(row: TemplateRow): CatalogTemplate {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categorySlug: category?.slug ?? "other",
    categoryName: category?.name ?? "Other",
    tags: row.tags ?? [],
    style: row.style,
    colorFamily: row.color_family,
    previewPath: row.preview_path,
    supportedFormats: FORMAT_IDS.filter((f) => row.supported_formats.includes(f)),
    priceAmount: row.price_amount,
    multiFormatPriceAmount: row.multi_format_price_amount,
    currency: row.currency,
    isFree: row.is_free,
    version: row.version,
    useCount: row.use_count,
    publishedAt: row.published_at,
  };
}

/* ------------------------- local fallback ------------------------- */

function starterCatalog(): CatalogTemplateWithDefinition[] {
  return STARTER_TEMPLATES.map((t, index) => {
    const definition = templateDefinitionSchema.parse(t.definition);
    const category = CATEGORIES.find((c) => c.slug === t.category)!;
    return {
      id: `starter-${t.slug}`,
      slug: t.slug,
      name: t.name,
      description: t.description,
      categorySlug: t.category,
      categoryName: category.name,
      tags: t.tags,
      style: t.style,
      colorFamily: t.colorFamily,
      previewPath: `/templates/previews/${t.slug}-${definition.defaultFormat}.webp`,
      supportedFormats: FORMAT_IDS.filter((f) => definition.formats[f]),
      priceAmount: t.priceAmount,
      multiFormatPriceAmount: t.multiFormatPriceAmount,
      currency: "INR",
      isFree: t.isFree,
      version: 1,
      useCount: 0,
      publishedAt: new Date(Date.UTC(2026, 9, 1) - index * 86400000).toISOString(),
      definition,
    };
  });
}

function useFallback(): boolean {
  if (isSupabaseConfigured()) return false;
  if (serverEnv().NODE_ENV === "production") {
    throw new Error("Supabase must be configured in production (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  return true;
}

export function isUsingDemoCatalog(): boolean {
  return !isSupabaseConfigured() && serverEnv().NODE_ENV !== "production";
}

/** Keeps search text to safe characters before it reaches a PostgREST filter. */
export function sanitizeSearch(q: string | undefined): string {
  return (q ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function matchesInMemory(t: CatalogTemplate, query: CatalogQuery, q: string): boolean {
  if (query.category && t.categorySlug !== query.category) return false;
  if (query.style && t.style !== query.style) return false;
  if (query.color && t.colorFamily !== query.color) return false;
  if (query.orientation && !t.supportedFormats.includes(query.orientation)) return false;
  if (query.price === "free" && !t.isFree) return false;
  if (query.price === "standard" && (t.isFree || t.priceAmount > PREMIUM_THRESHOLD)) return false;
  if (query.price === "premium" && (t.isFree || t.priceAmount <= PREMIUM_THRESHOLD)) return false;
  if (q) {
    const haystack = `${t.name} ${t.description} ${t.categoryName} ${t.tags.join(" ")}`.toLowerCase();
    if (!q.split(" ").every((word) => haystack.includes(word))) return false;
  }
  return true;
}

function sortInMemory(items: CatalogTemplate[], sort: SortOption): CatalogTemplate[] {
  const copy = [...items];
  if (sort === "price-asc") copy.sort((a, b) => a.priceAmount - b.priceAmount);
  else if (sort === "price-desc") copy.sort((a, b) => b.priceAmount - a.priceAmount);
  else if (sort === "popular") copy.sort((a, b) => b.useCount - a.useCount);
  else copy.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return copy;
}

/* --------------------------- public API --------------------------- */

export async function listTemplates(query: CatalogQuery = {}): Promise<CatalogPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 12));
  const sort = query.sort ?? "newest";
  const q = sanitizeSearch(query.q);

  if (useFallback()) {
    const all = starterCatalog();
    const filtered = sortInMemory(all.filter((t) => matchesInMemory(t, query, q)), sort);
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
      hasPopularityData: false,
    };
  }

  const supabase = createSupabasePublicClient();
  let builder = supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .eq("is_archived", false);
  if (query.category) builder = builder.eq("categories.slug", query.category);
  if (query.style) builder = builder.eq("style", query.style);
  if (query.color) builder = builder.eq("color_family", query.color);
  if (query.orientation) builder = builder.contains("supported_formats", [query.orientation]);
  if (query.price === "free") builder = builder.eq("is_free", true);
  if (query.price === "standard") builder = builder.eq("is_free", false).lte("price_amount", PREMIUM_THRESHOLD);
  if (query.price === "premium") builder = builder.eq("is_free", false).gt("price_amount", PREMIUM_THRESHOLD);
  if (q) {
    for (const word of q.split(" ").slice(0, 5)) {
      builder = builder.or(`name.ilike.%${word}%,description.ilike.%${word}%,tags.cs.{${word}}`);
    }
  }
  if (sort === "price-asc") builder = builder.order("price_amount", { ascending: true });
  else if (sort === "price-desc") builder = builder.order("price_amount", { ascending: false });
  else if (sort === "popular") builder = builder.order("use_count", { ascending: false });
  builder = builder.order("published_at", { ascending: false, nullsFirst: false }).order("id");

  const { data, count, error } = await builder.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(`Could not load templates: ${error.message}`);
  const items = (data as unknown as TemplateRow[]).map(mapTemplateRow);

  const { count: popularCount } = await supabase
    .from("templates")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true)
    .gt("use_count", 0);

  return { items, total: count ?? items.length, page, pageSize, hasPopularityData: (popularCount ?? 0) > 0 };
}

export async function getTemplateBySlug(slug: string): Promise<CatalogTemplateWithDefinition | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  if (useFallback()) return starterCatalog().find((t) => t.slug === slug) ?? null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("templates")
    .select(`${TEMPLATE_COLUMNS}, template_definition`)
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) throw new Error(`Could not load template: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as TemplateRow;
  const parsed = templateDefinitionSchema.safeParse(row.template_definition);
  if (!parsed.success) return null;
  return { ...mapTemplateRow(row), definition: parsed.data };
}

export async function listRelatedTemplates(template: CatalogTemplate, limit = 4): Promise<CatalogTemplate[]> {
  const sameCategory = await listTemplates({ category: template.categorySlug, pageSize: limit + 1 });
  const items = sameCategory.items.filter((t) => t.slug !== template.slug);
  if (items.length >= limit) return items.slice(0, limit);
  const others = await listTemplates({ pageSize: 12 });
  for (const t of others.items) {
    if (items.length >= limit) break;
    if (t.slug !== template.slug && !items.some((i) => i.slug === t.slug)) items.push(t);
  }
  return items;
}

export async function listCategoriesWithCounts(): Promise<Array<{ slug: CategorySlug; name: string; description: string; count: number }>> {
  const all = await listTemplates({ pageSize: 48 });
  return CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    count: all.items.filter((t) => t.categorySlug === c.slug).length,
  }));
}

export async function listAllPublishedSlugs(): Promise<string[]> {
  if (useFallback()) return starterCatalog().map((t) => t.slug);
  const supabase = createSupabasePublicClient();
  const { data } = await supabase.from("templates").select("slug").eq("is_published", true).eq("is_archived", false).limit(1000);
  return (data ?? []).map((r) => r.slug as string);
}
