"use client";

/**
 * Bridge between the ERP review queue and the local Google Messages automation
 * agent (apps/reminder-agent).
 *
 * Handoff model: the admin reviews messages in the queue, selects the ones to
 * send, and clicks "Start Sending". That marks those queue items status
 * "approved". The local agent polls for "approved" items, sends them through
 * Google Messages Web, and writes each result back (sent/failed/skipped). The
 * ERP never drives the browser itself — Playwright cannot run in Vercel or the
 * browser tab — so the desktop agent owns delivery.
 */
import { adminApiRequest } from "@/lib/adminApiClient";

export type AgentQueueStatus =
  | "pending"
  | "approved"
  | "sending"
  | "sent"
  | "failed"
  | "skipped"
  | "deferred";

/** Mark the reviewed/selected queue items ready for the agent to send. */
export async function approveForAgent(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await adminApiRequest<{ ok: boolean; updated: number }>(
    "/api/admin/fee-reminder-queue",
    {
      method: "PUT",
      body: JSON.stringify({ ids, status: "approved", reason: "Approved via Start Sending" }),
    },
  );
  return res.updated ?? ids.length;
}

/** Undo approval (e.g. admin cancelled before the agent ran). */
export async function unapproveForAgent(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await adminApiRequest<{ ok: boolean; updated: number }>(
    "/api/admin/fee-reminder-queue",
    {
      method: "PUT",
      body: JSON.stringify({ ids, status: "pending", reason: "Approval cancelled" }),
    },
  );
  return res.updated ?? ids.length;
}

export interface AgentProgress {
  runId: string;
  total: number;
  processedIds: string[];
  sentToday: number;
  status: "idle" | "running" | "paused" | "stopped" | "completed";
  results: Array<{ id: string; status: "sent" | "failed" | "skipped"; phone: string }>;
}

/**
 * Read live progress from the running agent's local control server. Returns null
 * if the agent isn't running (ERP and agent are separate processes on the admin
 * machine). Default port matches the agent's CONTROL_PORT.
 */
export async function fetchAgentProgress(
  controlBaseUrl = "http://localhost:4599",
): Promise<AgentProgress | null> {
  try {
    const res = await fetch(`${controlBaseUrl}/progress`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AgentProgress;
  } catch {
    return null; // agent not running / not reachable
  }
}

/** Send a pause/resume/stop command to the running agent. */
export async function controlAgent(
  cmd: "pause" | "resume" | "stop",
  controlBaseUrl = "http://localhost:4599",
): Promise<boolean> {
  try {
    const res = await fetch(`${controlBaseUrl}/control?cmd=${cmd}`);
    return res.ok;
  } catch {
    return false;
  }
}
