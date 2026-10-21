import Link from "next/link";
import { CATEGORIES } from "@/lib/templates/categories";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { AccountLink } from "./account-link";
import { Logo } from "./logo";
import { MobileNav, OccasionsMenu } from "./nav-client";

export function SiteHeader() {
  const occasions = CATEGORIES.map((c) => ({ href: `/invitations/${c.slug}`, label: c.name }));
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/85 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-charcoal focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 text-[0.95rem] lg:flex">
          <Link href="/templates" className="rounded-full px-3.5 py-2 hover:bg-sand">
            Templates
          </Link>
          <OccasionsMenu items={occasions} />
          <Link href="/how-it-works" className="rounded-full px-3.5 py-2 hover:bg-sand">
            How it works
          </Link>
          <Link href="/pricing" className="rounded-full px-3.5 py-2 hover:bg-sand">
            Pricing
          </Link>
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <AccountLink />
          <ButtonLink href="/templates" size="sm">
            Create an Invitation
          </ButtonLink>
        </div>
        <MobileNav occasions={occasions} />
      </Container>
    </header>
  );
}
