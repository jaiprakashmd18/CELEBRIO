"use client";

import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Italic,
  Lock,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEditor, useEditorApi } from "@/features/editor/store";
import { clampGeometry, deleteElement, duplicateElement, editElementText, elementEditableText, isAddedElement, moveLayer, patchElement } from "@/lib/projects/edit";
import { FONT_FAMILIES, FONT_FAMILY_IDS, isFontFamilyId } from "@/lib/rendering/fonts";
import { fontSetFor, paletteFor } from "@/lib/rendering/scene";
import { FORMAT_SIZES, PALETTE_KEYS, type ElementPatch, type TemplateElement, type TextElement } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";
import { PhotoControls } from "./photo-controls";

function IconButton({ label, onClick, children, pressed, disabled }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className={cn("inline-flex size-9 items-center justify-center rounded-lg ring-1 ring-line disabled:opacity-40", pressed ? "bg-charcoal text-ivory ring-charcoal" : "bg-white hover:bg-sand")}>
      {children}
    </button>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
      {label}
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm normal-case tracking-normal text-charcoal"
      />
    </label>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (token: string) => void }) {
  const definition = useEditor((s) => s.definition);
  const paletteId = useEditor((s) => s.project.paletteId);
  const palette = paletteFor(definition, paletteId);
  const current = value.startsWith("#") ? value : palette.colors[value.slice(8) as keyof typeof palette.colors];
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray">Colour</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {PALETTE_KEYS.map((k) => (
          <button key={k} type="button" aria-label={`Palette ${k}`} title={`Palette: ${k}`} aria-pressed={value === `palette.${k}`} onClick={() => onChange(`palette.${k}`)} className={cn("size-7 rounded-full ring-2 ring-offset-1", value === `palette.${k}` ? "ring-charcoal" : "ring-line")} style={{ background: palette.colors[k] }} />
        ))}
        <label className="relative inline-flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-2 ring-line ring-offset-1" title="Custom colour">
          <span className="sr-only">Custom colour</span>
          <input type="color" value={current ?? "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" />
          <span aria-hidden className="size-full" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
        </label>
      </div>
    </div>
  );
}

