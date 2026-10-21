"use client";

import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { FormatId, ProjectData, TemplateDefinition } from "@/lib/templates/schema";

export interface TemplateInfo {
  id: string;
  slug: string;
  name: string;
  version: number;
  priceAmount: number;
  multiFormatPriceAmount: number | null;
  currency: string;
  isFree: boolean;
}

export type EditorMode = "auto" | "advanced";
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict" | "local";

export interface EditorInit {
  definition: TemplateDefinition;
  template: TemplateInfo;
  project: ProjectData;
  projectId: string | null;
  revision: number;
  mode: EditorMode;
  signedIn: boolean;
  purchased: boolean;
  title: string;
}

export interface EditorState extends EditorInit {
  past: ProjectData[];
  future: ProjectData[];
  coalesce: { key: string; at: number } | null;
  selectedId: string | null;
  localUrls: Record<string, string>;
  saveState: SaveState;
  saveError: string | null;
  conflict: { revision: number; projectData: unknown } | null;
  changeCounter: number;
  lastSavedAt: number | null;
  apply: (mutator: (p: ProjectData) => ProjectData, opts?: { coalesce?: string; history?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  setMode: (mode: EditorMode) => void;
  select: (id: string | null) => void;
  setFormat: (format: FormatId) => void;
  setLocalUrl: (localId: string, url: string) => void;
  setTitle: (title: string) => void;
  markSaving: () => void;
  markSaved: (revision: number, projectId?: string) => void;
  markLocal: () => void;
  markError: (message: string) => void;
  markConflict: (conflict: { revision: number; projectData: unknown }) => void;
  resolveConflict: (choice: "theirs" | "mine", theirs?: ProjectData) => void;
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 900;

export function createEditorStore(init: EditorInit): StoreApi<EditorState> {
  return createStore<EditorState>((set, get) => ({
    ...init,
    past: [],
    future: [],
    coalesce: null,
    selectedId: null,
    localUrls: {},
    saveState: init.projectId ? "saved" : "idle",
    saveError: null,
    conflict: null,
    changeCounter: 0,
    lastSavedAt: null,

    apply(mutator, opts = {}) {
      const state = get();
      const next = mutator(state.project);
      if (next === state.project) return;
      const now = Date.now();
      const record = opts.history !== false;
      const coalescing = record && opts.coalesce && state.coalesce?.key === opts.coalesce && now - state.coalesce.at < COALESCE_MS;
      set({
        project: next,
        past: record && !coalescing ? [...state.past, state.project].slice(-HISTORY_LIMIT) : state.past,
        future: record ? [] : state.future,
        coalesce: opts.coalesce ? { key: opts.coalesce, at: now } : null,
        changeCounter: state.changeCounter + 1,
        saveState: state.saveState === "conflict" ? "conflict" : "dirty",
      });
    },
    undo() {
      const { past, project, future, changeCounter } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({ project: previous, past: past.slice(0, -1), future: [project, ...future], coalesce: null, changeCounter: changeCounter + 1, saveState: "dirty" });
    },
    redo() {
      const { past, project, future, changeCounter } = get();
      const next = future[0];
      if (!next) return;
      set({ project: next, past: [...past, project], future: future.slice(1), coalesce: null, changeCounter: changeCounter + 1, saveState: "dirty" });
    },
    setMode(mode) {
      set({ mode, selectedId: null, changeCounter: get().changeCounter + 1, saveState: "dirty" });
    },
    select(id) {
      set({ selectedId: id });
    },
    setFormat(format) {
      get().apply((p) => ({ ...p, format }));
      set({ selectedId: null });
    },
    setLocalUrl(localId, url) {
      set({ localUrls: { ...get().localUrls, [localId]: url } });
    },
    setTitle(title) {
      set({ title, changeCounter: get().changeCounter + 1, saveState: "dirty" });
    },
    markSaving() {
      set({ saveState: "saving", saveError: null });
    },
    markSaved(revision, projectId) {
      set({ revision, projectId: projectId ?? get().projectId, saveState: "saved", saveError: null, lastSavedAt: Date.now() });
    },
    markLocal() {
      set({ saveState: "local", lastSavedAt: Date.now() });
    },
    markError(message) {
      set({ saveState: "error", saveError: message });
    },
    markConflict(conflict) {
      set({ saveState: "conflict", conflict });
    },
    resolveConflict(choice, theirs) {
      const { conflict } = get();
      if (!conflict) return;
      if (choice === "theirs" && theirs) {
        set({ project: theirs, revision: conflict.revision, conflict: null, past: [], future: [], saveState: "saved" });
      } else {
        // Keep this tab's version: adopt the latest revision number and save again.
        set({ revision: conflict.revision, conflict: null, saveState: "dirty", changeCounter: get().changeCounter + 1 });
      }
    },
  }));
}

export const EditorStoreContext = createContext<StoreApi<EditorState> | null>(null);

export function useEditor<T>(selector: (s: EditorState) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditor must be used inside <EditorStoreContext>");
  return useStore(store, selector);
}

export function useEditorApi(): StoreApi<EditorState> {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorApi must be used inside <EditorStoreContext>");
  return store;
}
