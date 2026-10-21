"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Renders children at the largest size with the given aspect ratio that fits the parent. */
export function FitBox({ ratio, children, className }: { ratio: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      const w = Math.min(cw, ch * ratio);
      setSize({ w, h: w / ratio });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {size && (
        <div className={className} style={{ width: size.w, height: size.h }}>
          {children}
        </div>
      )}
    </div>
  );
}
