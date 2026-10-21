import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Refund and cancellation policy", description: "How refunds, failed payments and cancellations work at Celebrio.", alternates: { canonical: "/refund-policy" } };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund and cancellation policy" updated="[Date of review]">
      <p>Because every invitation can be previewed in full before purchase and files are delivered digitally the moment payment is confirmed, purchases are generally final. We will always help when something has gone wrong.</p>
      <h2>When we refund</h2>
      <ul>
        <li>You were charged more than once for the same invitation.</li>
        <li>You were charged but could not download your files and we could not fix the problem.</li>
        <li>The downloaded file is faulty (for example blank, corrupted or materially different from the preview) and we cannot correct it.</li>
        <li>Any other case where consumer law in your country gives you a right to a refund.</li>
      </ul>
      <p>Requests should be made within {siteConfig.refundWindowDays} days of purchase through the <a href="/contact">contact page</a> with your order reference. Approved refunds are returned to the original payment method; your bank may take [5–10] working days to show it.</p>
      <h2>What happens after a refund</h2>
      <p>A refunded purchase no longer unlocks clean downloads for that invitation. Your draft remains in your account.</p>
      <h2>Failed, cancelled and abandoned payments</h2>
      <p>If you leave the checkout page or a payment fails, you are not charged and the order is marked as cancelled, failed or expired. You can try again at any time. If money left your account for a payment that shows as failed, contact us — the provider normally reverses such holds automatically.</p>
      <h2>Disputes</h2>
      <p>If you dispute a charge with your bank, access to the invitation may be paused until the dispute is resolved. Please contact us first; we can usually resolve problems faster.</p>
    </LegalPage>
  );
}
