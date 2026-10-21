"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/**
 * Polls the order until the payment provider's webhook has confirmed it.
 * Reaching this page does NOT mark anything as paid.
 */
export function OrderStatus({ orderId, initialStatus }: { orderId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (status !== "pending") return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) {
        const body = (await res.json()) as { status: string };
        if (body.status !== "pending") {
          setStatus(body.status);
          clearInterval(timer);
        }
      }
      if (attempts >= 45) {
        setTimedOut(true);
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [orderId, status]);

  if (status === "paid") {
    return (
      <div className="text-center">
        <CheckCircle2 aria-hidden className="mx-auto size-12 text-success" />
        <h1 className="mt-4 font-serif text-4xl">Your invitation is unlocked</h1>
        <p className="mt-3 text-gray">Payment confirmed. Your high-quality files are ready to download.</p>
        <Link href="/dashboard/invitations" className={buttonClasses("primary", "lg", "mt-8")}>Go to my downloads</Link>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="text-center" role="status" aria-live="polite">
        <Loader2 aria-hidden className="mx-auto size-10 animate-spin text-gray" />
        <h1 className="mt-4 font-serif text-3xl">Confirming your payment…</h1>
        <p className="mt-3 text-gray">We&apos;re waiting for the payment provider to confirm. This usually takes a few seconds.</p>
        {timedOut && (
          <p className="mt-6 text-sm text-gray">
            This is taking longer than usual. If you completed payment, your invitation will unlock automatically once it&apos;s confirmed — check <Link href="/dashboard/purchases" className="underline">your purchases</Link> shortly, or <Link href="/contact" className="underline">contact support</Link> with order reference <code className="rounded bg-sand px-1">{orderId}</code>.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="text-center">
      <XCircle aria-hidden className="mx-auto size-12 text-danger" />
      <h1 className="mt-4 font-serif text-3xl">Payment not completed</h1>
      <p className="mt-3 text-gray">
        {status === "refunded" ? "This order has been refunded." : "The payment didn't go through, so you have not been charged for this order."} You can try again from your invitation.
      </p>
      <Link href="/dashboard/drafts" className={buttonClasses("secondary", "lg", "mt-8")}>Back to my invitations</Link>
    </div>
  );
}
