// PHASE 5 STEP 6
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";

export type ImageUploadBucket = "claim-images" | "evidence-images" | "profile-avatars";
export type ImagePickSource = "library" | "camera";

const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const LARGE_WARNING_BYTES = 5 * 1024 * 1024;
const MAIN_MAX_WIDTH = 1280;
const THUMB_MAX_WIDTH = 400;
const MAIN_QUALITY = 0.75;
const THUMB_QUALITY = 0.65;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "heif", "webp"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

export interface PickedOptimizedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  warning?: string | null;
}

export interface UploadedImageResult {
  imageUrl: string;
  imagePath: string;
  thumbnailUrl: string;
}

interface PickAndUploadImageInput {
  bucket: ImageUploadBucket;
  folder: string;
  oldPath?: string | null;
  oldThumbnailPath?: string | null;
  source?: ImagePickSource;
  fixedBaseName?: string;
}

function normalizeFolder(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}

function getExtension(asset: PickedOptimizedImage): string {
  const fromFile = asset.fileName?.split(".").pop()?.toLowerCase();

  if (fromFile) {
    return fromFile;
  }

  const fromUri = asset.uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  return fromUri || "jpg";
}

function isSupportedImage(asset: PickedOptimizedImage): boolean {
  const mimeType = asset.mimeType?.toLowerCase();
  const extension = getExtension(asset);

  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return ALLOWED_EXTENSIONS.has(extension);
}

function getImageUploadErrorMessage(message: string): string {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("bucket not found")) {
    return "Image storage is not configured yet.";
  }

  if (normalizedMessage.includes("row-level security") || normalizedMessage.includes("policy")) {
    return "You are not allowed to upload this image.";
  }

  if (normalizedMessage.includes("payload too large") || normalizedMessage.includes("file size")) {
    return "Image must be under the storage size limit.";
  }

  return "Could not upload image. Please try again.";
}

async function getFileBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

async function getImageByteSize(asset: PickedOptimizedImage): Promise<number> {
  if (typeof asset.fileSize === "number" && Number.isFinite(asset.fileSize)) {
    return asset.fileSize;
  }

  const bytes = await getFileBytes(asset.uri);
  return bytes.byteLength;
}

function mapPickedAsset(asset: ImagePicker.ImagePickerAsset): PickedOptimizedImage {
  const fileSize = typeof asset.fileSize === "number" ? asset.fileSize : null;

  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
    fileName: asset.fileName ?? null,
    fileSize,
    width: asset.width,
    height: asset.height,
    warning: fileSize && fileSize > LARGE_WARNING_BYTES ? "Large image. FactLens will compress it before upload." : null,
  };
}

async function pickImage(source: ImagePickSource): Promise<PickedOptimizedImage | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(source === "camera" ? "Camera permission is required." : "Photo library permission is required.");
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          allowsMultipleSelection: false,
          quality: 1,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          allowsMultipleSelection: false,
          quality: 1,
        });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset?.uri) {
    return null;
  }

  if (asset.type && asset.type !== "image") {
    throw new Error("Please choose a JPG, PNG, or HEIC image.");
  }

  const pickedImage = mapPickedAsset(asset);

  if (!isSupportedImage(pickedImage)) {
    throw new Error("Please choose a JPG, PNG, or HEIC image.");
  }

  const size = await getImageByteSize(pickedImage);

  if (size > MAX_ORIGINAL_BYTES) {
    throw new Error("Image must be under 10MB.");
  }

  return {
    ...pickedImage,
    fileSize: size,
    warning: size > LARGE_WARNING_BYTES ? "Large image. FactLens will compress it before upload." : pickedImage.warning,
  };
}

async function manipulateToJpeg(uri: string, width: number, quality: number): Promise<ArrayBuffer> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return getFileBytes(result.uri);
}

async function uploadJpeg(bucket: ImageUploadBucket, path: string, bytes: ArrayBuffer, upsert: boolean) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: "image/jpeg",
    upsert,
  });

  if (error) {
    throw new Error(getImageUploadErrorMessage(error.message));
  }

  return data.path;
}

