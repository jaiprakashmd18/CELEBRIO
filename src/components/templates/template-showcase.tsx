"use client";

import { useMemo, useState } from "react";
import { availableFormats, createProjectFromTemplate } from "@/lib/rendering/scene";
import { FORMAT_SIZES, type FormatId, type TemplateDefinition } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";
import { InvitationSvg } from "./invitation-svg";

const FORMAT_LABEL: Record<FormatId, string> = { portrait: "Portrait", square: "Square", landscape: "Landscape" };

/** Large interactive preview on the template detail page (formats and palettes). */
export function TemplateShowcase({ definition, slug, version, name }: { definition: TemplateDefinition; slug: string; version: number; name: string }) {
  const formats = availableFormats(definition);
  const [format, setFormat] = useState<FormatId>(definition.defaultFormat);
  const [paletteId, setPaletteId] = useState(definition.defaultPaletteId);
  const project = useMemo(() => ({ ...createProjectFromTemplate(definition, { slug, version }), format, paletteId }), [definition, slug, version, format, paletteId]);
  const size = FORMAT_SIZES[format];

  return (
    <div>
      <div className="flex min-h-[24rem] items-center justify-center rounded-[1.75rem] bg-sand/70 p-4 ring-1 ring-line sm:p-8">
        <div className="w-full overflow-hidden rounded-xl bg-white shadow-lift" style={{ maxWidth: format === "landscape" ? "100%" : format === "square" ? "30rem" : "22rem", aspectRatio: `${size.width} / ${size.height}` }}>
          <InvitationSvg definition={definition} project={project} format={format} idPrefix="showcase" title={`${name} — ${FORMAT_LABEL[format]} preview with sample text`} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        {formats.length > 1 && (
          <div role="group" aria-label="Preview format" className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
            {formats.map((f) => (
              <button key={f} type="button" aria-pressed={f === format} onClick={() => setFormat(f)} className={cn("rounded-full px-3.5 py-1.5 text-sm", f === format ? "bg-charcoal text-ivory" : "hover:bg-sand")}>
                {FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
        )}
        {definition.palettes.length > 1 && (
          <div role="group" aria-label="Colour palette" className="flex items-center gap-2">
            {definition.palettes.map((p) => (
              <button key={p.id} type="button" aria-pressed={p.id === paletteId} aria-label={p.name} title={p.name} onClick={() => setPaletteId(p.id)} className={cn("size-8 rounded-full ring-2 ring-offset-2 ring-offset-ivory transition", p.id === paletteId ? "ring-charcoal" : "ring-transparent hover:ring-line")} style={{ background: `linear-gradient(135deg, ${p.colors.background} 50%, ${p.colors.primary} 50%)` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
