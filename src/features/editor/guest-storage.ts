"use client";

/**
 * Browser-only storage for guests (not signed in) and crash recovery.
 *  - Draft JSON lives in localStorage.
 *  - Guest photos live in IndexedDB (they can be several MB) until the guest
 *    signs in, when they are uploaded to private storage and removed here.
 * No authentication tokens are ever stored here.
 */
import type { ProjectData } from "@/lib/templates/schema";

const DB_NAME = "celebrio";
const STORE = "guest-images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putLocalImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalImage(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalImage(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

interface StoredDraft {
  project: ProjectData;
  savedAt: number;
  revision?: number;
  mode?: "auto" | "advanced";
}

function read(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: StoredDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled — the editor keeps working, only recovery is lost.
  }
}

export const guestDraftKey = (slug: string) => `celebrio:guest:${slug}`;
export const backupKey = (projectId: string) => `celebrio:backup:${projectId}`;

export const loadGuestDraft = (slug: string) => read(guestDraftKey(slug));
export const saveGuestDraft = (slug: string, project: ProjectData, mode: "auto" | "advanced") => write(guestDraftKey(slug), { project, savedAt: Date.now(), mode });
export const clearGuestDraft = (slug: string) => {
  try {
    window.localStorage.removeItem(guestDraftKey(slug));
  } catch {}
};

export const loadBackup = (projectId: string) => read(backupKey(projectId));
export const saveBackup = (projectId: string, project: ProjectData, revision: number) => write(backupKey(projectId), { project, savedAt: Date.now(), revision });
export const clearBackup = (projectId: string) => {
  try {
    window.localStorage.removeItem(backupKey(projectId));
  } catch {}
};

export function newLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Downscales a guest photo in the browser so local storage stays small. */
export async function downscaleImage(file: Blob, maxSide = 2000): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.88));
  return { blob, width, height };
}
