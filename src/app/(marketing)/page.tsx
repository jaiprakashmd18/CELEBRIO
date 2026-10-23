import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Cake,
  Download,
  Eye,
  Gem,
  GraduationCap,
  Heart,
  LayoutTemplate,
  Palette,
  PartyPopper,
  PenLine,
  Sparkles,
  Wand2,
  Wallet,
  MailOpen,
} from "lucide-react";
import { HeroPreview } from "@/components/templates/hero-preview";
import { TemplateCard } from "@/components/templates/template-card";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { FAQ_ITEMS } from "@/content/faq";
import { getTemplateBySlug, listTemplates } from "@/lib/data/catalog";
import { CATEGORIES } from "@/lib/templates/categories";

export const revalidate = 300;

const OCCASION_STYLE: Record<string, { icon: typeof Cake; tint: string }> = {
  birthday: { icon: Cake, tint: "from-[#FBE1CF] to-[#FFF4EC]" },
  anniversary: { icon: Heart, tint: "from-[#F3DADA] to-[#FBF1EE]" },
  wedding: { icon: Sparkles, tint: "from-[#EEF0E6] to-[#FBF8F1]" },
  engagement: { icon: Gem, tint: "from-[#F3E6E2] to-[#FFF8F6]" },
  graduation: { icon: GraduationCap, tint: "from-[#DDE3EE] to-[#F4F1EA]" },
  "baby-shower": { icon: Baby, tint: "from-[#FCE9E6] to-[#EEF5FA]" },
  party: { icon: PartyPopper, tint: "from-[#FFE9B8] to-[#FFF5DC]" },
  other: { icon: MailOpen, tint: "from-[#ECE6DA] to-[#F7F4EE]" },
};

const HERO_CANDIDATES: Array<{ slug: string; fields: [string, string] }> = [
  { slug: "modern-elegance", fields: ["name_one", "name_two"] },
  { slug: "ivory-botanicals", fields: ["name_one", "name_two"] },
  { slug: "our-story", fields: ["name_one", "name_two"] },
];

