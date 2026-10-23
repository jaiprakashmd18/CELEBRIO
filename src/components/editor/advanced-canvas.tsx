"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditor, useEditorApi } from "@/features/editor/store";
import { clampGeometry, patchElement } from "@/lib/projects/edit";
import { FORMAT_SIZES, type TemplateElement } from "@/lib/templates/schema";
import { InvitationSvg } from "@/components/templates/invitation-svg";

type Handle = "nw" | "ne" | "sw" | "se" | "e" | "w";

interface DragState {
  id: string;
  kind: "move" | Handle;
  startX: number;
  startY: number;
  orig: { x: number; y: number; w: number; h: number };
  key: string;
}

const SNAP = 10;

/**
 * The design canvas: the real rendered invitation with a transparent overlay
 * for selecting, dragging and resizing elements. Works with mouse, touch and pen.
 */
export function AdvancedCanvas({ elements, zoom, onFitScale }: { elements: TemplateElement[]; zoom: number; onFitScale?: (s: number) => void }) {
  const api = useEditorApi();
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const localUrls = useEditor((s) => s.localUrls);
  const template = useEditor((s) => s.template);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState | null>(null);
  const dragCount = useRef(0);
  const [fit, setFit] = useState(0.3);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const { width: W, height: H } = FORMAT_SIZES[project.format];

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.min((el.clientWidth - 32) / W, (el.clientHeight - 32) / H);
      const next = Math.max(0.05, s);
      setFit(next);
      onFitScale?.(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H, onFitScale]);

  const scale = fit * zoom;

  function toSvg(e: { clientX: number; clientY: number }) {
    const svg = overlayRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  function begin(e: React.PointerEvent, el: TemplateElement, kind: DragState["kind"]) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    api.getState().select(el.id);
    const p = toSvg(e);
    drag.current = { id: el.id, kind, startX: p.x, startY: p.y, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, key: `drag-${el.id}-${++dragCount.current}` };
  }

  function onHandleDown(e: React.PointerEvent<SVGRectElement>) {
    const sel = elements.find((x) => x.id === api.getState().selectedId);
    const kind = e.currentTarget.dataset.handle as Handle | undefined;
    if (sel && kind) begin(e, sel, kind);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    const o = d.orig;
    let patch: { x?: number; y?: number; w?: number; h?: number };
    if (d.kind === "move") {
      let x = o.x + dx;
      let y = o.y + dy;
      const snapV = Math.abs(x + o.w / 2 - W / 2) < SNAP;
      const snapH = Math.abs(y + o.h / 2 - H / 2) < SNAP;
      if (snapV) x = W / 2 - o.w / 2;
      if (snapH) y = H / 2 - o.h / 2;
      setGuides({ v: snapV, h: snapH });
      patch = { x, y };
    } else {
      const left = d.kind === "nw" || d.kind === "sw" || d.kind === "w";
      const top = d.kind === "nw" || d.kind === "ne";
      const vertical = d.kind !== "e" && d.kind !== "w";
      const w = Math.max(20, left ? o.w - dx : o.w + dx);
      const h = vertical ? Math.max(20, top ? o.h - dy : o.h + dy) : o.h;
      patch = { w, h, x: left ? o.x + (o.w - w) : o.x, y: top ? o.y + (o.h - h) : o.y };
    }
    const current = elements.find((x) => x.id === d.id);
    if (!current) return;
    const safe = clampGeometry(patch, current, project.format);
    api.getState().apply((pd) => patchElement(pd, pd.format, d.id, safe), { coalesce: d.key });
  }

  function end() {
    drag.current = null;
    setGuides({ v: false, h: false });
  }

  // Keyboard: arrows move, Delete hides/removes, Escape deselects.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      const s = api.getState();
      const sel = elements.find((x) => x.id === s.selectedId);
      if (!sel) return;
      const step = e.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const delta = deltas[e.key];
      if (delta) {
        e.preventDefault();
        s.apply((pd) => patchElement(pd, pd.format, sel.id, clampGeometry({ x: sel.x + delta[0], y: sel.y + delta[1] }, sel, pd.format)), { coalesce: `nudge-${sel.id}` });
      } else if (e.key === "Escape") {
        s.select(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, elements]);

  const selected = elements.find((x) => x.id === selectedId && !x.hidden);
  const hs = 14 / scale;
  const stroke = 2 / scale;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-[var(--color-canvas)]" onPointerDown={() => api.getState().select(null)}>
      <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: W * scale + 32, height: H * scale + 32 }}>
        <div className="relative shadow-lift" style={{ width: W * scale, height: H * scale }}>
          <InvitationSvg definition={definition} project={project} idPrefix="canvas" title={`${template.name} — editing canvas`} localUrls={localUrls} className="absolute inset-0 h-full" />
          <svg
            ref={overlayRef}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-hidden
          >
            {elements.map((el) =>
              el.hidden || el.locked ? null : (
                <rect
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  transform={el.rotation ? `rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})` : undefined}
                  fill="transparent"
                  className="cursor-move hover:stroke-[#C98283]"
                  strokeWidth={stroke}
                  onPointerDown={(e) => begin(e, el, "move")}
                />
              ),
            )}
            {guides.v && <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke="#C98283" strokeWidth={stroke} strokeDasharray={`${8 / scale} ${6 / scale}`} />}
            {guides.h && <line y1={H / 2} y2={H / 2} x1={0} x2={W} stroke="#C98283" strokeWidth={stroke} strokeDasharray={`${8 / scale} ${6 / scale}`} />}
            {selected && (
              <g transform={selected.rotation ? `rotate(${selected.rotation} ${selected.x + selected.w / 2} ${selected.y + selected.h / 2})` : undefined}>
                <rect x={selected.x} y={selected.y} width={selected.w} height={selected.h} fill="none" stroke="#20201F" strokeWidth={stroke} strokeDasharray={`${6 / scale} ${4 / scale}`} pointerEvents="none" />
                {!selected.locked &&
                  (
                    [
                      ["nw", selected.x, selected.y, "nwse-resize"],
                      ["ne", selected.x + selected.w, selected.y, "nesw-resize"],
                      ["sw", selected.x, selected.y + selected.h, "nesw-resize"],
                      ["se", selected.x + selected.w, selected.y + selected.h, "nwse-resize"],
                      ["w", selected.x, selected.y + selected.h / 2, "ew-resize"],
                      ["e", selected.x + selected.w, selected.y + selected.h / 2, "ew-resize"],
                    ] as Array<[Handle, number, number, string]>
                  ).map(([kind, x, y, cursor]) => (
                    <rect key={kind} x={x - hs / 2} y={y - hs / 2} width={hs} height={hs} rx={hs / 4} fill="#FFFFFF" stroke="#20201F" strokeWidth={stroke} style={{ cursor }} data-handle={kind} onPointerDown={onHandleDown} />
                  ))}
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
