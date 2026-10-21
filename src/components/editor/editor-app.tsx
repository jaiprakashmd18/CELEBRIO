"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CloudOff, Eye, Loader2, Lock, Redo2, ShoppingBag, Undo2, X, AlertTriangle } from "lucide-react";
import { EditorStoreContext, createEditorStore, useEditor, useEditorApi, type EditorInit } from "@/features/editor/store";
import { clearBackup, clearGuestDraft, deleteLocalImage, getLocalImage, loadBackup, loadGuestDraft } from "@/features/editor/guest-storage";
import { hasLocalImages, useAutosave } from "@/features/editor/use-autosave";
import { uploadPhoto } from "@/features/editor/photos";
import { missingRequiredFields } from "@/lib/projects/validate";
import { renderInvitation } from "@/lib/rendering/render";
import { availableFormats, resolveElements } from "@/lib/rendering/scene";
import { FORMAT_SIZES, projectDataSchema, type FormatId, type ProjectData } from "@/lib/templates/schema";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { FitBox } from "@/components/shared/fit-box";
import { InvitationSvg, defaultImageHref } from "@/components/templates/invitation-svg";
import { AdvancedEditor } from "./advanced-editor";
import { AutoEditor } from "./auto-editor";

export interface EditorAppProps extends EditorInit {
  accountsAvailable: boolean;
  resumeGuestDraft: boolean;
}

export function EditorApp(props: EditorAppProps) {
  const { accountsAvailable, resumeGuestDraft, ...init } = props;
  const [store] = useState(() => createEditorStore(init));
  return (
    <EditorStoreContext.Provider value={store}>
      <EditorShell accountsAvailable={accountsAvailable} resumeGuestDraft={resumeGuestDraft} />
    </EditorStoreContext.Provider>
  );
}

function SaveStatus() {
  const state = useEditor((s) => s.saveState);
  const error = useEditor((s) => s.saveError);
  const signedIn = useEditor((s) => s.signedIn);
  const map = {
    idle: { icon: null, text: signedIn ? "Not saved yet" : "Not saved yet" },
    dirty: { icon: <Loader2 aria-hidden className="size-3.5 animate-spin" />, text: "Unsaved changes" },
    saving: { icon: <Loader2 aria-hidden className="size-3.5 animate-spin" />, text: "Saving…" },
    saved: { icon: <Check aria-hidden className="size-3.5 text-success" />, text: "Saved" },
    local: { icon: <Check aria-hidden className="size-3.5" />, text: "Saved on this device" },
    error: { icon: <CloudOff aria-hidden className="size-3.5 text-danger" />, text: "Not saved" },
    conflict: { icon: <AlertTriangle aria-hidden className="size-3.5 text-danger" />, text: "Edited elsewhere" },
  }[state];
  return (
    <p role="status" aria-live="polite" title={error ?? undefined} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", state === "error" || state === "conflict" ? "text-danger" : "text-gray")}>
      {map.icon} {map.text}
    </p>
  );
}

