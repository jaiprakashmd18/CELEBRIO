import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CheckoutForm, type PackageOption } from "@/components/payments/checkout-form";
import { InvitationSvg } from "@/components/templates/invitation-svg";
import { Alert, Container } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { PROJECT_COLUMNS, loadTemplateMeta, loadTemplateVersion, type ProjectRow } from "@/lib/data/projects";
import { formatMoney } from "@/lib/money";
import { PACKAGE_LABELS, availablePackages, calculateQuote } from "@/lib/pricing";
import { missingRequiredFields } from "@/lib/projects/validate";
import { FORMAT_IDS, FORMAT_SIZES, projectDataSchema } from "@/lib/templates/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser(`/checkout/${projectId}`);
  if (!z.string().uuid().safeParse(projectId).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  const row = data as ProjectRow | null;
  if (!row || row.owner_id !== user.id) notFound();
  const [definition, meta] = await Promise.all([loadTemplateVersion(supabase, row.template_id, row.template_version), loadTemplateMeta(supabase, row.template_id)]);
  const project = projectDataSchema.safeParse(row.project_data);
  if (!definition || !meta || !project.success) notFound();

  const { data: entitlements } = await supabase.from("entitlements").select("allowed_formats, status, orders!inner(status)").eq("project_id", projectId).eq("status", "active").eq("orders.status", "paid");
  const owned = new Set((entitlements ?? []).flatMap((e) => e.allowed_formats as string[]));
  const priced = {
    priceAmount: meta.price_amount,
    multiFormatPriceAmount: meta.multi_format_price_amount,
    currency: meta.currency,
    isFree: meta.is_free,
    supportedFormats: FORMAT_IDS.filter((f) => meta.supported_formats.includes(f)),
  };
  const options: PackageOption[] = availablePackages(priced).map((pkg) => {
    const quote = calculateQuote(priced, pkg, project.data.format);
    return {
      id: pkg,
      title: PACKAGE_LABELS[pkg].title,
      description: PACKAGE_LABELS[pkg].description,
      priceLabel: quote.isFree ? "Free" : formatMoney(quote.amountMinor, quote.currency),
      formats: quote.formats,
      owned: quote.formats.every((f) => owned.has(f)),
    };
  });
  const missing = missingRequiredFields(definition, project.data);
  const size = FORMAT_SIZES[project.data.format];

  return (
    <Container className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <div className="mx-auto max-w-sm overflow-hidden rounded-xl bg-white shadow-lift" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
          <InvitationSvg definition={definition} project={project.data} watermark idPrefix="checkout" title={`Preview of ${row.title}`} />
        </div>
        <p className="mt-4 text-center text-sm"><Link href={`/editor/${row.id}`} className="underline">Back to editing</Link></p>
      </div>
      <div>
        <h1 className="font-serif text-4xl">Unlock your invitation</h1>
        <p className="mt-2 text-gray">{row.title} · {meta.name}</p>
        {!user.emailVerified && <Alert tone="error" className="mt-6">Please verify your email address before purchasing. Check your inbox for the verification link.</Alert>}
        {missing.length > 0 ? (
          <Alert tone="error" className="mt-6" title="A few details are missing">
            Please complete {missing.join(", ")} in the <Link className="underline" href={`/editor/${row.id}`}>editor</Link> before checking out.
          </Alert>
        ) : (
          <div className="mt-8"><CheckoutForm projectId={row.id} options={options} /></div>
        )}
        <div className="mt-8 space-y-2 rounded-2xl bg-sand/60 p-4 text-sm text-gray">
          <p className="font-medium text-charcoal">What you&apos;re buying</p>
          <p>A one-time purchase unlocks this invitation and the formats in your package as high-resolution PNG, JPEG and print-ready PDF files, with no watermark. Re-download any time from your account.</p>
          <p>Corrections later (names, times, photos) are included. Turning this invitation into one for a different event needs a new purchase.</p>
          <p>Prices are in {meta.currency}; no currency conversion is applied by Celebrio. See the <Link href="/refund-policy" className="underline">refund policy</Link>.</p>
        </div>
      </div>
    </Container>
  );
}
