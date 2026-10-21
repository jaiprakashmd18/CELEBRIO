import Image from "next/image";
import Link from "next/link";
import type { CatalogTemplate } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/primitives";

export function priceLabel(t: Pick<CatalogTemplate, "isFree" | "priceAmount" | "currency">): string {
  return t.isFree ? "Free download" : `From ${formatMoney(t.priceAmount, t.currency)}`;
}

export function TemplateCard({ template, priority = false }: { template: CatalogTemplate; priority?: boolean }) {
  const isLandscapeOnly = template.supportedFormats.length === 1 && template.supportedFormats[0] === "landscape";
  return (
    <article className="group relative">
      <Link href={`/templates/${template.slug}`} className="block rounded-[var(--radius-card)] focus-visible:outline-offset-4">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-sand ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift">
          <div className={isLandscapeOnly ? "relative aspect-[16/9]" : "relative aspect-[9/16]"}>
            {template.previewPath ? (
              <Image
                src={template.previewPath}
                alt={`${template.name} invitation template preview`}
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
                className="object-cover"
                priority={priority}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray">Preview coming soon</div>
            )}
          </div>
          <div className="absolute left-3 top-3 flex gap-1.5">
            {template.isFree ? <Badge tone="success">Free</Badge> : <Badge className="bg-white/90 backdrop-blur">Free preview</Badge>}
          </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
          <div>
            <h3 className="font-serif text-lg leading-snug">{template.name}</h3>
            <p className="text-sm text-gray">{template.categoryName}</p>
          </div>
          <p className="shrink-0 pt-1 text-sm font-medium">{priceLabel(template)}</p>
        </div>
      </Link>
    </article>
  );
}
