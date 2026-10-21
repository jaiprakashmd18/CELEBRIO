"use client";

import { useActionState } from "react";
import { recordOrderRefund, saveCategory } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

export function CategoryForm({ category }: { category?: { id: string; name: string; slug: string; description: string | null; display_order: number; is_active: boolean } }) {
  const [state, action, pending] = useActionState(saveCategory, null);
  return (
    <form action={action} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_2fr_5rem_auto_auto]">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label className="text-xs text-gray">Name<Input name="name" defaultValue={category?.name} required /></label>
      <label className="text-xs text-gray">Slug<Input name="slug" defaultValue={category?.slug} required /></label>
      <label className="text-xs text-gray">Description<Input name="description" defaultValue={category?.description ?? ""} /></label>
      <label className="text-xs text-gray">Order<Input name="displayOrder" type="number" defaultValue={category?.display_order ?? 0} /></label>
      <label className="flex items-center gap-1 pb-3 text-xs"><input type="checkbox" name="isActive" defaultChecked={category?.is_active ?? true} /> Active</label>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{category ? "Save" : "Add"}</Button>
        {state && <span role="status" className={state.ok ? "text-xs text-success" : "text-xs text-danger"}>{state.message}</span>}
      </div>
    </form>
  );
}

export function RefundForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(recordOrderRefund, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={orderId} />
      <Select name="status" defaultValue="refunded" aria-label="Outcome">
        <option value="refunded">Record refund (issued in provider dashboard)</option>
        <option value="disputed">Mark as disputed</option>
      </Select>
      <Textarea name="note" placeholder="Reason / provider refund reference" aria-label="Note" rows={2} required />
      <Button type="submit" variant="danger" size="sm" disabled={pending}>Record and revoke access</Button>
      {state && <p role="status" className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>{state.message}</p>}
    </form>
  );
}
