"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClaim } from "@/lib/api/claim-mutations";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { removeUserImage, uploadUserImage, validateOptionalUserImage } from "@/lib/storage/user-images";
import { createClient } from "@/lib/supabase/server";
import { createClaimSchema } from "@/lib/validation/claim-actions";

export type CreateClaimActionState = {
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function createClaimAction(
  _previousState: CreateClaimActionState,
  formData: FormData,
): Promise<CreateClaimActionState> {
  const parsed = createClaimSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    sourceUrl: formData.get("sourceUrl"),
    videoUrl: formData.get("videoUrl"),
    category: formData.get("category"),
    subCategory: formData.get("subCategory"),
    politicianTag: formData.get("politicianTag"),
    permanenceAccepted: formData.get("permanenceAccepted"),
  });
  const image = validateOptionalUserImage(formData.get("claimImage"));

  if (!parsed.success || !image.ok) {
    return {
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        ...(parsed.success ? {} : parsed.error.flatten().fieldErrors),
        ...(!image.ok ? { claimImage: [image.message] } : {}),
      },
    };
  }

  const session = await getVerifiedSession();
  if (!session.ok) {
    return { message: session.message };
  }

  const supabase = await createClient();
  const { count: claimCountBefore, error: claimCountError } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("author_id", session.userId);
  const isFirstClaim = !claimCountError && claimCountBefore === 0;

  let uploadedImage: Awaited<ReturnType<typeof uploadUserImage>> = null;
  if (image.file) {
    uploadedImage = await uploadUserImage("claim-images", session.userId, crypto.randomUUID(), image.file);
    if (!uploadedImage) return { message: "Could not upload this image. Try another image or post without it." };
  }

  const result = await createClaim(
    session.accessToken,
    parsed.data,
    uploadedImage
      ? { imageUrl: uploadedImage.publicUrl, imagePath: uploadedImage.path, thumbnailUrl: uploadedImage.publicUrl }
      : undefined,
  );
  if (!result.ok) {
    if (uploadedImage) await removeUserImage("claim-images", uploadedImage.path);
    return { message: result.message };
  }

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/sitemap.xml");
  redirect(`/claim/${result.data.id}${isFirstClaim ? "?firstClaim=1" : ""}`);
}
