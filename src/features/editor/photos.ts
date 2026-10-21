"use client";

import type { ImageValue } from "@/lib/templates/schema";
import { downscaleImage, newLocalId, putLocalImage } from "./guest-storage";

export const MAX_UPLOAD_BYTES = 8_000_000;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export class PhotoError extends Error {}

export function precheckPhoto(file: File) {
  if (!ALLOWED.includes(file.type)) throw new PhotoError("Please choose a JPEG, PNG or WebP photo.");
  if (file.size > MAX_UPLOAD_BYTES) throw new PhotoError("Photos can be up to 8 MB. Try a smaller image.");
}

export function freshImageValue(source: ImageValue["source"], width: number, height: number): ImageValue {
  return { source, width, height, fit: "fill", crop: { zoom: 1, offsetX: 0, offsetY: 0 } };
}

/** Signed-in users: upload to the server, which validates and stores privately. */
export async function uploadPhoto(file: Blob, projectId: string | null): Promise<ImageValue> {
  const form = new FormData();
  form.set("file", file, file instanceof File ? file.name : "photo.jpg");
  if (projectId) form.set("projectId", projectId);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PhotoError(body?.error?.message ?? "Upload failed. Please try again.");
  return freshImageValue({ kind: "asset", assetId: body.assetId }, body.width, body.height);
}

/** Guests: keep a downscaled copy in this browser until they sign in. */
export async function storeGuestPhoto(file: File): Promise<{ value: ImageValue; url: string }> {
  let result;
  try {
    result = await downscaleImage(file);
  } catch {
    throw new PhotoError("We couldn't read this image. It may be damaged.");
  }
  if (Math.min(result.width, result.height) < 200) throw new PhotoError("This photo is too small. Please use one at least 200 pixels on each side.");
  const localId = newLocalId();
  await putLocalImage(localId, result.blob);
  return { value: freshImageValue({ kind: "local", localId }, result.width, result.height), url: URL.createObjectURL(result.blob) };
}
