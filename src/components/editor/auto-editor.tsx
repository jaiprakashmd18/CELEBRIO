"use client";

import { AlertTriangle } from "lucide-react";
import { useEditor, useEditorApi } from "@/features/editor/store";
import { setField } from "@/lib/projects/edit";
import { FIELD_GROUPS, extractPlaceholderKeys, type FieldDefinition } from "@/lib/templates/schema";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { PhotoControls } from "./photo-controls";
import { StyleControls } from "./style-controls";

const GROUP_TITLES: Record<(typeof FIELD_GROUPS)[number], string> = {
  names: "Names",
  event: "Event",
  details: "Venue & details",
  rsvp: "RSVP",
  message: "Message",
  photos: "Photos",
};

/** Beginner-friendly mode: a form generated from the template's editable fields. */
export function AutoEditor({ overflowIds }: { overflowIds: string[] }) {
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const elements = definition.formats[project.format]?.elements ?? [];

  // Which fields feed a text element whose text had to be shortened.
  const overflowFields = new Set<string>();
  for (const el of elements) {
    if (el.type === "text" && overflowIds.includes(el.id)) for (const k of extractPlaceholderKeys(el.content)) overflowFields.add(k);
  }

  const textGroups = FIELD_GROUPS.filter((g) => g !== "photos")
    .map((g) => ({ group: g, fields: definition.fields.filter((f) => f.group === g && f.type !== "image") }))
    .filter((g) => g.fields.length > 0);
  const photoFields = definition.fields.filter((f) => f.type === "image");

  return (
    <div className="space-y-8">
      {textGroups.map(({ group, fields }) => (
        <section key={group} aria-labelledby={`group-${group}`} className="space-y-4">
          <h2 id={`group-${group}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-gray">{GROUP_TITLES[group]}</h2>
          {fields.map((f) => (
            <TextFieldInput key={f.key} field={f} value={project.fields[f.key] ?? ""} overflow={overflowFields.has(f.key)} />
          ))}
        </section>
      ))}
      {photoFields.length > 0 && (
        <section aria-labelledby="group-photos" className="space-y-3">
          <h2 id="group-photos" className="text-xs font-semibold uppercase tracking-[0.18em] text-gray">Photos</h2>
          {photoFields.map((f) => (
            <PhotoControls key={f.key} fieldKey={f.key} label={f.label} help={f.help} />
          ))}
        </section>
      )}
      <section aria-labelledby="group-style" className="space-y-3">
        <h2 id="group-style" className="text-xs font-semibold uppercase tracking-[0.18em] text-gray">Style</h2>
        <StyleControls />
      </section>
    </div>
  );
}

function TextFieldInput({ field, value, overflow }: { field: FieldDefinition; value: string; overflow: boolean }) {
  const api = useEditorApi();
  const id = `field-${field.key}`;
  const onChange = (v: string) => api.getState().apply((p) => setField(p, field.key, v), { coalesce: `field-${field.key}` });
  const missing = field.required && !value.trim();
  const describedBy = [overflow ? `${id}-overflow` : null, missing ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const label = (
    <>
      {field.label}
      {!field.required && <span className="font-normal text-gray"> (optional)</span>}
    </>
  );
  const counter = field.maxLength && field.type !== "date" && field.type !== "time" ? `${value.length}/${field.maxLength}` : undefined;
  return (
    <Field id={id} label={label} counter={counter} error={missing ? "Required for this design" : undefined}>
      {field.type === "multiline" ? (
        <Textarea id={id} value={value} maxLength={field.maxLength} placeholder={field.placeholder} rows={3} aria-describedby={describedBy} aria-invalid={missing} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          aria-invalid={missing}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {overflow && (
        <p id={`${id}-overflow`} className="flex items-start gap-1.5 text-xs font-medium text-[#8a5a12]">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" /> This is too long for the design and will be shortened. Try fewer words.
        </p>
      )}
    </Field>
  );
}
