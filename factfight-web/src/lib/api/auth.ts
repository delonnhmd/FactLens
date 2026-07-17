import { z } from "zod";

import { publicEnvironment } from "@/lib/validation/env";

const REQUEST_TIMEOUT_MS = 10_000;

const usernameResponseSchema = z.object({
  ok: z.literal(true),
  available: z.boolean(),
  reserved: z.boolean().optional().default(false),
  normalized_username: z.string(),
  message: z.string().nullable().optional(),
});

const profileEnsureResponseSchema = z.object({
  ok: z.literal(true),
  profile: z.unknown().nullable(),
});

const termsResponseSchema = z.object({
  ok: z.literal(true),
});

type ApiFailure = { ok: false; message: string };

export type UsernameAvailabilityResult =
  | {
      ok: true;
      available: boolean;
      reserved: boolean;
      normalizedUsername: string;
      message?: string;
    }
  | ApiFailure;

export type AuthApiResult = { ok: true } | ApiFailure;

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${publicEnvironment.renderBackendUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Render request failed with status ${response.status}.`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function bearerHeaders(accessToken: string, includeJson = false) {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function checkUsernameAvailability(
  username: string,
): Promise<UsernameAvailabilityResult> {
  try {
    const payload = await requestJson(
      `/auth/username-availability?username=${encodeURIComponent(username)}`,
      { method: "GET" },
    );
    const parsed = usernameResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return {
        ok: false,
        message: "We could not verify this username right now. Please try again.",
      };
    }

    const message = parsed.data.available
      ? undefined
      : parsed.data.reserved
        ? "This username is reserved. Please choose another username."
        : "Username is already taken.";

    return {
      ok: true,
      available: parsed.data.available,
      reserved: parsed.data.reserved,
      normalizedUsername: parsed.data.normalized_username,
      message,
    };
  } catch {
    return {
      ok: false,
      message: "We could not verify this username right now. Please try again.",
    };
  }
}

export async function ensureProfile(
  accessToken: string,
  input: { username: string; displayName: string },
): Promise<AuthApiResult> {
  if (!accessToken) {
    return { ok: false, message: "Please log in to continue." };
  }

  try {
    const payload = await requestJson("/profile/ensure", {
      method: "POST",
      headers: bearerHeaders(accessToken, true),
      body: JSON.stringify({
        username: input.username,
        display_name: input.displayName,
      }),
    });

    if (!profileEnsureResponseSchema.safeParse(payload).success) {
      return { ok: false, message: "Could not prepare your profile right now." };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: "Could not prepare your profile right now." };
  }
}

export async function acceptTerms(accessToken: string): Promise<AuthApiResult> {
  if (!accessToken) {
    return { ok: false, message: "Please log in to continue." };
  }

  try {
    const payload = await requestJson("/api/users/me/accept-terms", {
      method: "POST",
      headers: bearerHeaders(accessToken),
    });

    if (!termsResponseSchema.safeParse(payload).success) {
      return { ok: false, message: "Could not record terms acceptance right now." };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: "Could not record terms acceptance right now." };
  }
}
