"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { createSupabaseBrowserClient, isSupabaseConfiguredInBrowser } from "@/lib/supabase/browser";

/**
 * Shows "My account" or "Sign in". Read on the client so public pages stay
 * cacheable; it only toggles a link — every protected page and API verifies
 * the session on the server.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfiguredInBrowser()) return;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

export function AccountLink({ className, size = "sm", variant = "ghost" }: { className?: string; size?: "sm" | "lg"; variant?: "ghost" | "secondary" }) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? "/dashboard" : "/sign-in"} className={buttonClasses(variant, size, className)}>
      {signedIn ? "My account" : "Sign in"}
    </Link>
  );
}
