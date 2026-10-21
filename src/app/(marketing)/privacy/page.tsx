import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Privacy policy", description: "How Celebrio collects, uses, stores and deletes your personal data.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="[Date of review]">
      <p>This policy explains how {siteConfig.legalEntity} (&quot;Celebrio&quot;, &quot;we&quot;) handles personal data when you use this website. Contact: <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>. [Add registered address and, where required, the name of your grievance or data protection officer.]</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data</strong> — your email address, an optional display name and an encrypted password, managed by our authentication provider (Supabase).</li>
        <li><strong>Invitation content</strong> — the text you type and the photos you upload to your invitations.</li>
        <li><strong>Purchase records</strong> — what you bought, the amount, the currency, the payment status and the payment provider&apos;s reference. We never receive or store full card numbers; card details are entered on the payment provider&apos;s hosted page.</li>
        <li><strong>Support messages</strong> — what you send through the contact form.</li>
        <li><strong>Technical data</strong> — limited request information (such as IP address) used for security and rate limiting.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To provide the service: saving drafts, rendering previews and generating your downloads.</li>
        <li>To process payments and keep the financial records the law requires.</li>
        <li>To prevent abuse and keep accounts secure.</li>
        <li>To answer support requests.</li>
      </ul>
      <p>We do not sell personal data and do not use advertising or cross-site tracking cookies.</p>
      <h2>Your photos</h2>
      <p>Uploaded photos are checked, re-encoded (which removes hidden metadata such as GPS location) and stored in private storage. They are never published or shown to other users. Only you can see them, and our team only accesses them when necessary to resolve a support request you raise.</p>
      <h2>How long we keep data</h2>
      <ul>
        <li>Drafts and their photos: until you delete the invitation or your account.</li>
        <li>Generated download files: stored for up to 30 days to speed up repeat downloads, then deleted. You can regenerate purchased files at any time.</li>
        <li>Order and payment records: kept for [number] years to meet tax and accounting obligations, even if you delete your account; they are disconnected from your account at deletion.</li>
        <li>Support messages: [retention period].</li>
      </ul>
      <h2>Your choices and rights</h2>
      <p>You can edit or delete any invitation, and delete your account from <em>Account → Settings</em>. Deleting your account permanently removes your profile, drafts, photos and generated files. Depending on where you live you may have further rights (access, correction, portability, objection, complaint to a regulator). [Verify and list the rights that apply in your jurisdiction, for example under India&apos;s Digital Personal Data Protection Act, 2023, or the GDPR if you serve EU customers.]</p>
      <h2>Service providers</h2>
      <p>We use Supabase (database, authentication, storage), Vercel (hosting) and our payment provider ([Stripe / Razorpay]) to run Celebrio. [List the regions where data is stored and any international transfers.]</p>
      <h2>Changes</h2>
      <p>We will post updates on this page and change the date above.</p>
    </LegalPage>
  );
}