export function PropertiesPanel({ elements }: { elements: TemplateElement[] }) {
  const api = useEditorApi();
  const selectedId = useEditor((s) => s.selectedId);
  const project = useEditor((s) => s.project);
  const el = elements.find((x) => x.id === selectedId);

  if (!el) {
    return (
      <div className="p-4 text-sm text-gray">
        <p className="font-medium text-charcoal">Nothing selected</p>
        <p className="mt-1">Tap a text or photo on the canvas, or choose a layer, to edit it. Use arrow keys to nudge and Shift for bigger steps.</p>
      </div>
    );
  }

  const format = project.format;
  const { width: W, height: H } = FORMAT_SIZES[format];
  const apply = (patch: ElementPatch, coalesce?: string) => api.getState().apply((p) => patchElement(p, format, el.id, patch), { coalesce: coalesce ? `${coalesce}-${el.id}` : undefined });
  const geom = (patch: ElementPatch) => apply(clampGeometry(patch, el, format), "geom");
  const added = isAddedElement(project, format, el.id);

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray">{el.type === "decor" ? "Decoration" : el.type}</p>
          <p className="font-medium capitalize">{el.name}</p>
        </div>
        {el.locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-1 text-[11px]"><Lock aria-hidden className="size-3" /> Decorative</span>
        )}
      </div>

      {el.type === "text" && <TextProperties el={el} />}
      {el.type === "image" && (
        <div className="space-y-3">
          <PhotoControls fieldKey={el.field} label="Photo" />
          <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
            Filter
            <select value={el.filter} onChange={(e) => apply({ filter: e.target.value as "none" })} className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm normal-case tracking-normal text-charcoal">
              <option value="none">None</option>
              <option value="grayscale">Black & white</option>
              <option value="warm">Warm</option>
              <option value="cool">Cool</option>
            </select>
          </label>
        </div>
      )}
      {el.type === "shape" && el.shape !== "line" && el.fill !== "none" && <ColorPicker value={el.fill} onChange={(c) => apply({ fill: c as ElementPatch["fill"] })} />}
      {el.type === "decor" && <ColorPicker value={el.colors[0] ?? "palette.primary"} onChange={(c) => apply({ colors: [c as `palette.${string}`, ...el.colors.slice(1)] as ElementPatch["colors"] })} />}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray">Position & size</p>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          <NumberInput label="X" value={el.x} onChange={(x) => geom({ x })} />
          <NumberInput label="Y" value={el.y} onChange={(y) => geom({ y })} />
          <NumberInput label="W" value={el.w} min={10} onChange={(w) => geom({ w })} />
          <NumberInput label="H" value={el.h} min={10} onChange={(h) => geom({ h })} />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray">Align on canvas</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <IconButton label="Align left" onClick={() => geom({ x: 0 })}><AlignHorizontalJustifyStart aria-hidden className="size-4" /></IconButton>
          <IconButton label="Centre horizontally" onClick={() => geom({ x: (W - el.w) / 2 })}><AlignHorizontalJustifyCenter aria-hidden className="size-4" /></IconButton>
          <IconButton label="Align right" onClick={() => geom({ x: W - el.w })}><AlignHorizontalJustifyEnd aria-hidden className="size-4" /></IconButton>
          <IconButton label="Align top" onClick={() => geom({ y: 0 })}><AlignVerticalJustifyStart aria-hidden className="size-4" /></IconButton>
          <IconButton label="Centre vertically" onClick={() => geom({ y: (H - el.h) / 2 })}><AlignVerticalJustifyCenter aria-hidden className="size-4" /></IconButton>
          <IconButton label="Align bottom" onClick={() => geom({ y: H - el.h })}><AlignVerticalJustifyEnd aria-hidden className="size-4" /></IconButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
          Rotation {Math.round(el.rotation)}°
          <input type="range" min={-180} max={180} value={el.rotation} onChange={(e) => apply({ rotation: Number(e.target.value) }, "rotation")} className="mt-1 w-full accent-charcoal" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
          Opacity {Math.round(el.opacity * 100)}%
          <input type="range" min={0.1} max={1} step={0.01} value={el.opacity} onChange={(e) => apply({ opacity: Number(e.target.value) }, "opacity")} className="mt-1 w-full accent-charcoal" />
        </label>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray">Layer</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <IconButton label="Bring to front" onClick={() => api.getState().apply((p) => moveLayer(p, format, elements, el.id, "top"))}><ChevronsUp aria-hidden className="size-4" /></IconButton>
          <IconButton label="Bring forward" onClick={() => api.getState().apply((p) => moveLayer(p, format, elements, el.id, 1))}><ArrowUp aria-hidden className="size-4" /></IconButton>
          <IconButton label="Send backward" onClick={() => api.getState().apply((p) => moveLayer(p, format, elements, el.id, -1))}><ArrowDown aria-hidden className="size-4" /></IconButton>
          <IconButton label="Send to back" onClick={() => api.getState().apply((p) => moveLayer(p, format, elements, el.id, "bottom"))}><ChevronsDown aria-hidden className="size-4" /></IconButton>
          {(el.type === "text" || el.type === "image") && (
            <IconButton
              label="Duplicate"
              onClick={() => {
                const r = duplicateElement(project, format, el);
                if (r.id) {
                  api.getState().apply(() => r.project);
                  api.getState().select(r.id);
                }
              }}
            >
              <Copy aria-hidden className="size-4" />
            </IconButton>
          )}
          <IconButton
            label={added ? "Delete" : "Hide from design"}
            onClick={() => {
              api.getState().apply((p) => deleteElement(p, format, el.id));
              api.getState().select(null);
            }}
          >
            <Trash2 aria-hidden className="size-4" />
          </IconButton>
        </div>
        {!added && <p className="mt-2 text-xs text-gray">Template elements are hidden rather than deleted, so you can bring them back from the layers list.</p>}
      </div>
    </div>
  );
}

