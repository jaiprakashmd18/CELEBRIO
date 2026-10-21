"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const CONSENT_KEY = "celebrio-cookie-notice-v1";

/**
 * Celebrio only uses strictly necessary cookies (the sign-in session) and no
 * advertising or analytics cookies, so this is an informational notice rather
 * than a consent wall. Preferences are managed on /cookies.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(!window.localStorage.getItem(CONSENT_KEY));
    } catch {
      setVisible(false);
    }
  }, []);
  if (!visible) return null;
  return (
    <div role="region" aria-label="Cookie notice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl bg-charcoal p-4 text-sm text-ivory shadow-lift sm:inset-x-6 sm:bottom-6">
      <p className="leading-relaxed text-ivory/85">
        We use only essential cookies to keep you signed in and secure your checkout. No advertising or tracking cookies.{" "}
        <Link href="/cookies" className="underline underline-offset-2">
          Cookie settings
        </Link>
      </p>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            try {
              window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ acknowledged: true, analytics: false, at: new Date().toISOString() }));
            } catch {}
            setVisible(false);
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
