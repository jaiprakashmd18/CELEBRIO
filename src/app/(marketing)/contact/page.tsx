import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Contact & support",
  description: "Questions about an invitation, a payment or a download? Get in touch with Celebrio support.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const user = await getSessionUser();
  return (
    <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <SectionHeading as="h1" eyebrow="Support" title="We're here to help" description="For payment or download problems, include your order reference so we can find your purchase quickly." />
        <p className="mt-8 flex items-center gap-2 text-sm">
          <Mail aria-hidden className="size-4" /> <a className="underline underline-offset-2" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>
        </p>
        <p className="mt-3 text-sm text-gray">We never ask for your password or card details by email.</p>
      </div>
      <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-line sm:p-8">
        <ContactForm defaultEmail={user?.email ?? undefined} />
      </div>
    </Container>
  );
}
