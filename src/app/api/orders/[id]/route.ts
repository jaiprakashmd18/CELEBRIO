import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/api";
import { jsonError } from "@/lib/security/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Order status for the confirmation page (read-only; RLS limits it to the buyer). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, { mutating: false });
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return jsonError(404, "not_found", "Order not found.");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("orders").select("id, status, project_id, amount_minor, currency, paid_at").eq("id", id).maybeSingle();
  if (!data) return jsonError(404, "not_found", "Order not found.");
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
