import Link from "next/link";
import { siteConfig } from "@/config/site";
import { CATEGORIES } from "@/lib/templates/categories";
import { Container } from "@/components/ui/primitives";
import { Logo } from "./logo";

export function SiteFooter() {
  const columns = [
    { title: "Occasions", links: CATEGORIES.map((c) => ({ href: `/invitations/${c.slug}`, label: c.name })) },
    {
      title: "Celebrio",
      links: [
        { href: "/templates", label: "All templates" },
        { href: "/how-it-works", label: "How it works" },
        { href: "/pricing", label: "Pricing" },
        { href: "/faq", label: "FAQ" },
        { href: "/contact", label: "Contact & support" },
      ],
    },
    {
      title: "Policies",
      links: [
        { href: "/terms", label: "Terms of service" },
        { href: "/privacy", label: "Privacy policy" },
        { href: "/refund-policy", label: "Refunds & cancellations" },
        { href: "/acceptable-use", label: "Copyright & acceptable use" },
        { href: "/cookies", label: "Cookie settings" },
      ],
    },
  ];
  return (
    <footer className="mt-24 bg-charcoal text-ivory">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <div className="[&_span]:text-ivory [&_svg_circle]:fill-ivory/10">
            <Logo />
          </div>
          <p className="font-serif text-2xl text-ivory/90">{siteConfig.tagline}</p>
          <p className="max-w-xs text-sm leading-relaxed text-ivory/60">
            Personalised digital invitations for life&apos;s celebrations. Design in minutes, pay only for the invitations you unlock.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ivory/50">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-ivory/80 hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-ivory/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {siteConfig.legalEntity}. All invitation designs are original Celebrio artwork.</p>
          <p>Fonts licensed under the SIL Open Font License.</p>
        </Container>
      </div>
    </footer>
  );
}
