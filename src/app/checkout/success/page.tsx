import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderStatus } from "@/components/payments/order-status";
import { Container } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment confirmation" };

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  await requireUser(`/checkout/success?order=${order ?? ""}`);
  if (!order || !z.string().uuid().safeParse(order).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("orders").select("id, status").eq("id", order).maybeSingle();
  if (!data) notFound();
  return (
    <Container className="max-w-xl py-20">
      <OrderStatus orderId={data.id} initialStatus={data.status} />
    </Container>
  );
}
