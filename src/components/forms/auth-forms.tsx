"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";
import { createSupabaseBrowserClient, isSupabaseConfiguredInBrowser } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/security/redirect";

const email = z.string().trim().email("Enter a valid email address").max(200);
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Please try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the verification link.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
  if (/already registered/i.test(message)) return "An account with this email already exists. Try signing in instead.";
  return message;
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ email, password: z.string().min(1, "Enter your password") });
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const e = formState.errors;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        if (!isSupabaseConfiguredInBrowser()) return setError("Accounts are not configured in this environment.");
        const { error: err } = await createSupabaseBrowserClient().auth.signInWithPassword(values);
        if (err) return setError(friendly(err.message));
        router.replace(safeNextPath(next));
        router.refresh();
      })}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <Field id="email" label="Email" error={e.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(e.email)} {...register("email")} />
      </Field>
      <Field id="password" label="Password" error={e.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(e.password)} {...register("password")} />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="underline underline-offset-2">Forgot password?</Link>
      </div>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const schema = z
    .object({ displayName: z.string().trim().max(80).optional(), email, password, confirm: z.string(), terms: z.literal(true, { error: "Please accept the terms to continue" }) })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
  const { register, handleSubmit, formState } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });
  const e = formState.errors;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        if (!isSupabaseConfiguredInBrowser()) return setError("Accounts are not configured in this environment.");
        const nextPath = safeNextPath(next);
        const { data, error: err } = await createSupabaseBrowserClient().auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { display_name: values.displayName || undefined },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (err) return setError(friendly(err.message));
        if (data.session) {
          router.replace(nextPath);
          router.refresh();
        } else {
          router.replace(`/check-email?email=${encodeURIComponent(values.email)}`);
        }
      })}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <Field id="displayName" label={<>Your name <span className="font-normal text-gray">(optional)</span></>} error={e.displayName?.message}>
        <Input id="displayName" autoComplete="name" {...register("displayName")} />
      </Field>
      <Field id="email" label="Email" error={e.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(e.email)} {...register("email")} />
      </Field>
      <Field id="password" label="Password" hint="At least 8 characters." error={e.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(e.password)} {...register("password")} />
      </Field>
      <Field id="confirm" label="Confirm password" error={e.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={Boolean(e.confirm)} {...register("confirm")} />
      </Field>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-charcoal" {...register("terms")} />
          <span>I agree to the <Link href="/terms" className="underline">terms of service</Link> and have read the <Link href="/privacy" className="underline">privacy policy</Link>.</span>
        </label>
        {e.terms && <p className="mt-1 text-xs font-medium text-danger">{e.terms.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Creating account…" : "Create account"}</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ email });
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (sent) return <Alert tone="success" title="Check your email">If an account exists for that address, we&apos;ve sent a link to reset your password. The link expires after a short time.</Alert>;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async ({ email: address }) => {
        setError(null);
        if (!isSupabaseConfiguredInBrowser()) return setError("Accounts are not configured in this environment.");
        const { error: err } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
        });
        // Always show the same message so the form can't be used to discover accounts.
        if (err && /rate limit/i.test(err.message)) return setError(friendly(err.message));
        setSent(true);
      })}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <Field id="email" label="Email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const schema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async ({ password: pw }) => {
        setError(null);
        const { error: err } = await createSupabaseBrowserClient().auth.updateUser({ password: pw });
        if (err) return setError(/session/i.test(err.message) ? "Your reset link has expired. Please request a new one." : friendly(err.message));
        router.replace("/dashboard?notice=password-updated");
        router.refresh();
      })}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <Field id="password" label="New password" hint="At least 8 characters." error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Field id="confirm" label="Confirm new password" error={formState.errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
      </Field>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>Update password</Button>
    </form>
  );
}
