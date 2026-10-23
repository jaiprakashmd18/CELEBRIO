"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { renderPng, loadSampleImage } from "@/lib/exports/rasterize";
import { reconcilePendingOrder } from "@/lib/orders/reconcile";
import { availableFormats, createProjectFromTemplate } from "@/lib/rendering/scene";
import { checkUpload } from "@/lib/security/file-validation";
import { templateDefinitionSchema, type FormatId } from "@/lib/templates/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  message: string;
  errors?: string[];
}

const ASPECT: Record<FormatId, string> = { portrait: "9:16", square: "1:1", landscape: "16:9" };

async function audit(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const user = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  await supabase.from("admin_audit_logs").insert({ actor_id: user.id, action, entity_type: entityType, entity_id: entityId, safe_metadata: metadata });
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/templates");
  if (slug) revalidatePath(`/templates/${slug}`);
}

/* ----------------------------- templates ----------------------------- */

const metadataSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, "Slugs use lowercase letters, numbers and dashes"),
    description: z.string().trim().max(600),
    categoryId: z.string().uuid(),
    tags: z.string().max(400),
    style: z.enum(["classic", "modern", "playful", "romantic", "minimal", "bold"]),
    colorFamily: z.enum(["warm", "cool", "dark", "pastel", "neutral"]),
    priceAmount: z.coerce.number().int().min(0).max(10_000_000),
    multiFormatPriceAmount: z.union([z.literal(""), z.coerce.number().int().min(0).max(10_000_000)]),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    isFree: z.boolean(),
  })
  .refine((v) => !v.isFree || v.priceAmount === 0, { message: "Free templates must have a price of 0", path: ["priceAmount"] });

function readMetadata(form: FormData) {
  return metadataSchema.safeParse({
    name: form.get("name"),
    slug: form.get("slug"),
    description: form.get("description") ?? "",
    categoryId: form.get("categoryId"),
    tags: form.get("tags") ?? "",
    style: form.get("style"),
    colorFamily: form.get("colorFamily"),
    priceAmount: form.get("priceAmount"),
    multiFormatPriceAmount: form.get("multiFormatPriceAmount") ?? "",
    currency: form.get("currency") ?? "INR",
    isFree: form.get("isFree") === "on",
  });
}

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20).map((t) => t.slice(0, 40));
}

