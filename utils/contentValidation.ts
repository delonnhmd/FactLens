// PHASE 3 STEP 8
import { PROHIBITED_CONTENT } from "../constants/contentRules";
import { isSupportedVideoUrl, isValidWebUrl, normalizeUrl } from "./videoUrl";

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

function containsProhibitedTerm(value: string): boolean {
  const normalizedValue = value.toLowerCase();
  return PROHIBITED_CONTENT.some((term) => normalizedValue.includes(term.toLowerCase()));
}

export function validateClaimContent(input: ClaimContentValidationInput): ClaimContentValidationResult {
  const errors: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const videoUrl = normalizeUrl(input.videoUrl ?? "");
  const category = input.category?.trim() ?? "";

  if (!title) {
    errors.push("Title is required.");
  } else if (title.length < 10) {
    errors.push("Title must be at least 10 characters.");
  } else if (title.length > 160) {
    errors.push("Title must be 160 characters or fewer.");
  }

  if (!description) {
    errors.push("Description is required.");
  } else if (description.length < 20) {
    errors.push("Description must be at least 20 characters.");
  } else if (description.length > 1000) {
    errors.push("Description must be 1000 characters or fewer.");
  }

  if (!sourceUrl) {
    errors.push("Source URL is required.");
  } else if (!isValidWebUrl(sourceUrl)) {
    errors.push("Enter a valid source URL, like apple.com or www.google.com.");
  }

  if (videoUrl && !isSupportedVideoUrl(videoUrl)) {
    errors.push("Enter a valid video URL, like youtube.com/watch or tiktok.com/@user/video.");
  }

  if (!category) {
    errors.push("Category is required.");
  }

  if (containsProhibitedTerm(`${title} ${description}`)) {
    errors.push("This content is not allowed on FactLens.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
