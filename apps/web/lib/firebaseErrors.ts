import { NextResponse } from "next/server";
import { errorMessage } from "./apiUtils";

const DEFAULT_QUOTA_COOLDOWN_MS = 5 * 60 * 1000;

let firestoreQuotaPausedUntil = 0;

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error ?? "");
  }

  const value = error as { code?: unknown; details?: unknown; message?: unknown; status?: unknown };
  return [value.code, value.status, value.message, value.details].filter(Boolean).join(" ");
}

export function isFirestoreQuotaExceededError(error: unknown): boolean {
  const value = error as { code?: unknown; status?: unknown };
  const code = String(value?.code ?? value?.status ?? "").toLowerCase();
  if (code === "8" || code === "resource-exhausted" || code === "firestore/resource-exhausted") {
    return true;
  }

  const text = errorText(error).toLowerCase();
  return text.includes("quota exceeded") || text.includes("resource exhausted");
}

export function pauseFirestoreAfterQuota(cooldownMs = DEFAULT_QUOTA_COOLDOWN_MS) {
  firestoreQuotaPausedUntil = Math.max(firestoreQuotaPausedUntil, Date.now() + cooldownMs);
}

export function firestoreQuotaRetryAfterSeconds() {
  return Math.max(0, Math.ceil((firestoreQuotaPausedUntil - Date.now()) / 1000));
}

export function isFirestoreQuotaPaused() {
  return firestoreQuotaRetryAfterSeconds() > 0;
}

export function firestoreQuotaResponse(message = "Firebase quota exceeded. Please wait for quota reset or upgrade Firebase plan.") {
  const retryAfter = firestoreQuotaRetryAfterSeconds() || Math.ceil(DEFAULT_QUOTA_COOLDOWN_MS / 1000);
  return NextResponse.json(
    { ok: false, code: "quota-exceeded", error: message, retryAfterSeconds: retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export function firestoreErrorResponse(error: unknown, fallbackMessage: string, fallbackStatus = 500) {
  if (isFirestoreQuotaExceededError(error)) {
    pauseFirestoreAfterQuota();
    return firestoreQuotaResponse();
  }

  return NextResponse.json({ ok: false, error: errorMessage(error, fallbackMessage) }, { status: fallbackStatus });
}
