import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { COLOR_OPTIONS, PRICE_FILTERS, SORT_OPTIONS, STYLE_OPTIONS, listTemplates, type CatalogQuery, type PriceFilter, type SortOption } from "@/lib/data/catalog";
import { CATEGORIES } from "@/lib/templates/categories";
import { FORMAT_IDS, type FormatId } from "@/lib/templates/schema";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { GalleryFilters } from "./gallery-filters";
import { TemplateCard } from "./template-card";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Parses untrusted query-string values into a safe catalogue query. */
export function parseGalleryQuery(sp: SearchParams, fixedCategory?: string): CatalogQuery {
  const page = Number.parseInt(one(sp.page) ?? "1", 10);
  return {
    q: one(sp.q)?.slice(0, 60),
    category: fixedCategory ?? pick(one(sp.category), CATEGORIES.map((c) => c.slug)),
    style: pick(one(sp.style), STYLE_OPTIONS),
    color: pick(one(sp.color), COLOR_OPTIONS),
    orientation: pick<FormatId>(one(sp.orientation), FORMAT_IDS),
    price: pick<PriceFilter>(one(sp.price), PRICE_FILTERS),
    sort: pick<SortOption>(one(sp.sort), SORT_OPTIONS),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
    pageSize: 12,
  };
}

export async function Gallery({ basePath, query, showCategoryFilter }: { basePath: string; query: CatalogQuery; showCategoryFilter: boolean }) {
  const result = await listTemplates(query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const sorts = [
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    ...(result.hasPopularityData ? [{ value: "popular", label: "Most used" }] : []),
  ];
  const values: Record<string, string | undefined> = {
    q: query.q,
    category: showCategoryFilter ? query.category : undefined,
    style: query.style,
    color: query.color,
    orientation: query.orientation,
    price: query.price,
    sort: query.sort && query.sort !== "newest" ? query.sort : undefined,
  };
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v) params.set(k, v);
    if (page > 1) params.set("page", String(page));
    return `${basePath}${params.size ? `?${params}` : ""}`;
  };
  const filtersActive = Object.values(values).some(Boolean);

  return (
    <div className="space-y-8">
      <GalleryFilters
        action={basePath}
        values={values}
        categories={showCategoryFilter ? CATEGORIES.map((c) => ({ value: c.slug, label: c.name })) : undefined}
        styles={STYLE_OPTIONS.map((s) => ({ value: s, label: cap(s) }))}
        colors={COLOR_OPTIONS.map((s) => ({ value: s, label: cap(s) }))}
        sorts={sorts}
      />
      <p className="text-sm text-gray" aria-live="polite">
        {result.total} {result.total === 1 ? "design" : "designs"}
        {filtersActive && (
          <>
            {" · "}
            <Link href={basePath} className="underline underline-offset-2">Clear filters</Link>
          </>
        )}
      </p>
      {result.items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title="No designs match those filters"
          description="Try a different keyword or remove a filter. New designs are added regularly."
          action={<ButtonLink href={basePath} variant="secondary">Show all designs</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {result.items.map((t, i) => (
            <TemplateCard key={t.id} template={t} priority={i < 4} />
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-4">
          {result.page > 1 && (
            <Link href={pageHref(result.page - 1)} className="inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm hover:bg-sand" rel="prev">
              <ChevronLeft aria-hidden className="size-4" /> Previous
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={pageHref(p)} aria-current={p === result.page ? "page" : undefined} className={cn("inline-flex size-10 items-center justify-center rounded-full text-sm", p === result.page ? "bg-charcoal text-ivory" : "hover:bg-sand")}>
              {p}
            </Link>
          ))}
          {result.page < totalPages && (
            <Link href={pageHref(result.page + 1)} className="inline-flex h-10 items-center gap-1 rounded-full px-4 text-sm hover:bg-sand" rel="next">
              Next <ChevronRight aria-hidden className="size-4" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
