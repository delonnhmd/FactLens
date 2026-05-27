// PHASE 3 STEP 7
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";

const CLAIM_IMAGES_BUCKET = "claim-images";

export interface PickedClaimImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  width?: number;
  height?: number;
}

function isImageMimeType(mimeType?: string | null): boolean {
  return !mimeType || mimeType.toLowerCase().startsWith("image/");
}

function getImageUploadErrorMessage(message: string): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("bucket not found")) {
    return "Claim image storage is not configured yet.";
  }

  if (normalizedMessage.includes("row-level security") || normalizedMessage.includes("policy")) {
    return "You are not allowed to upload this image.";
  }

  return "We could not upload this image. Please try again.";
}

export async function pickClaimImage(): Promise<PickedClaimImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Photo library permission is required to add an image.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    allowsMultipleSelection: false,
    quality: 0.7,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset?.uri) {
    return null;
  }

  if (asset.type && asset.type !== "image") {
    throw new Error("Only image uploads are allowed for claim screenshots.");
  }

  if (!isImageMimeType(asset.mimeType)) {
    throw new Error("Only image uploads are allowed for claim screenshots.");
  }

  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
  };
}

export async function uploadClaimImage(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<string> {
  if (!isImageMimeType(mimeType)) {
    throw new Error("Only image uploads are allowed for claim screenshots.");
  }

  // TODO PHASE 3 STEP 7: Install expo-image-manipulator to enforce 1200px max width and JPEG compression.
  const response = await fetch(localUri);
  const imageData = await response.arrayBuffer();
  const timestamp = Date.now();
  const storagePath = `${userId}/${timestamp}.jpg`;
  const contentType = mimeType || "image/jpeg";

  const { data, error } = await supabase.storage
    .from(CLAIM_IMAGES_BUCKET)
    .upload(storagePath, imageData, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(getImageUploadErrorMessage(error.message));
  }

  const { data: publicUrlData } = supabase.storage.from(CLAIM_IMAGES_BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}
