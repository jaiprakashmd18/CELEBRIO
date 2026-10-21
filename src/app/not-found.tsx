import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="flex flex-col items-center py-24 text-center sm:py-32">
          <p className="font-serif text-7xl text-rose/70">404</p>
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl">This page has slipped off the guest list</h1>
          <p className="mt-4 max-w-md text-gray">The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back to the celebrations.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/templates">Browse templates</ButtonLink>
            <ButtonLink href="/" variant="secondary">Go home</ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