export async function createTemplate(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin("/admin/templates/new");
  const meta = readMetadata(form);
  if (!meta.success) return { ok: false, message: "Please fix the highlighted fields.", errors: meta.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  let definitionJson: unknown;
  try {
    definitionJson = JSON.parse(String(form.get("definition") ?? ""));
  } catch {
    return { ok: false, message: "The template definition is not valid JSON." };
  }
  const def = templateDefinitionSchema.safeParse(definitionJson);
  if (!def.success) return { ok: false, message: "The template definition has problems.", errors: def.error.issues.slice(0, 20).map((i) => `${i.path.join(".")}: ${i.message}`) };

  const supabase = await createSupabaseServerClient();
  const formats = availableFormats(def.data);
  const { data, error } = await supabase
    .from("templates")
    .insert({
      category_id: meta.data.categoryId,
      name: meta.data.name,
      slug: meta.data.slug,
      description: meta.data.description,
      tags: parseTags(meta.data.tags),
      style: meta.data.style,
      color_family: meta.data.colorFamily,
      template_definition: def.data,
      supported_formats: formats,
      aspect_ratio: ASPECT[def.data.defaultFormat],
      price_amount: meta.data.priceAmount,
      multi_format_price_amount: meta.data.multiFormatPriceAmount === "" ? null : meta.data.multiFormatPriceAmount,
      currency: meta.data.currency,
      is_free: meta.data.isFree,
      is_published: false,
      version: 1,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.code === "23505" ? "That slug is already in use." : `Couldn't create the template: ${error?.message ?? "unknown error"}` };
  await audit("template.created", "template", data.id, { slug: meta.data.slug });
  redirect(`/admin/templates/${data.id}?created=1`);
}

export async function updateTemplateMetadata(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  const meta = readMetadata(form);
  if (!id.success) return { ok: false, message: "Unknown template." };
  if (!meta.success) return { ok: false, message: "Please fix the highlighted fields.", errors: meta.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("templates").select("price_amount, multi_format_price_amount, currency, is_free, slug").eq("id", id.data).single();
  const { error } = await supabase
    .from("templates")
    .update({
      category_id: meta.data.categoryId,
      name: meta.data.name,
      slug: meta.data.slug,
      description: meta.data.description,
      tags: parseTags(meta.data.tags),
      style: meta.data.style,
      color_family: meta.data.colorFamily,
      price_amount: meta.data.priceAmount,
      multi_format_price_amount: meta.data.multiFormatPriceAmount === "" ? null : meta.data.multiFormatPriceAmount,
      currency: meta.data.currency,
      is_free: meta.data.isFree,
    })
    .eq("id", id.data);
  if (error) return { ok: false, message: error.code === "23505" ? "That slug is already in use." : `Couldn't save: ${error.message}` };
  await audit("template.metadata_updated", "template", id.data, {
    priceBefore: before?.price_amount,
    priceAfter: meta.data.priceAmount,
    multiBefore: before?.multi_format_price_amount,
    multiAfter: meta.data.multiFormatPriceAmount === "" ? null : meta.data.multiFormatPriceAmount,
    currency: meta.data.currency,
  });
  revalidateCatalog(meta.data.slug);
  if (before?.slug && before.slug !== meta.data.slug) revalidateCatalog(before.slug);
  revalidatePath(`/admin/templates/${id.data}`);
  return { ok: true, message: "Saved." };
}

export async function saveTemplateDefinition(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Unknown template." };
  let json: unknown;
  try {
    json = JSON.parse(String(form.get("definition") ?? ""));
  } catch {
    return { ok: false, message: "The definition is not valid JSON." };
  }
  const def = templateDefinitionSchema.safeParse(json);
  if (!def.success) return { ok: false, message: "The definition has problems.", errors: def.error.issues.slice(0, 20).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const supabase = await createSupabaseServerClient();
  // Atomic: bumps the version, snapshots it in template_versions and writes the audit log.
  const { data: version, error } = await supabase.rpc("admin_save_template_definition", {
    p_template_id: id.data,
    p_definition: def.data,
    p_supported_formats: availableFormats(def.data),
    p_aspect_ratio: ASPECT[def.data.defaultFormat],
  });
  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  const { data: t } = await supabase.from("templates").select("slug").eq("id", id.data).single();
  revalidateCatalog(t?.slug);
  revalidatePath(`/admin/templates/${id.data}`);
  return { ok: true, message: `Saved as version ${version}. Existing customer drafts keep the version they started with.` };
}

export async function setTemplateStatus(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const status = z.enum(["publish", "unpublish", "archive", "restore"]).parse(form.get("status"));
  const supabase = await createSupabaseServerClient();
  const { data: t } = await supabase.from("templates").select("slug, preview_path, template_definition").eq("id", id).single();
  if (!t) throw new Error("Template not found");
  if (status === "publish") {
    if (!templateDefinitionSchema.safeParse(t.template_definition).success) redirect(`/admin/templates/${id}?error=invalid-definition`);
    if (!t.preview_path) redirect(`/admin/templates/${id}?error=missing-preview`);
  }
  const update =
    status === "publish"
      ? { is_published: true, is_archived: false, published_at: new Date().toISOString() }
      : status === "unpublish"
        ? { is_published: false }
        : status === "archive"
          ? { is_published: false, is_archived: true }
          : { is_archived: false };
  await supabase.from("templates").update(update).eq("id", id);
  await audit(`template.${status}`, "template", id, { slug: t.slug });
  revalidateCatalog(t.slug);
  revalidatePath(`/admin/templates/${id}`);
  revalidatePath("/admin/templates");
}

export async function duplicateTemplate(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createSupabaseServerClient();
  const { data: t } = await supabase.from("templates").select("*").eq("id", id).single();
  if (!t) throw new Error("Template not found");
  const slug = `${t.slug}-copy-${Date.now().toString(36)}`.slice(0, 80);
  const { data: copy, error } = await supabase
    .from("templates")
    .insert({
      category_id: t.category_id,
      name: `${t.name} (copy)`.slice(0, 80),
      slug,
      description: t.description,
      tags: t.tags,
      style: t.style,
      color_family: t.color_family,
      preview_path: t.preview_path,
      template_definition: t.template_definition,
      supported_formats: t.supported_formats,
      aspect_ratio: t.aspect_ratio,
      price_amount: t.price_amount,
      multi_format_price_amount: t.multi_format_price_amount,
      currency: t.currency,
      is_free: t.is_free,
      is_published: false,
      version: 1,
    })
    .select("id")
    .single();
  if (error || !copy) throw new Error(error?.message ?? "Duplicate failed");
  await audit("template.duplicated", "template", copy.id, { from: id });
  redirect(`/admin/templates/${copy.id}`);
}

/** Renders a preview image from the definition's sample content and stores it publicly. */
export async function generateTemplatePreview(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createSupabaseServerClient();
  const { data: t } = await supabase.from("templates").select("slug, version, template_definition").eq("id", id).single();
  const def = templateDefinitionSchema.safeParse(t?.template_definition);
  if (!t || !def.success) redirect(`/admin/templates/${id}?error=invalid-definition`);
  const project = createProjectFromTemplate(def.data, { slug: t.slug, version: t.version });
  const format = def.data.defaultFormat;
  const png = await renderPng(def.data, project, { format, watermark: false, outputWidth: format === "landscape" ? 960 : 720, loadImage: loadSampleImage });
  const webp = await sharp(png).webp({ quality: 82 }).toBuffer();
  await storePreview(id, t.slug, webp);
}

export async function uploadTemplatePreview(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const file = form.get("file");
  if (!(file instanceof File)) redirect(`/admin/templates/${id}?error=no-file`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload({ declaredType: file.type, size: bytes.byteLength, head: bytes.subarray(0, 16), maxBytes: 5_000_000 });
  if (!check.ok) redirect(`/admin/templates/${id}?error=bad-file`);
  const webp = await sharp(bytes, { limitInputPixels: 40_000_000 }).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const supabase = await createSupabaseServerClient();
  const { data: t } = await supabase.from("templates").select("slug").eq("id", id).single();
  await storePreview(id, t?.slug ?? "template", webp);
}

async function storePreview(id: string, slug: string, webp: Buffer) {
  const admin = createSupabaseAdminClient();
  const path = `templates/${slug}-${Date.now().toString(36)}.webp`;
  const { error } = await admin.storage.from("template-previews").upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) redirect(`/admin/templates/${id}?error=upload-failed`);
  const url = admin.storage.from("template-previews").getPublicUrl(path).data.publicUrl;
  const supabase = await createSupabaseServerClient();
  await supabase.from("templates").update({ preview_path: url }).eq("id", id);
  await audit("template.preview_updated", "template", id, { path });
  revalidateCatalog(slug);
  redirect(`/admin/templates/${id}?preview=updated`);
}

/* ----------------------------- categories ---------------------------- */

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/),
  description: z.string().trim().max(400),
  displayOrder: z.coerce.number().int().min(0).max(1000),
  isActive: z.boolean(),
});

export async function saveCategory(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({
    id: form.get("id") || undefined,
    name: form.get("name"),
    slug: form.get("slug"),
    description: form.get("description") ?? "",
    displayOrder: form.get("displayOrder") ?? 0,
    isActive: form.get("isActive") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Please check the fields.", errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const supabase = await createSupabaseServerClient();
  const row = { name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description, display_order: parsed.data.displayOrder, is_active: parsed.data.isActive };
  const { data, error } = parsed.data.id
    ? await supabase.from("categories").update(row).eq("id", parsed.data.id).select("id").single()
    : await supabase.from("categories").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: error?.code === "23505" ? "That slug is already in use." : `Couldn't save: ${error?.message}` };
  await audit(parsed.data.id ? "category.updated" : "category.created", "category", data.id, { slug: parsed.data.slug });
  revalidatePath("/admin/categories");
  revalidateCatalog();
  return { ok: true, message: "Saved." };
}

/* ------------------------------- orders ------------------------------ */

export async function recordOrderRefund(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(["refunded", "disputed"]), note: z.string().trim().min(3, "Add a short note").max(300) })
    .safeParse({ id: form.get("id"), status: form.get("status"), note: form.get("note") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  // The admin has issued the refund in the provider dashboard; this records it and revokes access.
  const { data, error } = await createSupabaseAdminClient().rpc("mark_order_refunded", {
    p_order_id: parsed.data.id,
    p_status: parsed.data.status,
    p_source: "admin",
    p_actor: user.id,
    p_event_id: null,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, message: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  await audit(`order.${parsed.data.status}`, "order", parsed.data.id, { changed: row?.changed ?? false });
  revalidatePath(`/admin/orders/${parsed.data.id}`);
  return { ok: true, message: row?.changed ? `Order marked ${parsed.data.status}; access revoked.` : `No change — order is ${row?.status}.` };
}

/** Asks the payment provider directly whether a pending order was paid. */
export async function checkOrderWithProvider(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const outcome = await reconcilePendingOrder(createSupabaseAdminClient(), id);
  await audit("order.provider_check", "order", id, { outcome });
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${id}?check=${outcome}`);
}

export async function expireStaleOrders() {
  const user = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await admin.from("orders").select("id, provider, provider_checkout_id").eq("status", "pending").lt("created_at", cutoff).limit(500);
  let count = 0;
  for (const o of stale ?? []) {
    if (!o.provider_checkout_id) {
      await admin.from("orders").update({ status: "expired", failure_reason: "no_checkout_session" }).eq("id", o.id).eq("status", "pending");
      count++;
      continue;
    }
    const { error } = await admin.rpc("mark_order_unsuccessful", { p_provider: o.provider, p_checkout_id: o.provider_checkout_id, p_status: "expired", p_reason: "Abandoned checkout (expired by admin)", p_event_id: null });
    if (!error) count++;
  }
  await createSupabaseServerClient().then((s) => s.from("admin_audit_logs").insert({ actor_id: user.id, action: "orders.expire_stale", entity_type: "order", entity_id: null, safe_metadata: { count } }));
  revalidatePath("/admin/orders");
}

/* ------------------------------ support ------------------------------ */

export async function updateSupportRequest(form: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["open", "in_progress", "resolved"]), note: z.string().max(2000) }).parse({ id: form.get("id"), status: form.get("status"), note: form.get("note") ?? "" });
  const supabase = await createSupabaseServerClient();
  await supabase.from("support_requests").update({ status: parsed.status, admin_note: parsed.note || null }).eq("id", parsed.id);
  await audit("support.updated", "support_request", parsed.id, { status: parsed.status });
  revalidatePath("/admin/support");
}

/* ------------------------------ exports ------------------------------ */

/** Deletes generated files older than 30 days (they can be regenerated on demand). */
export async function cleanupOldExports() {
  const user = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: jobs } = await admin.from("export_jobs").select("id, output_storage_path").lt("created_at", cutoff).not("output_storage_path", "is", null).limit(1000);
  const paths = (jobs ?? []).map((j) => j.output_storage_path as string);
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from("exports").remove(paths.slice(i, i + 100));
  if (jobs?.length) await admin.from("export_jobs").update({ output_storage_path: null }).in("id", jobs.map((j) => j.id));
  await (await createSupabaseServerClient()).from("admin_audit_logs").insert({ actor_id: user.id, action: "exports.cleanup", entity_type: "export_job", entity_id: null, safe_metadata: { removed: paths.length } });
  revalidatePath("/admin/exports");
}

