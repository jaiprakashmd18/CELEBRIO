import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Terms of service", description: "The terms that apply when you use Celebrio.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="[Date of review]">
      <p>These terms form an agreement between you and {siteConfig.legalEntity} [registered address, registration number if applicable]. By creating an account or purchasing an invitation you agree to them.</p>
      <h2>The service</h2>
      <p>Celebrio lets you personalise digital invitation templates and, after payment where required, download the finished files. Previews are free and watermarked.</p>
      <h2>Accounts</h2>
      <p>You must provide a valid email address and keep your password secure. You are responsible for activity on your account.</p>
      <h2>Purchases</h2>
      <ul>
        <li>Prices are shown before checkout in the stated currency. Payment is taken by our payment provider on its hosted page.</li>
        <li>A purchase unlocks the specific invitation and the formats included in the package you chose. Your access is granted when the payment provider confirms payment.</li>
        <li>You may make reasonable corrections to a purchased invitation (for example names, dates, venue or photos) and download it again. Re-using one purchase for a substantially different invitation or event is not included.</li>
        <li>Refunds are handled under our <a href="/refund-policy">refund and cancellation policy</a>.</li>
      </ul>
      <h2>Your content</h2>
      <p>You keep ownership of the text and photos you upload. You confirm you have the right to use them and give us a limited licence to store and process them solely to provide the service. Please follow our <a href="/acceptable-use">acceptable use policy</a>.</p>
      <h2>Our designs</h2>
      <p>Templates, illustrations and software are owned by Celebrio or its licensors. A purchase grants you a personal, non-transferable licence to use the generated invitation for your event, including sharing it digitally and printing it. You may not resell templates or extract the artwork for other uses.</p>
      <h2>Availability and liability</h2>
      <p>We work to keep Celebrio available and accurate but cannot guarantee uninterrupted service. To the extent permitted by law, our liability is limited to the amount you paid for the affected purchase. Nothing in these terms limits rights you have under consumer protection law.</p>
      <h2>Governing law</h2>
      <p>[State the governing law and courts for your business.]</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a></p>
    </LegalPage>
  );
}
