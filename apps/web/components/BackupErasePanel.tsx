"use client";

import {
  DEFAULT_SETTINGS,
  demoAttendance,
  demoAttendanceEditAudits,
  demoBiometricLogs,
  demoHolidays,
  demoLeaveRequests,
  demoPasswordResetHistory,
  demoPasswordResetRequests,
  demoSalaryReports,
  demoTeachers
} from "@sri-narayana/shared";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { DatabaseBackup, Download, RotateCcw, ShieldCheck, Trash2, Upload, Usb } from "lucide-react";
import { useMemo, useState } from "react";

const CONFIRMATION_PHRASE = "ERASE SCHOOL DATA";

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function createDemoBackup() {
  return {
    appName: "SRI NARAYANA HIGH SCHOOL",
    backupType: "demo-firestore-json",
    generatedAt: new Date().toISOString(),
    collections: {
      teachers: demoTeachers,
      attendance: demoAttendance,
      biometric_logs: demoBiometricLogs,
      holidays: demoHolidays,
      salary_reports: demoSalaryReports,
      password_reset_requests: demoPasswordResetRequests,
      password_reset_history: demoPasswordResetHistory,
      leave_requests: demoLeaveRequests,
      attendance_edit_audit_logs: demoAttendanceEditAudits,
      settings: [{ id: "school", data: DEFAULT_SETTINGS }]
    }
  };
}