export default async function HomePage() {
  const featured = await listTemplates({ pageSize: 8 });
  let hero = null;
  for (const candidate of HERO_CANDIDATES) {
    const t = await getTemplateBySlug(candidate.slug);
    if (t) {
      hero = { template: t, fields: candidate.fields };
      break;
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(201,130,131,0.16),transparent),radial-gradient(40rem_24rem_at_0%_20%,rgba(184,154,98,0.14),transparent)]" />
        <Container className="relative grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray ring-1 ring-line">
              <Sparkles aria-hidden className="size-3.5 text-gold" /> Digital invitations for every celebration
            </p>
            <h1 className="font-serif text-[2.6rem] leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-[4.2rem]">
              Your Moments Deserve Something Beautiful.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray">
              Create stunning personalized invitations in minutes. Choose a design, add your photos and words, and make it yours.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/templates" size="lg">
                Explore Templates <ArrowRight aria-hidden className="size-4" />
              </ButtonLink>
              <ButtonLink href={hero ? `/editor/new?template=${hero.template.slug}` : "/templates"} size="lg" variant="secondary">
                Create Your Invitation
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray">
              <li className="flex items-center gap-2"><Eye aria-hidden className="size-4" /> Free preview</li>
              <li className="flex items-center gap-2"><Wallet aria-hidden className="size-4" /> No subscription</li>
              <li className="flex items-center gap-2"><Download aria-hidden className="size-4" /> PNG, JPEG &amp; PDF</li>
            </ul>
          </div>
          {hero && (
            <HeroPreview
              definition={hero.template.definition}
              slug={hero.template.slug}
              version={hero.template.version}
              nameFields={hero.fields}
              templateName={hero.template.name}
            />
          )}
        </Container>
      </section>

      {/* Occasions */}
      <section aria-labelledby="occasions-heading" className="py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Occasions" title={<span id="occasions-heading">What are you celebrating?</span>} description="Every design is original, fully editable and ready for your details." />
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {CATEGORIES.map((c) => {
              const style = OCCASION_STYLE[c.slug]!;
              const Icon = style.icon;
              return (
                <li key={c.slug}>
                  <Link href={`/invitations/${c.slug}`} className={`group flex h-full flex-col justify-between rounded-[var(--radius-card)] bg-gradient-to-br ${style.tint} p-5 text-[#20201F] ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-soft sm:p-6`}>
                    <Icon aria-hidden className="size-6 opacity-80" />
                    <span className="mt-8 flex items-center justify-between font-serif text-lg sm:text-xl">
                      {c.name}
                      <ArrowRight aria-hidden className="size-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Featured templates */}
      <section aria-labelledby="featured-heading" className="py-16 sm:py-20">
        <Container>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="Featured designs" title={<span id="featured-heading">Fresh from the studio</span>} description="Real templates you can open, personalise and preview right now." />
            <ButtonLink href="/templates" variant="secondary">
              View all templates <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {featured.items.map((t, i) => (
              <TemplateCard key={t.id} template={t} priority={i < 2} />
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="bg-white py-16 sm:py-24">
        <Container>
          <SectionHeading align="center" eyebrow="How it works" title={<span id="how-heading">Four steps to a beautiful invitation</span>} />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: LayoutTemplate, title: "Choose a design", body: "Browse original templates for every occasion and pick the one that feels like you." },
              { icon: PenLine, title: "Personalize it", body: "Add names, dates, venue and photos. The layout adapts as you type." },
              { icon: Eye, title: "Preview it", body: "See exactly how your invitation will look before you spend anything." },
              { icon: Download, title: "Unlock and download", body: "Pay once to download high-resolution PNG, JPEG and print-ready PDF files." },
            ].map((step, i) => (
              <li key={step.title} className="relative rounded-[var(--radius-card)] bg-ivory p-6 ring-1 ring-line">
                <span className="font-serif text-4xl text-rose/70">0{i + 1}</span>
                <step.icon aria-hidden className="mt-4 size-6" />
                <h3 className="mt-3 font-serif text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why Celebrio */}
      <section aria-labelledby="why-heading" className="py-16 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading eyebrow="Why Celebrio" title={<span id="why-heading">Designed to feel special. Built to be simple.</span>} description="Celebrio pairs editorial-quality design with an editor anyone can use — on a phone, a tablet or a laptop." />
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Wand2, title: "No design experience needed", body: "Thoughtful layouts handle spacing, alignment and typography for you." },
              { icon: Sparkles, title: "Instant personalization", body: "Every change updates the preview immediately — no waiting, no guesswork." },
              { icon: Palette, title: "Beautiful designs", body: "Original artwork, curated colour palettes and elegant font pairings." },
              { icon: Download, title: "High-quality downloads", body: "Crisp 1080p images and 300 DPI print-ready PDFs." },
              { icon: Wallet, title: "Pay only for what you unlock", body: "No subscription. Preview free, pay once per invitation." },
            ].map((item) => (
              <li key={item.title} className="rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-line">
                <item.icon aria-hidden className="size-5 text-rose-dark" />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray">{item.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Discovery CTA */}
      <section className="py-8">
        <Container>
          <div className="relative overflow-hidden rounded-[2rem] bg-charcoal px-6 py-14 text-center text-ivory sm:px-12 sm:py-20">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_120%,rgba(201,130,131,0.35),transparent)]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Discover</p>
              <h2 className="mx-auto mt-4 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">Find the design that feels like your celebration.</h2>
              <p className="mx-auto mt-5 max-w-xl text-ivory/70">Search by occasion, style, colour or orientation — then make it yours in minutes.</p>
              <form action="/templates" className="mx-auto mt-8 flex max-w-lg flex-col gap-2 sm:flex-row" role="search">
                <label htmlFor="home-search" className="sr-only">Search templates</label>
                <input id="home-search" name="q" placeholder="Try “floral”, “gold” or “brunch”" className="h-12 flex-1 rounded-full border-0 bg-white/10 px-5 text-ivory ring-1 ring-white/20 placeholder:text-ivory/50 focus:outline-none focus:ring-white/50" />
                <button type="submit" className="h-12 rounded-full bg-ivory px-6 font-medium text-charcoal hover:bg-white">
                  Search
                </button>
              </form>
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="FAQ" title={<span id="faq-heading">Good questions</span>} />
            <Link href="/faq" className="mt-6 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
              See all questions <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-line rounded-[var(--radius-card)] bg-white ring-1 ring-line">
            {FAQ_ITEMS.filter((f) => f.home).map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span aria-hidden className="text-xl text-gray transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
