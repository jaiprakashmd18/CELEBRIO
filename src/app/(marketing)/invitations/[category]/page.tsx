import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery, parseGalleryQuery, type SearchParams } from "@/components/templates/gallery";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { CATEGORIES, isCategorySlug } from "@/lib/templates/categories";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  birthday: "Birthday invitation templates",
  anniversary: "Anniversary invitation templates",
  wedding: "Wedding invitations",
  engagement: "Engagement invitations",
  graduation: "Graduation invitations",
  "baby-shower": "Baby shower invitations",
  party: "Party invitations",
  other: "Invitations for other occasions",
};

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const c = CATEGORIES.find((x) => x.slug === category);
  if (!c) return {};
  return { title: PAGE_TITLES[c.slug], description: c.description, alternates: { canonical: `/invitations/${c.slug}` } };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<SearchParams> }) {
  const { category } = await params;
  if (!isCategorySlug(category)) notFound();
  const c = CATEGORIES.find((x) => x.slug === category)!;
  const query = parseGalleryQuery(await searchParams, c.slug);
  return (
    <Container className="py-12 sm:py-16">
      <nav aria-label="Occasions" className="-mx-4 mb-8 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {CATEGORIES.map((x) => (
            <li key={x.slug}>
              <Link href={`/invitations/${x.slug}`} aria-current={x.slug === c.slug ? "page" : undefined} className={cn("inline-block whitespace-nowrap rounded-full px-4 py-2 text-sm ring-1 ring-line", x.slug === c.slug ? "bg-charcoal text-ivory" : "bg-white hover:bg-sand")}>
                {x.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <SectionHeading as="h1" eyebrow={c.name} title={PAGE_TITLES[c.slug]} description={c.description} />
      <div className="mt-10">
        <Gallery basePath={`/invitations/${c.slug}`} query={query} showCategoryFilter={false} />
      </div>
    </Container>
  );
}