export function BackupErasePanel() {
  const [backupChecksum, setBackupChecksum] = useState("");
  const [fileName, setFileName] = useState("");
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restoreBackup, setRestoreBackup] = useState<unknown>(null);
  const [savedToUsb, setSavedToUsb] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [loading, setLoading] = useState<"backup" | "restore" | "erase" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canErase = useMemo(
    () => Boolean(savedToUsb && backupChecksum && confirmationPhrase === CONFIRMATION_PHRASE),
    [backupChecksum, confirmationPhrase, savedToUsb]
  );

  const generateBackup = async () => {
    setLoading("backup");
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        const backup = createDemoBackup();
        const payload = JSON.stringify(backup, null, 2);
        const checksum = await sha256Hex(payload);
        const demoFileName = `sri-narayana-demo-backup-${checksum.slice(0, 8)}.json`;
        downloadJson(demoFileName, backup);
        setBackupChecksum(checksum);
        setFileName(demoFileName);
        setMessage("Demo backup downloaded. In production, save this file directly to the USB drive.");
        return;
      }

      if (!auth.currentUser) throw new Error("Please sign in again as admin.");
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/backup", {
        headers: { authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Backup failed");
      downloadJson(result.fileName, result.backup);
      setBackupChecksum(result.checksum);
      setFileName(result.fileName);
      setMessage("Backup downloaded. Save it to the USB drive before enabling erase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup failed");
    } finally {
      setLoading(null);
    }
  };

  const eraseData = async () => {
    setLoading("erase");
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setMessage("Firebase is not configured. No Firestore data was erased.");
        return;
      }

      if (!auth.currentUser) throw new Error("Please sign in again as admin.");
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/erase-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          backupChecksum,
          savedToUsb,
          confirmationPhrase
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Erase failed");
      setMessage(`Erase completed. Deleted counts: ${JSON.stringify(result.deletedCounts)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erase failed");
    } finally {
      setLoading(null);
    }
  };

  const importRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text());
      setRestoreBackup(parsed);
      setRestoreFileName(file.name);
      setMessage("Backup file loaded. Review the file name, then restore when ready.");
    } catch {
      setRestoreBackup(null);
      setRestoreFileName("");
      setMessage("Could not read that backup file. Choose a valid JSON backup.");
    }
  };

  const restoreData = async () => {
    setLoading("restore");
    setMessage(null);
    try {
      if (!restoreBackup) throw new Error("Choose a backup JSON file first.");
      if (!isFirebaseConfigured) {
        setMessage("Demo restore checked the backup file. Firebase is not configured, so no data was written.");
        return;
      }

      if (!auth.currentUser) throw new Error("Please sign in again as admin.");
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/restore-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ backup: restoreBackup })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Restore failed");
      setMessage(`Restore completed. Restored counts: ${JSON.stringify(result.restoredCounts)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <DatabaseBackup size={18} />
            Backup to USB
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#e3e6f0] bg-[#fafbff] p-3">
              <p className="text-sm font-bold text-[#303247]">1. Insert USB</p>
              <p className="mt-1 text-xs font-medium text-[#7d86a8]">Use the browser save dialog to choose the USB drive.</p>
            </div>
            <div className="rounded-xl border border-[#e3e6f0] bg-[#fafbff] p-3">
              <p className="text-sm font-bold text-[#303247]">2. Download backup</p>
              <p className="mt-1 text-xs font-medium text-[#7d86a8]">A JSON backup and checksum are generated.</p>
            </div>
            <div className="rounded-xl border border-[#e3e6f0] bg-[#fafbff] p-3">
              <p className="text-sm font-bold text-[#303247]">3. Confirm erase</p>
              <p className="mt-1 text-xs font-medium text-[#7d86a8]">Erase unlocks only after USB confirmation.</p>
            </div>
          </div>
          <button className="btn-primary mt-4" disabled={loading === "backup"} onClick={generateBackup}>
            <Download size={16} />
            {loading === "backup" ? "Preparing backup..." : "Download backup file"}
          </button>
        </div>

        <div className="card p-4">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Usb size={18} />
            USB verification
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={savedToUsb}
              onChange={(event) => setSavedToUsb(event.target.checked)}
            />
            <span>I confirm the backup file was saved to a USB drive before erasing data.</span>
          </label>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Backup file
              <input className="field mt-1" value={fileName} readOnly placeholder="Generate backup first" />
            </label>
            <label className="text-sm">
              Backup checksum
              <input className="field mt-1 font-mono" value={backupChecksum} onChange={(event) => setBackupChecksum(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <RotateCcw size={18} />
            Restore from backup
          </div>
          <p className="mb-4 text-sm font-medium text-[#5f6888]">
            Import a backup JSON file and restore the included collections. Existing matching documents are updated.
          </p>
          <label className="block text-sm">
            Backup JSON file
            <input
              className="field mt-1"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importRestoreFile(event.target.files?.[0])}
            />
          </label>
          {restoreFileName && <p className="mt-2 text-xs font-medium text-[#7d86a8]">Loaded: {restoreFileName}</p>}
          <button className="btn-secondary mt-4" disabled={loading === "restore" || !restoreBackup} onClick={restoreData}>
            <Upload size={16} />
            {loading === "restore" ? "Restoring..." : "Restore backup file"}
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card border-red-200 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold text-red-700">
            <Trash2 size={18} />
            Erase Firestore data
          </div>
          <p className="text-sm font-medium text-[#5f6888]">
            This removes operational collections after a verified backup checksum. Audit logs are kept.
          </p>
          <label className="mt-4 block text-sm">
            Type confirmation phrase
            <input
              className="field mt-1"
              placeholder={CONFIRMATION_PHRASE}
              value={confirmationPhrase}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
            />
          </label>
          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ed515d] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#c83f4d] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canErase || loading === "erase"}
            onClick={eraseData}
          >
            <Trash2 size={16} />
            {loading === "erase" ? "Erasing..." : "Erase data after USB backup"}
          </button>
        </div>

        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} />
            Safety checks
          </div>
          <ul className="space-y-2 text-sm font-medium text-[#5f6888]">
            <li>Admin Firebase token required in production.</li>
            <li>Backup checksum must exist in server audit logs.</li>
            <li>USB confirmation checkbox is required.</li>
            <li>Exact confirmation phrase is required.</li>
          </ul>
        </div>

        {message && <div className="card p-4 text-sm font-medium text-[#5f6888]">{message}</div>}
      </aside>
    </div>
  );
}