function TextProperties({ el }: { el: TextElement }) {
  const api = useEditorApi();
  const project = useEditor((s) => s.project);
  const definition = useEditor((s) => s.definition);
  const format = project.format;
  const fontSet = fontSetFor(definition, project.fontSetId);
  const family = el.style.fontFamily ?? fontSet[el.style.fontRole];
  const faces = FONT_FAMILIES[family].faces;
  const weights = [...new Set(faces.filter((f) => !f.italic).map((f) => f.weight))];
  const hasItalic = faces.some((f) => f.italic);
  const style = (s: Partial<TextElement["style"]>, coalesce?: string) => api.getState().apply((p) => patchElement(p, format, el.id, { style: s }), { coalesce: coalesce ? `${coalesce}-${el.id}` : undefined });
  const text = elementEditableText(project, el);
  const isFieldBound = /^\{[a-z][a-z0-9_]*\}$/.test(el.content.trim());

  return (
    <div className="space-y-4">
      <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
        Text
        <textarea value={text} maxLength={isFieldBound ? 600 : 800} rows={3} onChange={(e) => api.getState().apply((p) => editElementText(p, format, el, e.target.value), { coalesce: `text-${el.id}` })} className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-sm normal-case tracking-normal text-charcoal" />
        {!isFieldBound && el.content.includes("{") && <span className="mt-1 block normal-case tracking-normal">Tip: words in {"{braces}"} are filled from your details.</span>}
      </label>
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
          Font
          <select
            value={el.style.fontFamily ?? ""}
            onChange={(e) => style({ fontFamily: isFontFamilyId(e.target.value) ? e.target.value : undefined })}
            className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm normal-case tracking-normal text-charcoal"
          >
            <option value="">Design font ({FONT_FAMILIES[fontSet[el.style.fontRole]].label})</option>
            {FONT_FAMILY_IDS.map((id) => (
              <option key={id} value={id}>{FONT_FAMILIES[id].label}</option>
            ))}
          </select>
        </label>
        <NumberInput label="Size" value={el.style.fontSize} min={8} max={600} onChange={(v) => style({ fontSize: Math.max(8, Math.min(600, v)), minFontSize: Math.min(el.style.minFontSize, Math.max(8, v)) }, "size")} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {weights.length > 1 && (
          <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
            Weight
            <select value={el.style.weight} onChange={(e) => style({ weight: Number(e.target.value) as TextElement["style"]["weight"] })} className="mt-1 h-9 rounded-lg border border-line bg-white px-2 text-sm normal-case tracking-normal text-charcoal">
              {weights.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
        )}
        {hasItalic && <IconButton label="Italic" pressed={el.style.italic} onClick={() => style({ italic: !el.style.italic })}><Italic aria-hidden className="size-4" /></IconButton>}
        <IconButton label="Align text left" pressed={el.style.align === "left"} onClick={() => style({ align: "left" })}><AlignLeft aria-hidden className="size-4" /></IconButton>
        <IconButton label="Centre text" pressed={el.style.align === "center"} onClick={() => style({ align: "center" })}><AlignCenter aria-hidden className="size-4" /></IconButton>
        <IconButton label="Align text right" pressed={el.style.align === "right"} onClick={() => style({ align: "right" })}><AlignRight aria-hidden className="size-4" /></IconButton>
        <IconButton label="Uppercase" pressed={el.style.transform === "uppercase"} onClick={() => style({ transform: el.style.transform === "uppercase" ? "none" : "uppercase" })}>
          <span className="text-xs font-semibold">AA</span>
        </IconButton>
      </div>
      <ColorPicker value={el.style.color} onChange={(c) => style({ color: c as TextElement["style"]["color"] })} />
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
          Spacing
          <input type="range" min={-0.05} max={0.6} step={0.01} value={el.style.letterSpacing} onChange={(e) => style({ letterSpacing: Number(e.target.value) }, "ls")} className="mt-1 w-full accent-charcoal" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-wide text-gray">
          Line height
          <input type="range" min={0.8} max={2.2} step={0.05} value={el.style.lineHeight} onChange={(e) => style({ lineHeight: Number(e.target.value) }, "lh")} className="mt-1 w-full accent-charcoal" />
        </label>
        <NumberInput label="Max lines" value={el.style.maxLines} min={1} max={30} onChange={(v) => style({ maxLines: Math.max(1, Math.min(30, Math.round(v))) })} />
      </div>
    </div>
  );
}

export function LayersPanel({ elements }: { elements: TemplateElement[] }) {
  const api = useEditorApi();
  const selectedId = useEditor((s) => s.selectedId);
  const format = useEditor((s) => s.project.format);
  const reversed = [...elements].reverse();
  return (
    <ul className="space-y-0.5 p-2" aria-label="Layers (top first)">
      {reversed.map((el) => (
        <li key={el.id} className={cn("flex items-center gap-1 rounded-lg pr-1", selectedId === el.id ? "bg-charcoal text-ivory" : "hover:bg-sand")}>
          <button type="button" onClick={() => api.getState().select(el.id)} aria-current={selectedId === el.id} className={cn("flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm", el.hidden && "opacity-50")}>
            <span className={cn("shrink-0 rounded px-1 text-[10px] uppercase", selectedId === el.id ? "bg-white/15" : "bg-sand")}>{el.type === "decor" ? "art" : el.type}</span>
            <span className="truncate capitalize">{el.name}</span>
            {el.locked && <Lock aria-label="decorative" className="size-3 shrink-0 opacity-60" />}
          </button>
          <button type="button" aria-label={el.hidden ? `Show ${el.name}` : `Hide ${el.name}`} onClick={() => api.getState().apply((p) => patchElement(p, format, el.id, { hidden: !el.hidden }))} className="rounded p-1 hover:bg-black/10">
            {el.hidden ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
