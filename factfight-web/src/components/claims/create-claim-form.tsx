"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createClaimAction,
  type CreateClaimActionState,
} from "@/app/(main)/create/actions";
import {
  CLAIM_DESCRIPTION_MAX_LENGTH,
  claimCategories,
  politicsSubCategories,
} from "@/lib/validation/claim-actions";

const initialState: CreateClaimActionState = { message: "" };
const inputClassName =
  "mt-2 w-full rounded-[var(--ff-radius-card)] border border-[var(--ff-control-border)] bg-white px-3.5 py-3 text-[var(--ff-text)] placeholder:text-[var(--ff-text-muted)] disabled:cursor-wait disabled:bg-[var(--ff-surface)]";

function firstError(messages: string[] | undefined) {
  return messages?.[0];
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="mt-2 text-sm text-[var(--ff-fake)]" id={id}>
      {message}
    </p>
  ) : null;
}

type TouchedField = "title" | "sourceUrl" | "category" | "politicianTag" | "permanenceAccepted";

export function CreateClaimForm() {
  const [state, formAction, pending] = useActionState(createClaimAction, initialState);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [politicianTag, setPoliticianTag] = useState("");
  const [permanenceAccepted, setPermanenceAccepted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<TouchedField, boolean>>>({});

  const markTouched = (field: TouchedField) =>
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));

  const descriptionLength = description.length;
  const descriptionOverLimit = descriptionLength > CLAIM_DESCRIPTION_MAX_LENGTH;

  const titleError = firstError(state.fieldErrors?.title);
  const descriptionError = firstError(state.fieldErrors?.description);
  const sourceError = firstError(state.fieldErrors?.sourceUrl);
  const videoError = firstError(state.fieldErrors?.videoUrl);
  const categoryError = firstError(state.fieldErrors?.category);
  const subCategoryError = firstError(state.fieldErrors?.subCategory);
  const politicianError = firstError(state.fieldErrors?.politicianTag);
  const permanenceError = firstError(state.fieldErrors?.permanenceAccepted);
  const imageError = firstError(state.fieldErrors?.claimImage);

  // Required for every claim: title, description (within limit), category,
  // source URL, and the permanence acknowledgement. Politician name is only
  // required when the category/subcategory combination calls for it. Video
  // URL and the image are optional. Evidence is added after a claim exists
  // (a separate form on the claim detail page) — not part of creation.
  const politicianRequired = category === "Politics" && subCategory === "Politician";
  const titleMissing = !title.trim();
  const sourceUrlMissing = !sourceUrl.trim();
  const categoryMissing = !category;
  const politicianTagMissing = politicianRequired && !politicianTag.trim();
  const permanenceMissing = !permanenceAccepted;

  const requiredFieldsValid =
    !titleMissing &&
    Boolean(description.trim()) &&
    !descriptionOverLimit &&
    !sourceUrlMissing &&
    !categoryMissing &&
    !politicianTagMissing &&
    !permanenceMissing;

  const submitDisabled = pending || !requiredFieldsValid;

  const titleLiveMessage = touched.title && titleMissing ? "Title is required." : undefined;
  const sourceUrlLiveMessage = touched.sourceUrl && sourceUrlMissing ? "Source URL is required." : undefined;
  const categoryLiveMessage = touched.category && categoryMissing ? "Choose a category." : undefined;
  const politicianLiveMessage =
    touched.politicianTag && politicianTagMissing ? "Enter the politician name." : undefined;
  const permanenceLiveMessage =
    touched.permanenceAccepted && permanenceMissing
      ? "Confirm that you understand when a claim becomes permanent."
      : undefined;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.message ? (
        <p
          aria-live="polite"
          className="rounded-[var(--ff-radius-card)] border border-[color-mix(in_srgb,var(--ff-fake)_35%,var(--ff-border))] bg-[color-mix(in_srgb,var(--ff-fake)_7%,white)] px-4 py-3 text-sm leading-6"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <fieldset className="space-y-6 disabled:opacity-75" disabled={pending}>
        <div>
          <label className="block text-sm font-medium" htmlFor="claim-title">
            Claim title
          </label>
          <input
            aria-describedby={titleError ?? titleLiveMessage ? "claim-title-error" : "claim-title-help"}
            aria-invalid={Boolean(titleError ?? titleLiveMessage)}
            className={inputClassName}
            id="claim-title"
            maxLength={160}
            name="title"
            onBlur={() => markTouched("title")}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="State one specific claim that can be checked"
            required
            value={title}
          />
          <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="claim-title-help">
            Keep it factual and specific. Maximum 160 characters.
          </p>
          <FieldError id="claim-title-error" message={titleError ?? titleLiveMessage} />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="claim-description">
            Description
          </label>
          <textarea
            aria-describedby={
              descriptionError
                ? "claim-description-error"
                : descriptionOverLimit
                  ? "claim-description-limit-warning"
                  : "claim-description-help"
            }
            aria-invalid={Boolean(descriptionError) || descriptionOverLimit}
            className={`${inputClassName} min-h-36 resize-y`}
            id="claim-description"
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context that helps the community understand what should be verified"
            required
            rows={6}
            value={description}
          />
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-xs text-[var(--ff-text-muted)]" id="claim-description-help">
              Maximum {CLAIM_DESCRIPTION_MAX_LENGTH} characters. Do not include private personal information.
            </p>
            <span
              aria-live="polite"
              className={`shrink-0 text-xs tabular-nums ${
                descriptionOverLimit ? "font-medium text-[var(--ff-fake)]" : "text-[var(--ff-text-muted)]"
              }`}
            >
              {descriptionLength} / {CLAIM_DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
          {descriptionOverLimit ? (
            <p className="mt-2 text-sm text-[var(--ff-fake)]" id="claim-description-limit-warning" role="alert">
              Description is {descriptionLength} characters. Please shorten to {CLAIM_DESCRIPTION_MAX_LENGTH} or
              fewer.
            </p>
          ) : null}
          <FieldError id="claim-description-error" message={descriptionError} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="claim-source">
              Source URL
            </label>
            <input
              aria-describedby={sourceError ?? sourceUrlLiveMessage ? "claim-source-error" : "claim-source-help"}
              aria-invalid={Boolean(sourceError ?? sourceUrlLiveMessage)}
              autoCapitalize="none"
              autoCorrect="off"
              className={inputClassName}
              id="claim-source"
              inputMode="url"
              name="sourceUrl"
              onBlur={() => markTouched("sourceUrl")}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com/report"
              required
              type="url"
              value={sourceUrl}
            />
            <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="claim-source-help">
              Link to where the claim appeared or a primary source.
            </p>
            <FieldError id="claim-source-error" message={sourceError ?? sourceUrlLiveMessage} />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="claim-video">
              Video URL <span className="font-normal text-[var(--ff-text-muted)]">(optional)</span>
            </label>
            <input
              aria-describedby={videoError ? "claim-video-error" : undefined}
              aria-invalid={Boolean(videoError)}
              autoCapitalize="none"
              autoCorrect="off"
              className={inputClassName}
              id="claim-video"
              inputMode="url"
              name="videoUrl"
              placeholder="https://youtube.com/watch?v=..."
              type="url"
            />
            <FieldError id="claim-video-error" message={videoError} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="claim-image">Image or screenshot <span className="font-normal text-[var(--ff-text-muted)]">(optional)</span></label>
          <input accept="image/jpeg,image/png,image/webp" aria-describedby={imageError ? "claim-image-error" : "claim-image-help"} aria-invalid={Boolean(imageError)} className={`${inputClassName} file:mr-3 file:rounded-[8px] file:border-0 file:bg-[var(--ff-surface)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--ff-navy)]`} id="claim-image" name="claimImage" type="file" />
          <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="claim-image-help">JPG, PNG, or WebP up to 5 MB.</p>
          <FieldError id="claim-image-error" message={imageError} />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="claim-category">
            Category
          </label>
          <select
            aria-describedby={categoryError ?? categoryLiveMessage ? "claim-category-error" : undefined}
            aria-invalid={Boolean(categoryError ?? categoryLiveMessage)}
            className={inputClassName}
            id="claim-category"
            name="category"
            onBlur={() => markTouched("category")}
            onChange={(event) => {
              setCategory(event.target.value);
              markTouched("category");
              if (event.target.value !== "Politics") setSubCategory("");
            }}
            required
            value={category}
          >
            <option value="">Choose a category</option>
            {claimCategories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FieldError id="claim-category-error" message={categoryError ?? categoryLiveMessage} />
        </div>

        {category === "Politics" ? (
          <div>
            <label className="block text-sm font-medium" htmlFor="claim-subcategory">
              Politics focus <span className="font-normal text-[var(--ff-text-muted)]">(optional)</span>
            </label>
            <select
              aria-describedby={subCategoryError ? "claim-subcategory-error" : undefined}
              aria-invalid={Boolean(subCategoryError)}
              className={inputClassName}
              id="claim-subcategory"
              name="subCategory"
              onChange={(event) => setSubCategory(event.target.value)}
              value={subCategory}
            >
              <option value="">Choose a focus</option>
              {politicsSubCategories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldError id="claim-subcategory-error" message={subCategoryError} />
          </div>
        ) : null}

        {politicianRequired ? (
          <div>
            <label className="block text-sm font-medium" htmlFor="claim-politician">
              Politician name
            </label>
            <input
              aria-describedby={
                politicianError ?? politicianLiveMessage ? "claim-politician-error" : undefined
              }
              aria-invalid={Boolean(politicianError ?? politicianLiveMessage)}
              autoComplete="off"
              className={inputClassName}
              id="claim-politician"
              maxLength={100}
              name="politicianTag"
              onBlur={() => markTouched("politicianTag")}
              onChange={(event) => setPoliticianTag(event.target.value)}
              required
              value={politicianTag}
            />
            <FieldError id="claim-politician-error" message={politicianError ?? politicianLiveMessage} />
          </div>
        ) : null}

        <div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6" htmlFor="claim-permanence">
            <input
              aria-describedby={
                permanenceError ?? permanenceLiveMessage ? "claim-permanence-error" : "claim-permanence-help"
              }
              checked={permanenceAccepted}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--ff-navy)]"
              id="claim-permanence"
              name="permanenceAccepted"
              onBlur={() => markTouched("permanenceAccepted")}
              onChange={(event) => {
                setPermanenceAccepted(event.target.checked);
                markTouched("permanenceAccepted");
              }}
              required
              type="checkbox"
            />
            <span>
              I understand that I can remove this claim within 3 hours. After 3 hours, or once the verdict is finalized, it becomes permanent.
            </span>
          </label>
          <p className="mt-2 pl-7 text-xs leading-5 text-[var(--ff-text-muted)]" id="claim-permanence-help">
            True and Fake votes also count toward the combined total of the related topic.
          </p>
          <FieldError id="claim-permanence-error" message={permanenceError ?? permanenceLiveMessage} />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-white px-5 py-3 text-center text-sm font-medium text-[var(--ff-navy)]"
          href="/feed"
        >
          Cancel
        </Link>
        <button
          aria-disabled={submitDisabled}
          className={`rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-6 py-3 text-sm font-medium text-white disabled:opacity-65 ${
            pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
          }`}
          disabled={submitDisabled}
          type="submit"
        >
          {pending ? "Posting claim…" : descriptionOverLimit ? "Shorten description to post" : "Post claim"}
        </button>
      </div>
    </form>
  );
}
