import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Forgot your password?</h1>
      <p className="mt-2 text-sm text-gray">Enter your email and we&apos;ll send you a secure link to choose a new one.</p>
      <div className="mt-6"><ForgotPasswordForm /></div>
      <p className="mt-6 text-center text-sm"><Link href="/sign-in" className="underline">Back to sign in</Link></p>
    </>
  );
}
