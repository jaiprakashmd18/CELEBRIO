import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="text-center">
      <MailCheck aria-hidden className="mx-auto size-10 text-rose-dark" />
      <h1 className="mt-4 font-serif text-3xl">Verify your email</h1>
      <p className="mt-3 text-sm text-gray">
        We sent a verification link to {email ? <strong className="text-charcoal">{email}</strong> : "your email address"}. Open it on this device to finish creating your account. Your invitation draft is safe in this browser in the meantime.
      </p>
      <p className="mt-6 text-sm text-gray">Didn&apos;t get it? Check your spam folder, or <Link href="/sign-up" className="underline">try again</Link>.</p>
    </div>
  );
}
