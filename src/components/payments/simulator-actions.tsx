"use client";

import { useState } from "react";

export function SimulatorActions({ checkoutId, successUrl, cancelUrl }: { checkoutId: string; successUrl: string; cancelUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(outcome: "pay" | "decline") {
    setBusy(true);
    const res = await fetch("/api/dev/simulator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId, outcome }) });
    if (!res.ok) {
      setError("Simulator request failed — check PAYMENT_PROVIDER and SIMULATOR_WEBHOOK_SECRET.");
      setBusy(false);
      return;
    }
    window.location.assign(successUrl);
  }
  return (
    <div className="mt-6 grid gap-2">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="button" disabled={busy} onClick={() => send("pay")} className="h-12 rounded-full bg-[#2B6CB0] font-medium text-[#fff] disabled:opacity-50">Pay (test success)</button>
      <button type="button" disabled={busy} onClick={() => send("decline")} className="h-12 rounded-full ring-1 ring-line">Decline card (test failure)</button>
      <a href={cancelUrl} className="py-2 text-center text-sm underline">Cancel and return</a>
    </div>
  );
}
