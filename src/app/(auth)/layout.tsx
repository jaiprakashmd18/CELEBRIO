import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/config/env";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center bg-[radial-gradient(50rem_24rem_at_50%_-10%,rgba(201,130,131,0.18),transparent)] px-4 py-10">
      <Logo />
      <div className="mt-10 w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-soft ring-1 ring-line sm:p-8">
        {!isSupabaseConfigured() && (
          <Alert className="mb-6" title="Accounts are not configured">
            Set the Supabase environment variables (see README, step 12) to enable sign-up and sign-in.
          </Alert>
        )}
        {children}
      </div>
    </main>
  );
}
