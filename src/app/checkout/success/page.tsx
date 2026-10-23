import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@/components/payments/order-status";
import { Container } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { extractOrderId } from "@/lib/orders/order-id";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment confirmation" };

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const orderId = extractOrderId(await searchParams);
  await requireUser(`/checkout/success${orderId ? `?order=${orderId}` : ""}`);
  const supabase = await createSupabaseServerClient();
  const { data } = orderId ? await supabase.from("orders").select("id, status").eq("id", orderId).maybeSingle() : { data: null };
  if (!data) {
    return (
      <Container className="max-w-xl py-20 text-center">
        <h1 className="font-serif text-3xl">We couldn&apos;t find that order</h1>
        <p className="mt-3 text-gray">
          If you completed a payment, it will appear in your <Link href="/dashboard/purchases" className="underline">purchase history</Link> and unlock as soon as the payment provider confirms it. Make sure you&apos;re signed in with the same account you used to pay.
        </p>
      </Container>
    );
  }
  return (
    <Container className="max-w-xl py-20">
      <OrderStatus orderId={data.id} initialStatus={data.status} />
    </Container>
  );
}
