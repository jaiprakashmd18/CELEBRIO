import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Checkout cancelled" };

export default function CheckoutCancelledPage() {
  return (
    <Container className="max-w-xl py-20 text-center">
      <h1 className="font-serif text-4xl">Checkout cancelled</h1>
      <p className="mt-3 text-gray">No payment was taken. Your invitation is saved as a draft, so you can come back and unlock it whenever you&apos;re ready.</p>
      <Link href="/dashboard/drafts" className={buttonClasses("primary", "lg", "mt-8")}>Back to my drafts</Link>
    </Container>
  );
}
