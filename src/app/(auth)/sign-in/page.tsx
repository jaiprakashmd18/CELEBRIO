import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/forms/auth-forms";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getSessionUser()) redirect(next);
  return (
    <>
      <h1 className="font-serif text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-gray">Sign in to save drafts, unlock invitations and download your files.</p>
      {sp.error === "link" && <p role="alert" className="mt-4 text-sm text-danger">That link is invalid or has expired. Please sign in or request a new link.</p>}
      <div className="mt-6"><SignInForm next={next} /></div>
      <p className="mt-6 text-center text-sm text-gray">
        New to Celebrio? <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="font-medium text-charcoal underline underline-offset-2">Create an account</Link>
      </p>
    </>
  );
}
