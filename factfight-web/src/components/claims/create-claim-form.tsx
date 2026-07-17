"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createClaimAction,
  type CreateClaimActionState,
} from "@/app/(main)/create/actions";
import { claimCategories, politicsSubCategories } from "@/lib/validation/claim-actions";

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

export function CreateClaimForm() {
  const [state, formAction, pending] = useActionState(createClaimAction, initialState);
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const titleError = firstError(state.fieldErrors?.title);
  const descriptionError = firstError(state.fieldErrors?.description);
  const sourceError = firstError(state.fieldErrors?.sourceUrl);
  const videoError = firstError(state.fieldErrors?.videoUrl);
  const categoryError = firstError(state.fieldErrors?.category);
  const subCategoryError = firstError(state.fieldErrors?.subCategory);
  const politicianError = firstError(state.fieldErrors?.politicianTag);
  const permanenceError = firstError(state.fieldErrors?.permanenceAccepted);
  const imageError = firstError(state.fieldErrors?.claimImage);

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
            aria-describedby={titleError ? "claim-title-error" : "claim-title-help"}
            aria-invalid={Boolean(titleError)}
            className={inputClassName}
            id="claim-title"
            maxLength={160}
            name="title"
            placeholder="State one specific claim that can be checked"
            required
          />
          <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="claim-title-help">
            Keep it factual and specific. Maximum 160 characters.
          </p>
          <FieldError id="claim-title-error" message={titleError} />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="claim-description">
            Description
          </label>
          <textarea
            aria-describedby={descriptionError ? "claim-description-error" : "claim-description-help"}
            aria-invalid={Boolean(descriptionError)}
            className={`${inputClassName} min-h-36 resize-y`}
            id="claim-description"
            maxLength={1_000}
            name="description"
            placeholder="Add context that helps the community understand what should be verified"
            required
            rows={6}
          />
          <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="claim-description-help">
            Maximum 1000 characters. Do not include private personal information.
          </p>
          <FieldError id="claim-description-error" message={descriptionError} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="claim-source">
              Source URL
            </label>
            <input
              aria-describedby={sourceError ? "claim-source-error" : "claim-source-help"}
              aria-invalid={Boolean(sourceError)}
              autoCapitalize="none"
              autoCorrect="off"
              className={inputClassName}
              id="claim-source"
              inputMode="url"
              name="sourceUrl"
              placeholder="https://example.com/report"
              required
              type="url"
            />
            <p className="mt-2 text-xs text-[var(--ff-text-muted)]" id="claim-source-help">
              Link to where the claim appeared or a primary source.
            </p>
            <FieldError id="claim-source-error" message={sourceError} />
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
            aria-describedby={categoryError ? "claim-category-error" : undefined}
            aria-invalid={Boolean(categoryError)}
            className={inputClassName}
            id="claim-category"
            name="category"
            onChange={(event) => {
              setCategory(event.target.value);
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
          <FieldError id="claim-category-error" message={categoryError} />
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

        {category === "Politics" && subCategory === "Politician" ? (
          <div>
            <label className="block text-sm font-medium" htmlFor="claim-politician">
              Politician name
            </label>
            <input
              aria-describedby={politicianError ? "claim-politician-error" : undefined}
              aria-invalid={Boolean(politicianError)}
              autoComplete="off"
              className={inputClassName}
              id="claim-politician"
              maxLength={100}
              name="politicianTag"
              required
            />
            <FieldError id="claim-politician-error" message={politicianError} />
          </div>
        ) : null}

        <div className="rounded-[var(--ff-radius-card)] border border-[var(--ff-border)] bg-[var(--ff-surface)] p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6" htmlFor="claim-permanence">
            <input
              aria-describedby={permanenceError ? "claim-permanence-error" : "claim-permanence-help"}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--ff-navy)]"
              id="claim-permanence"
              name="permanenceAccepted"
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
          <FieldError id="claim-permanence-error" message={permanenceError} />
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
          className="rounded-[var(--ff-radius-card)] border border-[var(--ff-navy)] bg-[var(--ff-navy)] px-6 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-65"
          disabled={pending}
          type="submit"
        >
          {pending ? "Posting claim…" : "Post claim"}
        </button>
      </div>
    </form>
  );
}
