import type { Metadata } from "next";
import { Download, Eye, LayoutTemplate, PenLine, Wand2, Move } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "How it works",
  description: "Choose a design, personalise it with your words and photos, preview it free, then unlock high-quality downloads.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  { icon: LayoutTemplate, title: "1. Choose a design", body: "Browse the gallery by occasion, style, colour or orientation. Open any template to see it in every format and palette." },
  { icon: PenLine, title: "2. Personalise it", body: "The simple editor shows only the fields that design needs — names, date, time, venue, RSVP and a message. Upload photos, then drag to reposition and zoom to crop." },
  { icon: Move, title: "Want more control?", body: "Switch to the advanced editor to move, resize, rotate and restyle text and photos, reorder layers, add your own text, undo and redo. Both editors share the same project, so nothing is lost when you switch." },
  { icon: Eye, title: "3. Preview it", body: "See the real rendered invitation, exactly as it will be exported, before paying. Drafts save automatically to your account." },
  { icon: Download, title: "4. Unlock and download", body: "Pay once on our provider's secure checkout. As soon as payment is confirmed you can download PNG, JPEG and print-ready PDF files, and re-download them any time." },
  { icon: Wand2, title: "Share it your way", body: "Send the image on WhatsApp, post it to social media, email it or print it. The files are yours." },
];

export default function HowItWorksPage() {
  return (
    <Container className="py-12 sm:py-16">
      <SectionHeading as="h1" eyebrow="How it works" title="From blank page to beautiful invitation" description="Celebrio is designed for phones first, so you can create an invitation wherever you are." />
      <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.title} className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-line">
            <s.icon aria-hidden className="size-6 text-rose-dark" />
            <h2 className="mt-4 font-serif text-xl">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray">{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-12">
        <ButtonLink href="/templates" size="lg">Start with a template</ButtonLink>
      </div>
    </Container>
  );
}