function getPublicUrl(bucket: ImageUploadBucket, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function removeStoragePaths(bucket: ImageUploadBucket, paths: Array<string | null | undefined>) {
  const uniquePaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);

  if (error) {
    console.log("[image upload] old image cleanup failed:", error.message);
  }
}

export async function pickImageFromLibrary(): Promise<PickedOptimizedImage | null> {
  return pickImage("library");
}

export async function pickImageFromCamera(): Promise<PickedOptimizedImage | null> {
  return pickImage("camera");
}

export function formatImageSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return "Size unknown";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function pickAndUploadImage({
  bucket,
  folder,
  oldPath,
  oldThumbnailPath,
  source = "library",
  fixedBaseName,
}: PickAndUploadImageInput): Promise<UploadedImageResult | null> {
  const image = await pickImage(source);

  if (!image) {
    return null;
  }

  return uploadPickedImage({
    bucket,
    folder,
    image,
    oldPath,
    oldThumbnailPath,
    fixedBaseName,
  });
}

export async function uploadPickedImage({
  bucket,
  folder,
  image,
  oldPath,
  oldThumbnailPath,
  fixedBaseName,
}: Omit<PickAndUploadImageInput, "source"> & { image: PickedOptimizedImage }): Promise<UploadedImageResult> {
  if (!isSupportedImage(image)) {
    throw new Error("Please choose a JPG, PNG, or HEIC image.");
  }

  const originalSize = await getImageByteSize(image);

  if (originalSize > MAX_ORIGINAL_BYTES) {
    throw new Error("Image must be under 10MB.");
  }

  const normalizedFolder = normalizeFolder(folder);
  const timestamp = Date.now();
  const baseName = fixedBaseName ?? String(timestamp);
  const imagePath = `${normalizedFolder}/${baseName}.jpg`;
  const thumbnailPath = `${normalizedFolder}/${baseName}_thumb.jpg`;
  const upsert = Boolean(fixedBaseName);
  const mainBytes = await manipulateToJpeg(image.uri, MAIN_MAX_WIDTH, MAIN_QUALITY);
  const thumbBytes = await manipulateToJpeg(image.uri, THUMB_MAX_WIDTH, THUMB_QUALITY);

  console.log("[image upload] optimized sizes:", {
    bucket,
    originalBytes: originalSize,
    mainBytes: mainBytes.byteLength,
    thumbnailBytes: thumbBytes.byteLength,
  });

  const uploadedImagePath = await uploadJpeg(bucket, imagePath, mainBytes, upsert);
  const uploadedThumbnailPath = await uploadJpeg(bucket, thumbnailPath, thumbBytes, upsert);
  const pathsToDelete = [oldPath, oldThumbnailPath].filter(
    (path) => path && path !== uploadedImagePath && path !== uploadedThumbnailPath,
  );
  await removeStoragePaths(bucket, pathsToDelete);

  return {
    imageUrl: getPublicUrl(bucket, uploadedImagePath),
    imagePath: uploadedImagePath,
    thumbnailUrl: getPublicUrl(bucket, uploadedThumbnailPath),
  };
}

export async function uploadClaimImage(
  userId: string,
  claimId: string,
  image: PickedOptimizedImage,
): Promise<UploadedImageResult> {
  return uploadPickedImage({
    bucket: "claim-images",
    folder: `${userId}/${claimId}`,
    image,
  });
}

export async function uploadEvidenceImage(
  userId: string,
  evidenceId: string,
  image: PickedOptimizedImage,
): Promise<UploadedImageResult> {
  return uploadPickedImage({
    bucket: "evidence-images",
    folder: `${userId}/${evidenceId}`,
    image,
  });
}

export async function uploadProfileAvatar(
  userId: string,
  image: PickedOptimizedImage,
  oldPath?: string | null,
  oldThumbnailPath?: string | null,
): Promise<UploadedImageResult> {
  return uploadPickedImage({
    bucket: "profile-avatars",
    folder: userId,
    image,
    oldPath,
    oldThumbnailPath,
    fixedBaseName: "avatar",
  });
}
