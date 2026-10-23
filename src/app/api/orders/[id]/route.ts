import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { reconcilePendingOrder } from "@/lib/orders/reconcile";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { jsonError } from "@/lib/security/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COLUMNS = "id, status, project_id, amount_minor, currency, paid_at";

/**
 * Order status for the confirmation page (RLS limits it to the buyer).
 * While an order is pending, the server also asks the payment provider
 * directly whether it was paid, in case the webhook is delayed or failing.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: false });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "Order not found.");
  const supabase = await createSupabaseServerClient();
  let { data } = await supabase.from("orders").select(COLUMNS).eq("id", id).maybeSingle();
  if (!data) return jsonError(404, "not_found", "Order not found.");

  if (data.status === "pending" && (await checkRateLimit("reconcile", guard.user.id))) {
    const outcome = await reconcilePendingOrder(createSupabaseAdminClient(), id);
    if (outcome === "paid") data = (await supabase.from("orders").select(COLUMNS).eq("id", id).maybeSingle()).data ?? data;
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
