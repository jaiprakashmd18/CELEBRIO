"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Select } from "@/components/ui/form-controls";

interface Option {
  value: string;
  label: string;
}

export interface GalleryFilterProps {
  action: string;
  values: Record<string, string | undefined>;
  categories?: Option[];
  styles: Option[];
  colors: Option[];
  sorts: Option[];
}

/**
 * Filter bar for the gallery. It is a normal GET form (works without
 * JavaScript); with JavaScript, changing a select applies it immediately.
 */
export function GalleryFilters({ action, values, categories, styles, colors, sorts }: GalleryFilterProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && v) params.set(k, v);
    router.push(`${action}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  const select = (name: string, label: string, options: Option[], all: string) => (
    <div className="min-w-0">
      <label htmlFor={`filter-${name}`} className="sr-only">{label}</label>
      <Select id={`filter-${name}`} name={name} defaultValue={values[name] ?? ""} onChange={apply} className="h-10 text-sm">
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );

  return (
    <form
      ref={formRef}
      action={action}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line sm:p-4"
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray" />
          <label htmlFor="filter-q" className="sr-only">Search templates</label>
          <input id="filter-q" name="q" defaultValue={values.q ?? ""} placeholder="Search by name, occasion or keyword" className="h-11 w-full rounded-full border border-line bg-ivory pl-10 pr-4 text-sm focus:border-charcoal/40 focus:outline-none" />
        </div>
        <button type="submit" className="h-11 rounded-full bg-charcoal px-5 text-sm font-medium text-ivory">Search</button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-gray">
        <SlidersHorizontal aria-hidden className="size-3.5" /> Filters
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {categories && select("category", "Occasion", categories, "All occasions")}
        {select("style", "Style", styles, "Any style")}
        {select("color", "Colour", colors, "Any colour")}
        {select("orientation", "Orientation", [{ value: "portrait", label: "Portrait" }, { value: "square", label: "Square" }, { value: "landscape", label: "Landscape" }], "Any orientation")}
        {select("price", "Price", [{ value: "free", label: "Free" }, { value: "standard", label: "Standard (₹49 and under)" }, { value: "premium", label: "Premium" }], "Any price")}
        {select("sort", "Sort by", sorts, "Newest")}
      </div>
    </form>
  );
}
