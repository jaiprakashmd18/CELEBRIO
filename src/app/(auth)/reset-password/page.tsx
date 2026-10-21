import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in with a short-lived session first.
  await requireUser("/reset-password");
  return (
    <>
      <h1 className="font-serif text-3xl">Choose a new password</h1>
      <div className="mt-6"><ResetPasswordForm /></div>
    </>
  );
}
