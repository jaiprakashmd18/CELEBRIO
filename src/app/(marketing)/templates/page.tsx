import type { Metadata } from "next";
import { Gallery, parseGalleryQuery, type SearchParams } from "@/components/templates/gallery";
import { Container, SectionHeading } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Invitation templates",
  description: "Browse original, fully customisable invitation templates for birthdays, weddings, anniversaries, engagements, graduations, baby showers and parties.",
  alternates: { canonical: "/templates" },
};

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = parseGalleryQuery(await searchParams);
  return (
    <Container className="py-12 sm:py-16">
      <SectionHeading as="h1" eyebrow="Template gallery" title="Find your invitation" description="Every design can be personalised for free. Pay only when you unlock the final files." />
      <div className="mt-10">
        <Gallery basePath="/templates" query={query} showCategoryFilter />
      </div>
    </Container>
  );
}
