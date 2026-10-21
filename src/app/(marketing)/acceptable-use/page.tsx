import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Copyright and acceptable use", description: "What you may upload to Celebrio and how to report copyright concerns.", alternates: { canonical: "/acceptable-use" } };

export default function AcceptableUsePage() {
  return (
    <LegalPage title="Copyright and acceptable use" updated="[Date of review]">
      <h2>Upload only what you have the right to use</h2>
      <p>Only upload photos you took, photos of you that you are allowed to use, or images you are licensed to use. Do not upload other people&apos;s copyrighted work without permission.</p>
      <h2>Not allowed</h2>
      <ul>
        <li>Unlawful, hateful, harassing, violent or sexually explicit content, or content involving minors in any harmful way.</li>
        <li>Content that impersonates someone or is designed to deceive (for example fake official notices).</li>
        <li>Attempts to bypass payment, access other customers&apos; data, overload the service or scrape templates.</li>
      </ul>
      <h2>Our artwork</h2>
      <p>All Celebrio templates and illustrations are original works. Fonts are used under the SIL Open Font License. Please don&apos;t copy or redistribute the templates themselves.</p>
      <h2>Reporting concerns</h2>
      <p>To report content or a copyright concern, email <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> with a description and the relevant details. [Add a designated contact if required by law in your jurisdiction.]</p>
    </LegalPage>
  );
}
