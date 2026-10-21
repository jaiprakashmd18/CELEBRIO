"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, PenLine, ShoppingBag, Trash2 } from "lucide-react";

export function ProjectActions({ id, purchased }: { id: string; purchased: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "dup" | "del">(null);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    setBusy("dup");
    setError(null);
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    setBusy(null);
    if (!res.ok) return setError("Couldn't duplicate. Please try again.");
    router.refresh();
  }
  async function remove() {
    const warning = purchased
      ? "Delete this unlocked invitation? Its photos and downloads will be removed and the purchase can't be reused. Your order record is kept."
      : "Delete this draft and its photos? This can't be undone.";
    if (!window.confirm(warning)) return;
    setBusy("del");
    setError(null);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return setError("Couldn't delete. Please try again.");
    router.refresh();
  }
  return (
    <div className="mt-auto space-y-2">
      <div className="flex flex-wrap gap-1.5 text-sm">
        <Link href={`/editor/${id}`} className="inline-flex items-center gap-1 rounded-full bg-charcoal px-3 py-1.5 text-ivory"><PenLine aria-hidden className="size-3.5" /> Edit</Link>
        {!purchased && <Link href={`/checkout/${id}`} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-line hover:bg-sand"><ShoppingBag aria-hidden className="size-3.5" /> Unlock</Link>}
        <button type="button" disabled={busy !== null} onClick={duplicate} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-line hover:bg-sand disabled:opacity-50"><Copy aria-hidden className="size-3.5" /> {busy === "dup" ? "Copying…" : "Duplicate"}</button>
        <button type="button" disabled={busy !== null} onClick={remove} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-danger ring-1 ring-line hover:bg-danger/5 disabled:opacity-50"><Trash2 aria-hidden className="size-3.5" /> {busy === "del" ? "Deleting…" : "Delete"}</button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
