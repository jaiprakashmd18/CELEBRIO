"use client";

import { useEditor, useEditorApi } from "@/features/editor/store";
import { FONT_FAMILIES } from "@/lib/rendering/fonts";
import { availableFormats } from "@/lib/rendering/scene";
import type { FormatId } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";

const FORMAT_LABEL: Record<FormatId, { label: string; hint: string }> = {
  portrait: { label: "Portrait", hint: "Stories & WhatsApp" },
  square: { label: "Square", hint: "Social posts" },
  landscape: { label: "Landscape", hint: "Email & screens" },
};

export function StyleControls() {
  const api = useEditorApi();
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const formats = availableFormats(definition);
  const caps = definition.capabilities;

  return (
    <div className="space-y-6">
      {caps.formatSwitch && formats.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium">Format</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {formats.map((f) => (
              <button key={f} type="button" aria-pressed={project.format === f} onClick={() => api.getState().setFormat(f)} className={cn("rounded-xl px-2 py-2 text-left ring-1 ring-line", project.format === f ? "bg-charcoal text-ivory ring-charcoal" : "bg-white hover:bg-sand")}>
                <span className="block text-sm font-medium">{FORMAT_LABEL[f].label}</span>
                <span className={cn("block text-[11px]", project.format === f ? "text-ivory/70" : "text-gray")}>{FORMAT_LABEL[f].hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray">Each format has its own layout; your text and photos carry over.</p>
        </fieldset>
      )}
      {caps.paletteSwitch && definition.palettes.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium">Colours</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {definition.palettes.map((p) => (
              <button key={p.id} type="button" aria-pressed={project.paletteId === p.id} onClick={() => api.getState().apply((d) => ({ ...d, paletteId: p.id }))} className={cn("flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ring-1", project.paletteId === p.id ? "ring-2 ring-charcoal" : "ring-line hover:bg-sand")}>
                <span aria-hidden className="flex">
                  {[p.colors.background, p.colors.primary, p.colors.accent].map((c, i) => (
                    <span key={i} className="-ml-1 size-6 rounded-full ring-2 ring-white first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {caps.fontSwitch && definition.fontSets.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium">Typography</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {definition.fontSets.map((f) => (
              <button key={f.id} type="button" aria-pressed={project.fontSetId === f.id} onClick={() => api.getState().apply((d) => ({ ...d, fontSetId: f.id }))} className={cn("rounded-xl px-3 py-2 text-left ring-1", project.fontSetId === f.id ? "ring-2 ring-charcoal" : "ring-line hover:bg-sand")}>
                <span className="block text-lg leading-tight" style={{ fontFamily: FONT_FAMILIES[f.display].cssName }}>{f.name}</span>
                <span className="block text-xs text-gray">{FONT_FAMILIES[f.display].label} · {FONT_FAMILIES[f.body].label}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
