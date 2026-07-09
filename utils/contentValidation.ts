// PHASE 3 STEP 8
// PHASE 3 STEP 28
// PHASE 4 STEP 11 REVISED
// PHASE 4 STEP 13B
import { APP_CONFIG } from "../constants/appConfig";
import { checkClaimSafety } from "./claimSafety";
import { moderateNsfwContent } from "./nsfwModeration";
import { isSupportedVideoUrl } from "./videoUrl";
import { isValidSourceUrl, normalizeUrl } from "./url";

export interface ClaimContentValidationInput {
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
  category?: string;
}

interface ClaimContentValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateClaimContent(input: ClaimContentValidationInput): ClaimContentValidationResult {
  const errors: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const videoUrl = normalizeUrl(input.videoUrl ?? "");

  if (!title) {
    errors.push("Title is required.");
  } else if (title.length > 160) {
    errors.push("Title must be 160 characters or fewer.");
  }

  if (!description) {
    errors.push("Description is required.");
  } else if (description.length > 1000) {
    errors.push("Description must be 1000 characters or fewer.");
  }

  if (!sourceUrl && !APP_CONFIG.TEST_MODE) {
    errors.push("Source URL is required.");
  } else if (sourceUrl && !isValidSourceUrl(sourceUrl)) {
    errors.push("Enter a valid source URL.");
  }

  if (videoUrl && !isSupportedVideoUrl(videoUrl)) {
    errors.push("Enter a valid video URL, like youtube.com/watch or tiktok.com/@user/video.");
  }

  const combinedContent = `${title} ${description}`;
  const nsfwModeration = moderateNsfwContent(combinedContent);
  const claimSafety = checkClaimSafety(title, description);

  if (claimSafety.allowed === false) {
    errors.push(claimSafety.reason || "This content is not allowed on Verifact.");
  } else if (nsfwModeration.blocked) {
    errors.push("This content is not allowed on Verifact.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
