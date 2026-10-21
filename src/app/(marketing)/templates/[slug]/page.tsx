import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, Image as ImageIcon, PenLine } from "lucide-react";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateShowcase } from "@/components/templates/template-showcase";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Container } from "@/components/ui/primitives";
import { siteConfig } from "@/config/site";
import { getTemplateBySlug, listAllPublishedSlugs, listRelatedTemplates } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { PACKAGE_LABELS, availablePackages } from "@/lib/pricing";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await listAllPublishedSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  if (!t) return { title: "Template not found" };
  return {
    title: `${t.name} — ${t.categoryName} invitation template`,
    description: t.description,
    alternates: { canonical: `/templates/${t.slug}` },
    openGraph: { title: `${t.name} · Celebrio`, description: t.description, images: t.previewPath ? [{ url: t.previewPath }] : undefined },
  };
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  if (!t) notFound();
  const related = await listRelatedTemplates(t);
  const packages = availablePackages({ ...t, supportedFormats: t.supportedFormats });
  const textFields = t.definition.fields.filter((f) => f.type !== "image");
  const photoFields = t.definition.fields.filter((f) => f.type === "image");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${t.name} digital invitation template`,
    description: t.description,
    image: t.previewPath ? `${siteConfig.url}${t.previewPath}` : undefined,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "Offer",
      price: (t.priceAmount / 100).toFixed(2),
      priceCurrency: t.currency,
      availability: "https://schema.org/InStock",
      url: `${siteConfig.url}/templates/${t.slug}`,
    },
  };

  return (
    <Container className="py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-gray">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/templates" className="hover:text-charcoal">Templates</Link></li>
          <li aria-hidden><ChevronRight className="size-3.5" /></li>
          <li><Link href={`/invitations/${t.categorySlug}`} className="hover:text-charcoal">{t.categoryName}</Link></li>
          <li aria-hidden><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="text-charcoal">{t.name}</li>
        </ol>
      </nav>
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <TemplateShowcase definition={t.definition} slug={t.slug} version={t.version} name={t.name} />
        <div className="lg:pt-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="rose">{t.categoryName}</Badge>
            {t.isFree ? <Badge tone="success">Free download</Badge> : <Badge>Free preview</Badge>}
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">{t.name}</h1>
          <p className="mt-4 text-lg leading-relaxed text-gray">{t.description}</p>

          <div className="mt-8 space-y-3">
            {packages.map((p) => (
              <div key={p} className="flex items-start justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-line">
                <div>
                  <p className="font-medium">{PACKAGE_LABELS[p].title}</p>
                  <p className="mt-1 text-sm text-gray">{PACKAGE_LABELS[p].description}</p>
                </div>
                <p className="shrink-0 font-serif text-xl">
                  {t.isFree ? "Free" : formatMoney(p === "single_format" ? t.priceAmount : t.multiFormatPriceAmount!, t.currency)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`/editor/new?template=${t.slug}`} size="lg" className="flex-1">
              <PenLine aria-hidden className="size-4" /> Customize this design
            </ButtonLink>
          </div>
          <p className="mt-3 text-sm text-gray">Personalise and preview for free. You&apos;ll see the final price before checkout.</p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray">You can customise</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {textFields.map((f) => (
                  <li key={f.key} className="flex items-center gap-2"><Check aria-hidden className="size-4 text-success" /> {f.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray">Details</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><ImageIcon aria-hidden className="size-4 text-gray" /> {photoFields.length} photo {photoFields.length === 1 ? "slot" : "slots"}</li>
                <li>{t.definition.palettes.length} colour palettes · {t.definition.fontSets.length} font pairings</li>
                <li>Formats: {t.supportedFormats.join(", ")}</li>
                <li>Downloads: PNG, JPEG, print-ready PDF</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-24">
          <h2 id="related-heading" className="font-serif text-3xl">You may also like</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((r) => (
              <TemplateCard key={r.id} template={r} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
