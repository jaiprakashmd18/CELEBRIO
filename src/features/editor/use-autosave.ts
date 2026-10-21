"use client";

import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand";
import type { ProjectData } from "@/lib/templates/schema";
import { clearBackup, clearGuestDraft, saveBackup, saveGuestDraft } from "./guest-storage";
import type { EditorState } from "./store";

const DEBOUNCE_MS = 1200;

async function readError(res: Response): Promise<{ code?: string; message: string; details?: string[]; latestRevision?: number; latestProjectData?: unknown }> {
  const body = await res.json().catch(() => ({}));
  return { message: body?.error?.message ?? "Couldn't save", ...body?.error };
}

/** Saves the project after edits settle; shows saving/saved/error states. */
export function useAutosave(store: StoreApi<EditorState>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("celebrio-projects") : null;

    async function save() {
      const s = store.getState();
      if (s.saveState === "conflict") return;
      if (!s.signedIn) {
        saveGuestDraft(s.template.slug, s.project, s.mode);
        s.markLocal();
        return;
      }
      if (hasLocalImages(s.project)) return; // wait until guest photos are uploaded
      if (inFlight.current) {
        pending.current = true;
        return;
      }
      inFlight.current = true;
      s.markSaving();
      const changeAtStart = s.changeCounter;
      try {
        if (!s.projectId) {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateSlug: s.template.slug, projectData: s.project, editorMode: s.mode, title: s.title }),
          });
          if (!res.ok) {
            const err = await readError(res);
            s.markError(err.details?.[0] ?? err.message);
          } else {
            const { id, revision } = (await res.json()) as { id: string; revision: number };
            store.getState().markSaved(revision, id);
            clearGuestDraft(s.template.slug);
            window.history.replaceState(null, "", `/editor/${id}${window.location.search.includes("mode=advanced") ? "?mode=advanced" : ""}`);
          }
        } else {
          saveBackup(s.projectId, s.project, s.revision);
          const res = await fetch(`/api/projects/${s.projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revision: s.revision, projectData: s.project, editorMode: s.mode, title: s.title }),
          });
          if (res.status === 409) {
            const err = await readError(res);
            store.getState().markConflict({ revision: err.latestRevision ?? s.revision, projectData: err.latestProjectData });
          } else if (!res.ok) {
            const err = await readError(res);
            store.getState().markError(err.details?.[0] ?? err.message);
          } else {
            const { revision } = (await res.json()) as { revision: number };
            store.getState().markSaved(revision);
            if (store.getState().changeCounter === changeAtStart) clearBackup(s.projectId);
            channel?.postMessage({ type: "saved", projectId: s.projectId, revision });
          }
        }
      } catch {
        store.getState().markError("You appear to be offline. Your changes are kept on this device and will save when you reconnect.");
      } finally {
        inFlight.current = false;
        const after = store.getState();
        if (pending.current || after.changeCounter !== changeAtStart) {
          pending.current = false;
          if (after.saveState !== "conflict" && after.saveState !== "error") schedule();
        }
      }
    }

    function schedule() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(save, DEBOUNCE_MS);
    }

    let lastCounter = store.getState().changeCounter;
    const unsubscribe = store.subscribe((state) => {
      if (state.changeCounter !== lastCounter) {
        lastCounter = state.changeCounter;
        if (state.projectId && state.signedIn) saveBackup(state.projectId, state.project, state.revision);
        schedule();
      }
    });

    // Another tab saved this project: if we have no unsaved edits, load theirs.
    channel?.addEventListener("message", async (event: MessageEvent<{ type: string; projectId: string; revision: number }>) => {
      const s = store.getState();
      if (event.data?.type !== "saved" || event.data.projectId !== s.projectId || event.data.revision <= s.revision) return;
      if (s.saveState === "saved") {
        const res = await fetch(`/api/projects/${s.projectId}`, { cache: "no-store" });
        if (res.ok) {
          const latest = (await res.json()) as { revision: number; projectData: ProjectData };
          store.setState({ project: latest.projectData, revision: latest.revision, past: [], future: [] });
        }
      }
    });

    const onOnline = () => {
      if (store.getState().saveState === "error") schedule();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const st = store.getState().saveState;
      if (st === "dirty" || st === "saving" || st === "error" || st === "conflict") {
        e.preventDefault();
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsubscribe();
      channel?.close();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [store]);

}

export function hasLocalImages(project: ProjectData): boolean {
  return Object.values(project.images).some((v) => v?.source.kind === "local");
}
