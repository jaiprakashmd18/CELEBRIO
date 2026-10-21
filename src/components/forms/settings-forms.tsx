"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { updateProfile } from "@/app/dashboard/settings/actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <Field id="displayName" label="Display name">
        <Input id="displayName" name="displayName" defaultValue={displayName} maxLength={80} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {state && <p role="status" className="text-sm text-gray">{state.message}</p>}
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onDelete() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Couldn't delete your account. Please contact support.");
      setBusy(false);
      return;
    }
    window.location.assign("/?account=deleted");
  }
  return (
    <div className="space-y-3">
      <Field id="confirm-delete" label={<>Type <strong>DELETE</strong> to confirm</>}>
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button variant="danger" disabled={confirm !== "DELETE" || busy} onClick={onDelete}>{busy ? "Deleting…" : "Delete my account permanently"}</Button>
    </div>
  );
}
