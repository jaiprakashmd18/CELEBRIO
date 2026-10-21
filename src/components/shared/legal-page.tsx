import type { ReactNode } from "react";
import { Alert, Container } from "@/components/ui/primitives";

export function LegalPage({ title, updated, children, draftNotice = true }: { title: string; updated: string; children: ReactNode; draftNotice?: boolean }) {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <h1 className="font-serif text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-gray">Last updated: {updated}</p>
      {draftNotice && (
        <Alert className="mt-8" title="Template for the business owner to review">
          This page is an editable starting point, not legal advice, and has not been reviewed by a lawyer. Replace the bracketed placeholders and have it checked for your jurisdiction before launch.
        </Alert>
      )}
      <div className="prose-celebrio mt-8">{children}</div>
    </Container>
  );
}
