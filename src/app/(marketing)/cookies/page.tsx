import type { Metadata } from "next";
import { CookieSettings } from "@/components/shared/cookie-settings";
import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = { title: "Cookie settings", description: "The cookies Celebrio uses and how to manage your preferences.", alternates: { canonical: "/cookies" } };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookies and consent" updated="[Date of review]">
      <p>Celebrio uses only strictly necessary cookies and browser storage. They cannot be switched off because the site would not work without them, and they are not used for advertising.</p>
      <h2>Strictly necessary</h2>
      <ul>
        <li><strong>sb-…-auth-token</strong> — keeps you signed in securely (set by Supabase Auth, HttpOnly where supported, SameSite=Lax).</li>
        <li><strong>Local storage: unsaved guest drafts</strong> — if you start an invitation before signing in, your work is kept in your own browser until you sign in, so nothing is lost.</li>
        <li><strong>Local storage: this notice</strong> — remembers that you have seen the cookie notice.</li>
      </ul>
      <h2>Optional analytics</h2>
      <p>Celebrio currently runs no analytics or marketing cookies. If privacy-friendly analytics are added in future, they will stay off unless you enable them below.</p>
      <CookieSettings />
    </LegalPage>
  );
}
