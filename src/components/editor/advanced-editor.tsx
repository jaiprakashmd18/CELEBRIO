"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Maximize, Minus, Plus, RotateCcw, SlidersHorizontal, Type, X } from "lucide-react";
import { useEditor, useEditorApi } from "@/features/editor/store";
import { addTextElement, deleteElement, duplicateElement, resetFormat } from "@/lib/projects/edit";
import type { TemplateElement } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";
import { AdvancedCanvas } from "./advanced-canvas";
import { LayersPanel, PropertiesPanel } from "./properties-panel";
import { StyleControls } from "./style-controls";

export function AdvancedEditor({ elements }: { elements: TemplateElement[] }) {
  const api = useEditorApi();
  const selectedId = useEditor((s) => s.selectedId);
  const format = useEditor((s) => s.project.format);
  const [zoom, setZoom] = useState(1);
  const [drawer, setDrawer] = useState<null | "layers" | "props" | "style">(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // On phones, selecting an element opens the edit drawer.
  const [lastSelected, setLastSelected] = useState(selectedId);
  if (selectedId !== lastSelected) {
    setLastSelected(selectedId);
    if (selectedId && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) setDrawer("props");
  }

  const addText = useCallback(() => {
    const r = addTextElement(api.getState().project, format);
    api.getState().apply(() => r.project);
    api.getState().select(r.id);
  }, [api, format]);

  // Duplicate (Ctrl/Cmd+D) and delete (Delete/Backspace) shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const s = api.getState();
      const sel = elements.find((x) => x.id === s.selectedId);
      if (!sel) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !sel.locked) {
        e.preventDefault();
        s.apply((p) => deleteElement(p, p.format, sel.id));
        s.select(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const r = duplicateElement(s.project, s.project.format, sel);
        if (r.id) {
          s.apply(() => r.project);
          s.select(r.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, elements]);

  const toolbar = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={addText} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-charcoal px-3.5 text-sm font-medium text-ivory">
        <Type aria-hidden className="size-4" /> Add text
      </button>
      <div className="mx-1 h-6 w-px bg-line" />
      <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} className="rounded-full p-2 hover:bg-sand"><Minus aria-hidden className="size-4" /></button>
      <button type="button" aria-label="Fit to screen" onClick={() => setZoom(1)} className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs tabular-nums hover:bg-sand"><Maximize aria-hidden className="size-3.5" /> {Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="rounded-full p-2 hover:bg-sand"><Plus aria-hidden className="size-4" /></button>
      <div className="mx-1 h-6 w-px bg-line" />
      <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-sand">
        <RotateCcw aria-hidden className="size-4" /> <span className="hidden sm:inline">Reset layout</span>
      </button>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <aside aria-label="Layers" className="hidden w-64 shrink-0 overflow-y-auto border-r border-line bg-white lg:block">
        <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray">Layers</p>
        <LayersPanel elements={elements} />
        <div className="border-t border-line p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray">Design style</p>
          <StyleControls />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-line bg-white px-3 py-2">{toolbar}</div>
        <div className="min-h-0 flex-1">
          <AdvancedCanvas elements={elements} zoom={zoom} />
        </div>
        {/* Mobile bottom toolbar */}
        <nav aria-label="Editor tools" className="grid grid-cols-3 border-t border-line bg-white lg:hidden">
          {(
            [
              ["layers", "Layers", Layers],
              ["props", "Edit", SlidersHorizontal],
              ["style", "Style", Type],
            ] as const
          ).map(([key, label, Icon]) => (
            <button key={key} type="button" aria-expanded={drawer === key} onClick={() => setDrawer(drawer === key ? null : key)} className={cn("flex flex-col items-center gap-0.5 py-2 text-xs", drawer === key && "text-rose-dark")}>
              <Icon aria-hidden className="size-5" /> {label}
            </button>
          ))}
        </nav>
      </div>
      <aside aria-label="Properties" className="hidden w-80 shrink-0 overflow-y-auto border-l border-line bg-white lg:block">
        <PropertiesPanel elements={elements} />
      </aside>

      {drawer && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[62vh] overflow-y-auto rounded-t-3xl bg-white shadow-lift ring-1 ring-line lg:hidden" role="dialog" aria-modal="false" aria-label={drawer === "layers" ? "Layers" : drawer === "props" ? "Edit element" : "Design style"}>
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-4 py-3">
            <p className="text-sm font-semibold">{drawer === "layers" ? "Layers" : drawer === "props" ? "Edit element" : "Design style"}</p>
            <button type="button" aria-label="Close panel" onClick={() => setDrawer(null)} className="rounded-full p-1.5 hover:bg-sand"><X aria-hidden className="size-5" /></button>
          </div>
          {drawer === "layers" && <LayersPanel elements={elements} />}
          {drawer === "props" && <PropertiesPanel elements={elements} />}
          {drawer === "style" && <div className="p-4"><StyleControls /></div>}
        </div>
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lift">
            <h2 id="reset-title" className="font-serif text-xl">Reset this layout?</h2>
            <p className="mt-2 text-sm text-gray">Moved, resized, restyled and added elements in this format go back to the template. Your names, details and photos are kept. You can undo this.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmReset(false)} className="h-10 rounded-full px-4 text-sm ring-1 ring-line">Cancel</button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  api.getState().apply((p) => resetFormat(p, p.format));
                  api.getState().select(null);
                  setConfirmReset(false);
                }}
                className="h-10 rounded-full bg-charcoal px-4 text-sm font-medium text-ivory"
              >
                Reset layout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
