"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export const CONSENT_KEY = "celebrio-cookie-notice-v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function readConsent(): { acknowledged: boolean; analytics: boolean } | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean) {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ acknowledged: true, analytics, at: new Date().toISOString() }));
  } catch {}
}

/**
 * Celebrio only uses strictly necessary cookies (the sign-in session) and no
 * advertising or analytics cookies, so this is an informational notice rather
 * than a consent wall. Preferences are managed on /cookies.
 */
export function CookieNotice() {
  const stored = useSyncExternalStore(subscribe, () => window.localStorage.getItem(CONSENT_KEY) !== null, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (stored || dismissed) return null;
  return (
    <div role="region" aria-label="Cookie notice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl bg-charcoal p-4 text-sm text-ivory shadow-lift sm:inset-x-6 sm:bottom-6">
      <p className="leading-relaxed text-ivory/85">
        We use only essential cookies to keep you signed in and secure your checkout. No advertising or tracking cookies.{" "}
        <Link href="/cookies" className="underline underline-offset-2">Cookie settings</Link>
      </p>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => { writeConsent(false); setDismissed(true); }}>Got it</Button>
      </div>
    </div>
  );
}
