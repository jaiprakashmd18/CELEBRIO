"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";

export function ContactForm({ defaultEmail }: { defaultEmail?: string }) {
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: defaultEmail ?? "", subject: "", message: "", orderReference: "", website: "" },
  });
  const e = formState.errors;

  async function onSubmit(values: ContactInput) {
    setStatus(null);
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus({ tone: "error", text: data?.error?.message ?? "Something went wrong. Please try again." });
      return;
    }
    reset({ ...values, subject: "", message: "", orderReference: "" });
    setStatus({ tone: "success", text: "Thanks — your message has been received. We usually reply within two working days." });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Your name" error={e.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={Boolean(e.name)} {...register("name")} />
        </Field>
        <Field id="email" label="Email" error={e.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(e.email)} {...register("email")} />
        </Field>
      </div>
      <Field id="subject" label="Subject" error={e.subject?.message}>
        <Input id="subject" aria-invalid={Boolean(e.subject)} {...register("subject")} />
      </Field>
      <Field id="orderReference" label="Order reference (optional)" hint="Found in your purchase history, e.g. 3f2a9c1e-…" error={e.orderReference?.message}>
        <Input id="orderReference" aria-invalid={Boolean(e.orderReference)} {...register("orderReference")} />
      </Field>
      <Field id="message" label="How can we help?" error={e.message?.message}>
        <Textarea id="message" rows={6} aria-invalid={Boolean(e.message)} {...register("message")} />
      </Field>
      <div aria-hidden className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
