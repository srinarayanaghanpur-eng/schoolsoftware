"use client";

import { auth } from "@sri-narayana/shared/firebase/client";

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export async function adminApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new AdminApiError("Please sign in again.", 401);
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new AdminApiError(result.error ?? "Request failed", response.status);
  }

  return result as T;
}
