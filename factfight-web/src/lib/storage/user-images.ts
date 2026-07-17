import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

export const MAX_USER_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type UserImageValidation =
  | { readonly ok: true; readonly file: File | null }
  | { readonly ok: false; readonly message: string };

export interface UploadedUserImage {
  readonly path: string;
  readonly publicUrl: string;
}

export function validateOptionalUserImage(value: FormDataEntryValue | null): UserImageValidation {
  if (!(value instanceof File) || value.size === 0) return { ok: true, file: null };
  if (!allowedImageTypes.has(value.type)) {
    return { ok: false, message: "Choose a JPG, PNG, or WebP image." };
  }
  if (value.size > MAX_USER_IMAGE_BYTES) {
    return { ok: false, message: "Image must be 5 MB or smaller." };
  }
  return { ok: true, file: value };
}

export async function uploadUserImage(
  bucket: "claim-images" | "evidence-images",
  userId: string,
  folderId: string,
  file: File,
): Promise<UploadedUserImage | null> {
  const extension = allowedImageTypes.get(file.type);
  if (!extension) return null;
  const path = `${userId}/${folderId}/${randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, await file.arrayBuffer(), {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl ? Object.freeze({ path, publicUrl: data.publicUrl }) : null;
}

export async function removeUserImage(
  bucket: "claim-images" | "evidence-images",
  path: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove([path]);
}
