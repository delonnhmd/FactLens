import { z } from "zod";

import { getSafeExternalUrl } from "@/lib/utils/urls";

export const claimCategories = [
  "Politics",
  "Business",
  "Crypto",
  "Health",
  "War / Conflict",
  "Technology",
  "Sports",
  "Entertainment",
  "Local News",
  "Other",
] as const;

export const politicsSubCategories = [
  "Election 2026",
  "Policy",
  "Politician",
  "Government",
] as const;

export const voteTypes = ["TRUE", "FAKE", "UNSURE"] as const;
export const reportReasons = [
  "SPAM",
  "FAKE_SOURCE",
  "DUPLICATE_CLAIM",
  "HARMFUL_CONTENT",
  "MISLEADING_TITLE",
  "HARASSMENT_OR_ABUSE",
  "MISINFORMATION_ABUSE",
  "EXPLICIT_CONTENT",
  "MALICIOUS_EVIDENCE",
  "OTHER",
] as const;

function normalizeWebUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const requiredUrlSchema = z
  .string()
  .trim()
  .min(1, "Source URL is required.")
  .max(2_048, "Source URL is too long.")
  .transform(normalizeWebUrl)
  .refine((value) => getSafeExternalUrl(value) !== null, "Enter a valid source URL.");

const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : undefined),
  z
    .string()
    .trim()
    .max(2_048, "Video URL is too long.")
    .transform(normalizeWebUrl)
    .refine((value) => getSafeExternalUrl(value) !== null, "Enter a valid video URL.")
    .optional(),
);

export const createClaimSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(160, "Title must be 160 characters or fewer."),
    description: z
      .string()
      .trim()
      .min(1, "Description is required.")
      .max(1_000, "Description must be 1000 characters or fewer."),
    sourceUrl: requiredUrlSchema,
    videoUrl: optionalUrlSchema,
    category: z.enum(claimCategories, { error: "Choose a category." }),
    subCategory: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value : undefined),
      z.enum(politicsSubCategories).optional(),
    ),
    politicianTag: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().max(100, "Politician name must be 100 characters or fewer.").optional(),
    ),
    permanenceAccepted: z.preprocess(
      (value) => value === true || value === "true" || value === "on",
      z.literal(true, { error: "Confirm that you understand when a claim becomes permanent." }),
    ),
  })
  .superRefine((values, context) => {
    if (values.category !== "Politics" && values.subCategory) {
      context.addIssue({
        code: "custom",
        message: "Politics focus is only available for Politics claims.",
        path: ["subCategory"],
      });
    }

    if (values.category === "Politics" && values.subCategory === "Politician" && !values.politicianTag) {
      context.addIssue({
        code: "custom",
        message: "Enter the politician name.",
        path: ["politicianTag"],
      });
    }
  });

export const voteClaimSchema = z.object({
  claimId: z.uuid("Claim not found."),
  pathIdentifier: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, "Claim not found."),
  voteType: z.enum(voteTypes, { error: "Choose True, Fake, or Unsure." }),
});

const claimTargetSchema = z.object({
  claimId: z.uuid("Claim not found."),
  pathIdentifier: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i, "Claim not found."),
});

export const addEvidenceSchema = claimTargetSchema.extend({
  evidenceType: z.enum(["SUPPORTS_TRUE", "SUPPORTS_FAKE", "ADDS_CONTEXT", "UNCLEAR"]),
  url: requiredUrlSchema,
  note: z
    .string()
    .trim()
    .min(10, "Evidence note must be at least 10 characters.")
    .max(500, "Evidence note must be 500 characters or fewer."),
});

export const reportClaimSchema = claimTargetSchema.extend({
  reason: z.enum(reportReasons, { error: "Choose a report reason." }),
  note: z.string().trim().max(300, "Report details must be 300 characters or fewer."),
});

export const savedClaimSchema = claimTargetSchema;

export const deleteClaimSchema = claimTargetSchema.extend({
  confirmation: z.preprocess(
    (value) => value === "on",
    z.literal(true, { error: "Confirm that you want to permanently remove this claim." }),
  ),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type VoteType = (typeof voteTypes)[number];
