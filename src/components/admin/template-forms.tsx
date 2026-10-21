"use client";

import { useActionState, useMemo, useState } from "react";
import { createTemplate, saveTemplateDefinition, updateTemplateMetadata, type ActionResult } from "@/app/admin/actions";
import { InvitationSvg } from "@/components/templates/invitation-svg";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";
import { availableFormats, createProjectFromTemplate } from "@/lib/rendering/scene";
import { FORMAT_SIZES, templateDefinitionSchema, type FormatId, type TemplateDefinition } from "@/lib/templates/schema";

export interface TemplateMetadataValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  tags: string;
  style: string;
  colorFamily: string;
  priceAmount: number;
  multiFormatPriceAmount: number | null;
  currency: string;
  isFree: boolean;
}

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <Alert tone={state.ok ? "success" : "error"} title={state.message}>
      {state.errors && <ul className="list-disc pl-4">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Alert>
  );
}

function MetadataFields({ values, categories }: { values: TemplateMetadataValues; categories: Array<{ id: string; name: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="name" label="Name"><Input id="name" name="name" defaultValue={values.name} required maxLength={80} /></Field>
      <Field id="slug" label="URL slug" hint="Lowercase letters, numbers and dashes."><Input id="slug" name="slug" defaultValue={values.slug} required pattern="[a-z0-9-]{2,80}" /></Field>
      <Field id="description" label="Description" className="sm:col-span-2"><Textarea id="description" name="description" defaultValue={values.description} maxLength={600} rows={3} /></Field>
      <Field id="categoryId" label="Occasion"><Select id="categoryId" name="categoryId" defaultValue={values.categoryId}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field id="tags" label="Tags" hint="Comma separated, used by search."><Input id="tags" name="tags" defaultValue={values.tags} /></Field>
      <Field id="style" label="Style"><Select id="style" name="style" defaultValue={values.style}>{["classic", "modern", "playful", "romantic", "minimal", "bold"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
      <Field id="colorFamily" label="Colour family"><Select id="colorFamily" name="colorFamily" defaultValue={values.colorFamily}>{["warm", "cool", "dark", "pastel", "neutral"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
      <Field id="priceAmount" label="Single-format price (minor units)" hint="e.g. 4900 = ₹49.00"><Input id="priceAmount" name="priceAmount" type="number" min={0} defaultValue={values.priceAmount} required /></Field>
      <Field id="multiFormatPriceAmount" label="Multi-format price (minor units)" hint="Leave empty to not offer the package."><Input id="multiFormatPriceAmount" name="multiFormatPriceAmount" type="number" min={0} defaultValue={values.multiFormatPriceAmount ?? ""} /></Field>
      <Field id="currency" label="Currency" hint="ISO code. Must be supported by your payment provider."><Input id="currency" name="currency" defaultValue={values.currency} maxLength={3} /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="isFree" defaultChecked={values.isFree} className="size-4 accent-charcoal" /> Free download (price must be 0)</label>
    </div>
  );
}

export function TemplateMetadataForm({ values, categories }: { values: TemplateMetadataValues; categories: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(updateTemplateMetadata, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={values.id} />
      <Result state={state} />
      <MetadataFields values={values} categories={categories} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
    </form>
  );
}

export function NewTemplateForm({ categories, starters }: { categories: Array<{ id: string; name: string }>; starters: Array<{ slug: string; name: string; definition: string }> }) {
  const [state, action, pending] = useActionState(createTemplate, null);
  const [definition, setDefinition] = useState(starters[0]?.definition ?? "");
  return (
    <form action={action} className="space-y-6">
      <Result state={state} />
      <MetadataFields values={{ name: "", slug: "", description: "", categoryId: categories[0]?.id ?? "", tags: "", style: "classic", colorFamily: "neutral", priceAmount: 4900, multiFormatPriceAmount: 14900, currency: "INR", isFree: false }} categories={categories} />
      <Field id="base" label="Start from an existing design" hint="Copies its structured definition; you can edit everything afterwards.">
        <Select id="base" onChange={(e) => setDefinition(starters.find((s) => s.slug === e.target.value)?.definition ?? definition)}>
          {starters.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </Select>
      </Field>
      <DefinitionEditorFields value={definition} onChange={setDefinition} slug="new-template" />
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create draft template"}</Button>
    </form>
  );
}

export function DefinitionEditor({ id, slug, initial }: { id: string; slug: string; initial: string }) {
  const [state, action, pending] = useActionState(saveTemplateDefinition, null);
  const [value, setValue] = useState(initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Result state={state} />
      <DefinitionEditorFields value={value} onChange={setValue} slug={slug} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Validate & save new version"}</Button>
    </form>
  );
}

/** JSON editor with live schema validation and a rendered preview in every format. */
function DefinitionEditorFields({ value, onChange, slug }: { value: string; onChange: (v: string) => void; slug: string }) {
  const [format, setFormat] = useState<FormatId | null>(null);
  const result = useMemo((): { ok: true; def: TemplateDefinition } | { ok: false; errors: string[] } => {
    try {
      const parsed = templateDefinitionSchema.safeParse(JSON.parse(value));
      return parsed.success ? { ok: true, def: parsed.data } : { ok: false, errors: parsed.error.issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`) };
    } catch (err) {
      return { ok: false, errors: [`JSON syntax: ${err instanceof Error ? err.message : "invalid"}`] };
    }
  }, [value]);
  const formats = result.ok ? availableFormats(result.def) : [];
  const active = format && formats.includes(format) ? format : formats[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div>
        <label htmlFor="definition" className="text-sm font-medium">Template definition (JSON)</label>
        <p className="text-xs text-gray">Fields, palettes, font sets and one layout per format. Coordinates use 1080 × 1920 / 1080 × 1080 / 1920 × 1080 pixels. See docs/TEMPLATES.md.</p>
        <textarea id="definition" name="definition" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} className="mt-2 h-[32rem] w-full rounded-xl border border-line bg-[#1E1E1D] p-3 font-mono text-xs leading-relaxed text-[#EDEAE2]" />
        {result.ok ? <p className="mt-2 text-sm text-success" role="status">Definition is valid · formats: {formats.join(", ")}</p> : <Alert tone="error" className="mt-2" title="Validation problems"><ul className="list-disc pl-4">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}
      </div>
      <div>
        <div className="mb-2 flex gap-1">
          {formats.map((f) => <button key={f} type="button" aria-pressed={f === active} onClick={() => setFormat(f)} className={f === active ? "rounded-full bg-charcoal px-3 py-1 text-xs text-ivory" : "rounded-full px-3 py-1 text-xs ring-1 ring-line"}>{f}</button>)}
        </div>
        {result.ok && active ? (
          <div className="mx-auto overflow-hidden rounded-lg bg-white shadow-soft" style={{ aspectRatio: `${FORMAT_SIZES[active].width} / ${FORMAT_SIZES[active].height}`, maxWidth: active === "portrait" ? "18rem" : "100%" }}>
            <InvitationSvg definition={result.def} project={createProjectFromTemplate(result.def, { slug, version: 1 })} format={active} idPrefix="admin" title="Template preview with sample content" />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg bg-sand text-sm text-gray">Fix the definition to see a preview.</div>
        )}
      </div>
    </div>
  );
}
