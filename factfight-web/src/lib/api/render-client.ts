import "server-only";

import { publicEnvironment } from "@/lib/validation/env";

// Render's backend can cold-start after a period of inactivity (free-tier
// services spin down and take tens of seconds to wake on the next request).
// 20s was tight enough that a cold start could exceed it, surfacing as a
// generic "could not save your vote" network failure even though the
// backend was simply still waking up, not actually failing.
const REQUEST_TIMEOUT_MS = 30_000;

interface RenderErrorPayload {
  readonly code?: string;
  readonly detail?: string;
  readonly message?: string;
  readonly reason?: string;
  readonly alreadyVoted?: boolean;
}

export class RenderApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly alreadyVoted: boolean;

  constructor(status: number, payload: RenderErrorPayload = {}) {
    super(payload.detail ?? payload.message ?? payload.reason ?? "Request failed.");
    this.name = "RenderApiError";
    this.status = status;
    this.code = payload.code;
    this.alreadyVoted = payload.alreadyVoted ?? false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseErrorPayload(value: unknown): RenderErrorPayload {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const detailRecord = asRecord(record.detail);
  const readText = (key: string) => {
    const candidate = record[key] ?? detailRecord?.[key];
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
  };

  return {
    code: readText("code"),
    detail: typeof record.detail === "string" ? record.detail : readText("detail"),
    message: readText("message"),
    reason: readText("reason"),
    alreadyVoted: record.already_voted === true || detailRecord?.already_voted === true,
  };
}

async function requestJson(
  path: string,
  accessToken: string | null,
  init: Omit<RequestInit, "headers" | "signal"> & { readonly body?: string },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${publicEnvironment.renderBackendUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new RenderApiError(response.status, parseErrorPayload(payload));
    }

    return payload;
  } catch (error) {
    if (error instanceof RenderApiError) {
      throw error;
    }

    throw new RenderApiError(503, {
      message: "FactFight services are temporarily unavailable. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function requestRenderJson(
  path: string,
  accessToken: string,
  init: Omit<RequestInit, "headers" | "signal"> & { readonly body?: string },
): Promise<unknown> {
  return requestJson(path, accessToken, init);
}

export function requestPublicRenderJson(
  path: string,
  init: Omit<RequestInit, "headers" | "signal"> & { readonly body?: string } = { method: "GET" },
): Promise<unknown> {
  return requestJson(path, null, init);
}
