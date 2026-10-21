"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FileType = "png" | "jpeg" | "pdf";
const LABEL: Record<FileType, string> = { png: "PNG", jpeg: "JPEG", pdf: "PDF (print)" };

/** Requests a server-generated, entitlement-checked export and starts the download. */
export function DownloadButtons({ projectId, formats }: { projectId: string; formats: string[] }) {
  const [state, setState] = useState<Record<string, "busy" | "done" | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  async function download(format: string, fileType: FileType) {
    const key = `${format}:${fileType}`;
    setError(null);
    setState((s) => ({ ...s, [key]: "busy" }));
    try {
      const res = await fetch("/api/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, format, fileType }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "We couldn't create your file. Please try again.");
      const a = document.createElement("a");
      a.href = body.url;
      a.download = body.filename ?? "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setState((s) => ({ ...s, [key]: "done" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
      setState((s) => ({ ...s, [key]: undefined }));
    }
  }

  return (
    <div className="space-y-3">
      {formats.map((format) => (
        <div key={format}>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray">{format}</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LABEL) as FileType[]).map((ft) => {
              const s = state[`${format}:${ft}`];
              return (
                <button key={ft} type="button" disabled={s === "busy"} onClick={() => download(format, ft)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-line hover:bg-sand disabled:opacity-60", s === "done" && "ring-success/40")}>
                  {s === "busy" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Download aria-hidden className="size-3.5" />}
                  {s === "busy" ? "Preparing…" : LABEL[ft]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
