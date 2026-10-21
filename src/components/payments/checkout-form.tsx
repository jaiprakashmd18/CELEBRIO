"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface PackageOption {
  id: "single_format" | "multi_format";
  title: string;
  description: string;
  priceLabel: string;
  formats: string[];
  owned: boolean;
}

/** Sends only the project id and package; the server decides the price. */
export function CheckoutForm({ projectId, options }: { projectId: string; options: PackageOption[] }) {
  const firstAvailable = options.find((o) => !o.owned) ?? options[0]!;
  const [selected, setSelected] = useState(firstAvailable.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const option = options.find((o) => o.id === selected)!;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, package: selected }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Checkout couldn't be started. You have not been charged.");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="sr-only">Choose a package</legend>
        {options.map((o) => (
          <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 transition", selected === o.id ? "ring-2 ring-charcoal" : "ring-line hover:ring-charcoal/30", o.owned && "cursor-not-allowed opacity-60")}>
            <input type="radio" name="package" value={o.id} checked={selected === o.id} disabled={o.owned} onChange={() => setSelected(o.id)} className="mt-1 size-4 accent-charcoal" />
            <span className="flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{o.title}</span>
                <span className="font-serif text-xl">{o.owned ? "Owned" : o.priceLabel}</span>
              </span>
              <span className="mt-1 block text-sm text-gray">{o.description}</span>
              <span className="mt-1 block text-xs text-gray">Formats: {o.formats.join(", ")}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && <Alert tone="error">{error}</Alert>}
      <button type="button" onClick={pay} disabled={busy || option.owned} className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-charcoal px-6 font-medium text-ivory disabled:opacity-50">
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Lock aria-hidden className="size-4" />}
        {busy ? "Opening secure checkout…" : option.priceLabel === "Free" ? "Unlock for free" : `Pay ${option.priceLabel} securely`}
      </button>
      <p className="text-center text-xs text-gray">You&apos;ll complete payment on our payment provider&apos;s secure page. Celebrio never sees your card details.</p>
    </div>
  );
}
