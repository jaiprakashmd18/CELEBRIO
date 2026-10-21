import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/forms/auth-forms";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getSessionUser()) redirect(next);
  return (
    <>
      <h1 className="font-serif text-3xl">Create your account</h1>
      <p className="mt-2 text-sm text-gray">Free to join. Save your designs and pay only when you unlock an invitation.</p>
      <div className="mt-6"><SignUpForm next={next} /></div>
      <p className="mt-6 text-center text-sm text-gray">
        Already have an account? <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-medium text-charcoal underline underline-offset-2">Sign in</Link>
      </p>
    </>
  );
}