function EditorShell({ accountsAvailable, resumeGuestDraft }: { accountsAvailable: boolean; resumeGuestDraft: boolean }) {
  const api = useEditorApi();
  useAutosave(api);
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const mode = useEditor((s) => s.mode);
  const template = useEditor((s) => s.template);
  const signedIn = useEditor((s) => s.signedIn);
  const projectId = useEditor((s) => s.projectId);
  const purchased = useEditor((s) => s.purchased);
  const title = useEditor((s) => s.title);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const saveError = useEditor((s) => s.saveError);
  const saveState = useEditor((s) => s.saveState);
  const localUrls = useEditor((s) => s.localUrls);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<ProjectData | null>(null);
  const [gate, setGate] = useState<null | "signin" | "missing">(null);
  const started = useRef(false);

  const elements = useMemo(() => resolveElements(definition, project, project.format), [definition, project]);
  const overflow = useMemo(() => renderInvitation(definition, project, { imageHref: defaultImageHref(localUrls) }).overflow, [definition, project, localUrls]);
  const missing = missingRequiredFields(definition, project);

  // One-time startup: guest draft restore, guest → account hand-over, crash recovery.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const s = api.getState();
    (async () => {
      if (!s.projectId) {
        const draft = loadGuestDraft(s.template.slug);
        const parsed = draft ? projectDataSchema.safeParse(draft.project) : null;
        if (!parsed?.success || parsed.data.templateVersion !== s.template.version) return;
        const urls: Record<string, string> = {};
        for (const v of Object.values(parsed.data.images)) {
          if (v?.source.kind !== "local") continue;
          const blob = await getLocalImage(v.source.localId).catch(() => null);
          if (blob) urls[v.source.localId] = URL.createObjectURL(blob);
        }
        for (const [id, url] of Object.entries(urls)) s.setLocalUrl(id, url);
        if (!s.signedIn) {
          api.setState({ project: parsed.data, mode: draft?.mode ?? "auto", saveState: "local" });
          setNotice("Welcome back — we restored the invitation you were working on in this browser.");
          return;
        }
        if (resumeGuestDraft) {
          // Upload the guest's photos to private storage, then save as a real draft.
          let next = parsed.data;
          for (const [key, v] of Object.entries(next.images)) {
            if (v?.source.kind !== "local") continue;
            const blob = await getLocalImage(v.source.localId).catch(() => null);
            if (!blob) {
              const images = { ...next.images };
              delete images[key];
              next = { ...next, images };
              continue;
            }
            try {
              const uploaded = await uploadPhoto(blob, null);
              next = { ...next, images: { ...next.images, [key]: { ...v, source: uploaded.source, width: uploaded.width, height: uploaded.height } } };
              await deleteLocalImage(v.source.localId);
            } catch {
              const images = { ...next.images };
              delete images[key];
              next = { ...next, images };
            }
          }
          api.setState({ mode: draft?.mode ?? "auto" });
          s.apply(() => next, { history: false });
          clearGuestDraft(s.template.slug);
          setNotice("Your invitation has been saved to your account.");
        }
        return;
      }
      const backup = loadBackup(s.projectId);
      if (backup && backup.revision === s.revision && JSON.stringify(backup.project) !== JSON.stringify(s.project)) {
        const parsed = projectDataSchema.safeParse(backup.project);
        if (parsed.success) setRecovery(parsed.data);
      } else if (backup) {
        clearBackup(s.projectId);
      }
    })();
  }, [api, resumeGuestDraft]);

  // Undo / redo shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        api.getState().undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        api.getState().redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  const checkoutHref = projectId ? `/checkout/${projectId}` : null;
  function onUnlock(e: React.MouseEvent) {
    if (missing.length) {
      e.preventDefault();
      setGate("missing");
      return;
    }
    if (!signedIn || !projectId || hasLocalImages(project) || saveState === "dirty" || saveState === "saving") {
      e.preventDefault();
      if (!signedIn) {
        setGate("signin");
      } else {
        if (!projectId) api.getState().apply((p) => ({ ...p }), { history: false });
        setNotice("Saving your invitation… try again in a moment.");
      }
    }
  }
  const nextAfterSignIn = `/editor/new?template=${template.slug}&resume=1`;
  const priceText = template.isFree ? "Free" : `From ${formatMoney(template.priceAmount, template.currency)}`;

  return (
    <div className="flex h-dvh flex-col bg-ivory">
      <header className="flex items-center gap-2 border-b border-line bg-white px-3 py-2 sm:px-4">
        <Link href={signedIn ? "/dashboard/drafts" : `/templates/${template.slug}`} aria-label="Leave editor" className="rounded-full p-2 hover:bg-sand">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <label htmlFor="project-title" className="sr-only">Invitation name</label>
          <input id="project-title" value={title} maxLength={100} onChange={(e) => api.getState().setTitle(e.target.value || "Untitled invitation")} className="w-full max-w-xs truncate rounded-md bg-transparent px-1 font-serif text-lg focus:bg-sand/50 focus:outline-none" />
          <SaveStatus />
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" aria-label="Undo" disabled={!canUndo} onClick={() => api.getState().undo()} className="rounded-full p-2 hover:bg-sand disabled:opacity-30"><Undo2 aria-hidden className="size-5" /></button>
          <button type="button" aria-label="Redo" disabled={!canRedo} onClick={() => api.getState().redo()} className="rounded-full p-2 hover:bg-sand disabled:opacity-30"><Redo2 aria-hidden className="size-5" /></button>
        </div>
        {definition.capabilities.advancedEditor && (
          <div role="group" aria-label="Editing mode" className="hidden rounded-full bg-sand p-1 md:inline-flex">
            {(["auto", "advanced"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => api.getState().setMode(m)} className={cn("rounded-full px-3 py-1.5 text-sm", mode === m ? "bg-white shadow-soft" : "text-gray")}>
                {m === "auto" ? "Simple" : "Advanced"}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm ring-1 ring-line hover:bg-sand">
          <Eye aria-hidden className="size-4" /> <span className="hidden sm:inline">Preview</span>
        </button>
        {purchased ? (
          <Link href="/dashboard/invitations" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-charcoal px-4 text-sm font-medium text-ivory">
            Downloads
          </Link>
        ) : (
          <Link href={checkoutHref ?? "#"} onClick={onUnlock} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-charcoal px-4 text-sm font-medium text-ivory">
            <ShoppingBag aria-hidden className="size-4" /> <span className="hidden sm:inline">Unlock & download</span><span className="sm:hidden">Unlock</span>
          </Link>
        )}
      </header>

      {/* Mobile mode switch + undo */}
      <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-1.5 md:hidden">
        {definition.capabilities.advancedEditor && (
          <div role="group" aria-label="Editing mode" className="inline-flex rounded-full bg-sand p-0.5">
            {(["auto", "advanced"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => api.getState().setMode(m)} className={cn("rounded-full px-3 py-1 text-xs", mode === m ? "bg-white shadow-soft" : "text-gray")}>
                {m === "auto" ? "Simple" : "Advanced"}
              </button>
            ))}
          </div>
        )}
        <div className="flex">
          <button type="button" aria-label="Undo" disabled={!canUndo} onClick={() => api.getState().undo()} className="rounded-full p-1.5 disabled:opacity-30"><Undo2 aria-hidden className="size-4" /></button>
          <button type="button" aria-label="Redo" disabled={!canRedo} onClick={() => api.getState().redo()} className="rounded-full p-1.5 disabled:opacity-30"><Redo2 aria-hidden className="size-4" /></button>
        </div>
      </div>

      {(notice || saveError || recovery || purchased) && (
        <div className="space-y-1 border-b border-line bg-sand/60 px-4 py-2 text-sm">
          {purchased && <p>This invitation is unlocked. Corrections such as names, times or photos are included and your downloads update automatically. Please start a new invitation for a different event.</p>}
          {notice && (
            <p className="flex items-center justify-between gap-2">
              {notice}
              <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="rounded p-1 hover:bg-white"><X aria-hidden className="size-4" /></button>
            </p>
          )}
          {saveError && <p className="text-danger" role="alert">{saveError}</p>}
          {recovery && (
            <p className="flex flex-wrap items-center gap-2">
              We found unsaved changes from your last visit.
              <button type="button" className="font-medium underline" onClick={() => { api.getState().apply(() => recovery); setRecovery(null); }}>Restore them</button>
              <button type="button" className="underline" onClick={() => { const id = api.getState().projectId; if (id) clearBackup(id); setRecovery(null); }}>Discard</button>
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {mode === "advanced" ? (
          <AdvancedEditor elements={elements} />
        ) : (
          <div className="h-full overflow-y-auto lg:grid lg:grid-cols-[minmax(22rem,30rem)_1fr] lg:overflow-hidden">
            <div className="sticky top-0 z-10 h-[40vh] border-b border-line bg-[#ECE8E0] p-3 lg:static lg:order-2 lg:h-full lg:border-0 lg:p-10">
              <LivePreview format={project.format} />
            </div>
            <div className="bg-ivory p-4 sm:p-6 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-line">
              <AutoEditor overflowIds={overflow} />
            </div>
          </div>
        )}
      </div>

      {previewOpen && <PreviewModal onClose={() => setPreviewOpen(false)} priceText={priceText} onUnlock={onUnlock} checkoutHref={checkoutHref} />}
      <ConflictDialog />
      {gate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="gate-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift">
            {gate === "missing" ? (
              <>
                <h2 id="gate-title" className="font-serif text-2xl">A few details are missing</h2>
                <p className="mt-2 text-sm text-gray">Please fill in these before unlocking your invitation:</p>
                <ul className="mt-3 list-disc pl-5 text-sm">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                <div className="mt-6 flex justify-end">
                  <button type="button" autoFocus onClick={() => { setGate(null); api.getState().setMode("auto"); }} className="h-10 rounded-full bg-charcoal px-5 text-sm font-medium text-ivory">Fill them in</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="gate-title" className="font-serif text-2xl">Save your invitation</h2>
                {accountsAvailable ? (
                  <>
                    <p className="mt-2 text-sm text-gray">Create a free account or sign in to save this design and unlock the downloads. Everything you&apos;ve done so far is kept in this browser and will be moved to your account.</p>
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Link href={`/sign-in?next=${encodeURIComponent(nextAfterSignIn)}`} className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm ring-1 ring-line">Sign in</Link>
                      <Link href={`/sign-up?next=${encodeURIComponent(nextAfterSignIn)}`} className="inline-flex h-10 items-center justify-center rounded-full bg-charcoal px-5 text-sm font-medium text-ivory">Create account</Link>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray">Accounts and payments aren&apos;t configured in this environment yet (see the README). Your design is saved in this browser.</p>
                )}
                <button type="button" onClick={() => setGate(null)} className="mt-4 text-sm underline">Keep editing</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LivePreview({ format }: { format: FormatId }) {
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const localUrls = useEditor((s) => s.localUrls);
  const template = useEditor((s) => s.template);
  const { width, height } = FORMAT_SIZES[format];
  return (
    <FitBox ratio={width / height} className="overflow-hidden rounded-lg bg-white shadow-lift">
      <InvitationSvg definition={definition} project={project} idPrefix="live" title={`${template.name} live preview`} localUrls={localUrls} className="h-full" />
    </FitBox>
  );
}

function PreviewModal({ onClose, priceText, onUnlock, checkoutHref }: { onClose: () => void; priceText: string; onUnlock: (e: React.MouseEvent) => void; checkoutHref: string | null }) {
  const definition = useEditor((s) => s.definition);
  const project = useEditor((s) => s.project);
  const localUrls = useEditor((s) => s.localUrls);
  const purchased = useEditor((s) => s.purchased);
  const template = useEditor((s) => s.template);
  const formats = availableFormats(definition);
  const [format, setFormat] = useState<FormatId>(project.format);
  const { width, height } = FORMAT_SIZES[format];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-charcoal/95 text-ivory" role="dialog" aria-modal="true" aria-label="Invitation preview">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div role="group" aria-label="Preview format" className="inline-flex rounded-full bg-white/10 p-1">
          {formats.map((f) => (
            <button key={f} type="button" aria-pressed={f === format} onClick={() => setFormat(f)} className={cn("rounded-full px-3 py-1 text-sm capitalize", f === format ? "bg-ivory text-charcoal" : "text-ivory/80")}>{f}</button>
          ))}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close preview" className="rounded-full p-2 hover:bg-white/10"><X aria-hidden className="size-6" /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="overflow-hidden rounded-lg bg-white" style={{ aspectRatio: `${width} / ${height}`, height: format === "landscape" ? "auto" : "100%", width: format === "landscape" ? "100%" : "auto", maxWidth: "100%", maxHeight: "100%" }}>
          <InvitationSvg definition={definition} project={project} format={format} watermark={!purchased} idPrefix="preview" title={`${template.name} preview`} localUrls={localUrls} className="h-full" />
        </div>
      </div>
      {!purchased && (
        <div className="flex flex-col items-center gap-2 px-4 pb-6 text-center sm:flex-row sm:justify-center">
          <p className="flex items-center gap-1.5 text-sm text-ivory/70"><Lock aria-hidden className="size-4" /> Downloads are watermark-free after unlocking · {priceText}</p>
          <Link href={checkoutHref ?? "#"} onClick={(e) => { onUnlock(e); if (e.defaultPrevented) onClose(); }} className="inline-flex h-10 items-center rounded-full bg-ivory px-5 text-sm font-medium text-charcoal">Unlock & download</Link>
        </div>
      )}
    </div>
  );
}

function ConflictDialog() {
  const api = useEditorApi();
  const conflict = useEditor((s) => s.conflict);
  if (!conflict) return null;
  const theirs = projectDataSchema.safeParse(conflict.projectData);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift">
        <h2 id="conflict-title" className="font-serif text-2xl">Edited in another tab</h2>
        <p className="mt-2 text-sm text-gray">This invitation was saved from another tab or device while you were editing here. Which version would you like to keep?</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={!theirs.success} onClick={() => theirs.success && api.getState().resolveConflict("theirs", theirs.data)} className="h-10 rounded-full px-4 text-sm ring-1 ring-line disabled:opacity-40">Load the latest version</button>
          <button type="button" autoFocus onClick={() => api.getState().resolveConflict("mine")} className="h-10 rounded-full bg-charcoal px-4 text-sm font-medium text-ivory">Keep my version</button>
        </div>
      </div>
    </div>
  );
}
