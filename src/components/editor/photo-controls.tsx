"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useEditor, useEditorApi } from "@/features/editor/store";
import { PhotoError, precheckPhoto, storeGuestPhoto, uploadPhoto } from "@/features/editor/photos";
import { setImage } from "@/lib/projects/edit";
import { computeImagePlacement } from "@/lib/rendering/render";
import { resolveElements } from "@/lib/rendering/scene";
import { SAMPLE_IMAGES, sampleImageUrl } from "@/lib/templates/samples";
import type { ImageValue } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";

function imageUrl(value: ImageValue, localUrls: Record<string, string>): string | null {
  const s = value.source;
  if (s.kind === "sample") return sampleImageUrl(s.id);
  if (s.kind === "asset") return `/api/assets/${s.assetId}`;
  return localUrls[s.localId] ?? null;
}

/** Upload, replace, remove and crop (zoom, fit/fill, drag to reposition) one photo slot. */
export function PhotoControls({ fieldKey, label, help }: { fieldKey: string; label: string; help?: string }) {
  const api = useEditorApi();
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const signedIn = useEditor((s) => s.signedIn);
  const projectId = useEditor((s) => s.projectId);
  const localUrls = useEditor((s) => s.localUrls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const explicit = project.images[fieldKey];
  const sampleId = definition.sampleImages[fieldKey];
  const value: ImageValue | null =
    explicit === undefined
      ? sampleId
        ? { source: { kind: "sample", id: sampleId }, width: SAMPLE_IMAGES[sampleId].width, height: SAMPLE_IMAGES[sampleId].height, fit: "fill", crop: { zoom: 1, offsetX: 0, offsetY: 0 } }
        : null
      : explicit;
  const frame = useMemo(() => resolveElements(definition, project, project.format).find((el) => el.type === "image" && el.field === fieldKey), [definition, project, fieldKey]);

  const update = (next: ImageValue | null | undefined, coalesce?: string) => api.getState().apply((p) => setImage(p, fieldKey, next), { coalesce });
  const crop = (patch: Partial<ImageValue["crop"]>, coalesce = `crop-${fieldKey}`) => value && update({ ...value, crop: { ...value.crop, ...patch } }, coalesce);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      precheckPhoto(file);
      if (signedIn) {
        update(await uploadPhoto(file, projectId));
      } else {
        const { value: v, url } = await storeGuestPhoto(file);
        if (v.source.kind === "local") api.getState().setLocalUrl(v.source.localId, url);
        update(v);
      }
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : "Upload failed. Please check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const url = value ? imageUrl(value, localUrls) : null;
  const inputId = `photo-${fieldKey}`;
  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-gray">{explicit === undefined && sampleId ? "Showing sample artwork" : explicit === null ? "No photo" : "Your photo"}</p>
        </div>
        <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor={inputId} className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-charcoal px-4 text-sm font-medium text-ivory", busy && "pointer-events-none opacity-60")}>
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ImagePlus aria-hidden className="size-4" />}
          {busy ? "Uploading…" : explicit && explicit.source.kind !== "sample" ? "Replace" : "Upload photo"}
        </label>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
      {help && !error && <p className="text-xs text-gray">{help}</p>}

      {value && url && frame && frame.type === "image" && (
        <>
          <CropPad value={value} url={url} frameW={frame.w} frameH={frame.h} round={frame.frame.shape === "circle"} onPan={(offsetX, offsetY) => crop({ offsetX, offsetY })} />
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Photo fit">
            {(["fill", "fit"] as const).map((fit) => (
              <button key={fit} type="button" aria-pressed={value.fit === fit} onClick={() => update({ ...value, fit })} className={cn("h-9 rounded-full text-sm ring-1 ring-line", value.fit === fit ? "bg-charcoal text-ivory ring-charcoal" : "bg-white hover:bg-sand")}>
                {fit === "fill" ? "Fill frame" : "Fit whole photo"}
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-gray">
            Zoom
            <input type="range" min={1} max={4} step={0.01} value={value.crop.zoom} onChange={(e) => crop({ zoom: Number(e.target.value) })} className="mt-1 w-full accent-charcoal" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray">
              Left ↔ right
              <input type="range" min={-1} max={1} step={0.01} value={value.crop.offsetX} onChange={(e) => crop({ offsetX: Number(e.target.value) })} className="mt-1 w-full accent-charcoal" />
            </label>
            <label className="block text-xs font-medium text-gray">
              Up ↕ down
              <input type="range" min={-1} max={1} step={0.01} value={value.crop.offsetY} onChange={(e) => crop({ offsetY: Number(e.target.value) })} className="mt-1 w-full accent-charcoal" />
            </label>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {value && (
          <button type="button" onClick={() => crop({ zoom: 1, offsetX: 0, offsetY: 0 }, "reset")} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-line hover:bg-sand">
            <RotateCcw aria-hidden className="size-3.5" /> Reset crop
          </button>
        )}
        {explicit !== null && (
          <button type="button" onClick={() => update(null)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-line hover:bg-sand">
            <Trash2 aria-hidden className="size-3.5" /> Remove photo
          </button>
        )}
        {explicit !== undefined && sampleId && (
          <button type="button" onClick={() => update(undefined)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 ring-1 ring-line hover:bg-sand">
            <Undo2 aria-hidden className="size-3.5" /> Use sample artwork
          </button>
        )}
      </div>
    </div>
  );
}

/** Shows the frame with the photo inside; drag (mouse or touch) to reposition. */
function CropPad({ value, url, frameW, frameH, round, onPan }: { value: ImageValue; url: string; frameW: number; frameH: number; round: boolean; onPan: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const aspect = frameW / frameH;
  const displayW = aspect >= 1 ? 240 : 240 * aspect;
  const displayH = displayW / aspect;
  const p = computeImagePlacement(value, frameW, frameH);
  const scale = displayW / frameW;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: value.crop.offsetX, oy: value.crop.offsetY };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const freeX = (frameW - p.width) * scale;
    const freeY = (frameH - p.height) * scale;
    const nx = freeX === 0 ? d.ox : d.ox + (2 * (e.clientX - d.x)) / freeX;
    const ny = freeY === 0 ? d.oy : d.oy + (2 * (e.clientY - d.y)) / freeY;
    onPan(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
  }
  return (
    <div className="flex justify-center rounded-xl bg-sand/60 p-3">
      <div
        ref={ref}
        role="img"
        aria-label="Photo position preview. Drag to reposition, or use the sliders below."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className={cn("relative cursor-grab touch-none overflow-hidden bg-white ring-1 ring-line active:cursor-grabbing", round ? "rounded-full" : "rounded-md")}
        style={{ width: displayW, height: displayH }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- private, dynamically positioned photo */}
        <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: p.x * scale, top: p.y * scale, width: p.width * scale, height: p.height * scale }} />
      </div>
    </div>
  );
}
