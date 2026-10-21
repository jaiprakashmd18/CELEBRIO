import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { FAQ_ITEMS } from "@/content/faq";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about personalising, paying for and downloading Celebrio invitations.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SectionHeading as="h1" eyebrow="Help" title="Frequently asked questions" />
      <div className="mt-10 divide-y divide-line rounded-[var(--radius-card)] bg-white ring-1 ring-line">
        {FAQ_ITEMS.map((f) => (
          <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              <h2 className="text-base">{f.q}</h2>
              <span aria-hidden className="text-xl text-gray transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-gray">{f.a}</p>
          </details>
        ))}
      </div>
    </Container>
  );
}
