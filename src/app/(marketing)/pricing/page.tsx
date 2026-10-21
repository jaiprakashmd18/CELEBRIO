import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, SectionHeading } from "@/components/ui/primitives";
import { listTemplates } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Pricing",
  description: "Pay once per invitation. Preview every design free, then unlock high-resolution PNG, JPEG and print-ready PDF downloads. No subscription.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const { items } = await listTemplates({ pageSize: 48 });
  const paid = items.filter((t) => !t.isFree);
  const currency = items[0]?.currency ?? "INR";
  const prices = [...new Set(paid.map((t) => t.priceAmount))].sort((a, b) => a - b);
  const multi = [...new Set(paid.map((t) => t.multiFormatPriceAmount).filter((p): p is number => p !== null))].sort((a, b) => a - b);
  const standard = prices[0];
  const premium = prices.length > 1 ? prices[prices.length - 1] : undefined;
  const tiers = [
    { name: "Free preview", price: formatMoney(0, currency), body: "Personalise any design and see the full watermarked preview.", points: ["Every template", "Photos, text, colours & fonts", "Save drafts to your account"] },
    standard !== undefined && { name: "Standard invitation", price: formatMoney(standard, currency), body: "Unlock one invitation in the format you designed.", points: ["High-resolution PNG & JPEG", "Print-ready 300 DPI PDF", "No watermark", "Re-download any time"] },
    premium !== undefined && { name: "Premium invitation", price: formatMoney(premium, currency), body: "Our most detailed designs, one format.", points: ["Everything in Standard", "Premium illustrated designs"], highlight: true },
    multi.length > 0 && { name: "Multi-format package", price: `${multi.length > 1 ? "From " : ""}${formatMoney(multi[0]!, currency)}`, body: "Every format the design supports — portrait, square and landscape.", points: ["All supported formats", "PNG, JPEG & PDF for each", "Perfect for WhatsApp, Instagram and print"] },
  ].filter(Boolean) as Array<{ name: string; price: string; body: string; points: string[]; highlight?: boolean }>;

  return (
    <Container className="py-12 sm:py-16">
      <SectionHeading as="h1" align="center" eyebrow="Pricing" title="Pay only for the invitations you unlock" description="No subscription and no hidden fees. Each template shows its exact price, and you always see the final amount before checkout." />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <Card key={tier.name} className={tier.highlight ? "p-6 ring-2 ring-charcoal" : "p-6"}>
            <h2 className="font-medium">{tier.name}</h2>
            <p className="mt-3 font-serif text-4xl">{tier.price}</p>
            <p className="mt-3 text-sm text-gray">{tier.body}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {tier.points.map((p) => (
                <li key={p} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> {p}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <div className="mx-auto mt-14 max-w-3xl space-y-4 text-sm leading-relaxed text-gray">
        <h2 className="font-serif text-2xl text-charcoal">Payment information</h2>
        <p>Prices are charged in Indian Rupees (INR) as shown. We never convert currencies automatically; your bank may apply its own conversion if your card is in another currency.</p>
        <p>Payments are processed on our payment provider&apos;s secure hosted checkout page. Celebrio never sees or stores your card details. Your invitation unlocks as soon as the provider confirms the payment, usually within seconds.</p>
        <p>One purchase unlocks one invitation. Fixing details later (a typo, a new time, a different photo) is included. Applicable taxes are shown at checkout where required.</p>
        <p>See our <a className="underline" href="/refund-policy">refund and cancellation policy</a> for how failed or disputed payments are handled.</p>
      </div>
      <div className="mt-10 text-center">
        <ButtonLink href="/templates" size="lg">Browse templates</ButtonLink>
      </div>
    </Container>
  );
}
