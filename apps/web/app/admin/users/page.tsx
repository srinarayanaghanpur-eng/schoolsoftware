"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { auth, db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  MODULES,
  ROLES,
  ROLE_LABELS,
  hasPermission,
  isValidRole,
  type Module,
  type Permission,
  type Role
} from "@sri-narayana/shared";
import { collection, getDocs } from "firebase/firestore";
import { AlertCircle, Check, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  uid: string;
  displayName: string;
  email?: string;
  employeeId?: string;
  internalEmail?: string;
  status?: string;
  role?: Role;
};

function roleViewPermission(module: Module): Permission {
  return `${module}.view` as Permission;
}

function AccessNotice() {
  return (
    <section className="p-4 md:p-7">
      <div className="card flex max-w-2xl items-start gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
          <AlertCircle size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">Only administrators can manage user roles.</p>
        </div>
      </div>
    </section>
  );
}

export default function UsersRolesPage() {
  const { role } = useAdminSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "admin";

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      `${user.displayName} ${user.email ?? ""} ${user.employeeId ?? ""} ${user.internalEmail ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [query, users]);

  const loadUsers = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    if (!isFirebaseConfigured) {
      setError("Firebase web config is required to load users.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const rows = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as {
            displayName?: string;
            email?: string;
            employeeId?: string;
            internalEmail?: string;
            status?: string;
            role?: unknown;
          };
          return {
            uid: docSnap.id,
            displayName: data.displayName ?? data.email ?? data.employeeId ?? docSnap.id,
            email: data.email,
            employeeId: data.employeeId,
            internalEmail: data.internalEmail,
            status: data.status,
            role: isValidRole(data.role) ? data.role : undefined
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [isAdmin]);

  const changeRole = async (uid: string, nextRole: Role) => {
    setPendingUid(uid);
    setError(null);
    setMessage(null);
    try {
      await adminApiRequest<{ ok: true; uid: string; role: Role }>(`/api/admin/users/${uid}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole })
      });
      setUsers((current) => current.map((user) => (user.uid === uid ? { ...user, role: nextRole } : user)));
      setMessage("Role updated. The user must sign in again for the new claim to apply.");
      if (uid === auth.currentUser?.uid) {
        setMessage("Your role was updated. Sign in again for the new claim to apply.");
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Unable to update role.";
      setError(message);
    } finally {
      setPendingUid(null);
    }
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Users & Roles" description="Review module access across school roles." />
        <AccessNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Users & Roles" description="Review module access and assign roles to existing user accounts." />

      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-[#edf0f7] px-4 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]">
              <ShieldCheck size={20} />
            </span>
            <h2 className="font-extrabold text-[#1f2136]">Permission Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-center text-sm">
              <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Module</th>
                  {ROLES.map((matrixRole) => (
                    <th key={matrixRole} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">
                      {ROLE_LABELS[matrixRole]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => (
                  <tr key={module} className="border-b border-[#edf0f7] last:border-b-0">
                    <td className="px-4 py-3 text-left font-bold capitalize text-[#303247]">{module.replace("_", " ")}</td>
                    {ROLES.map((matrixRole) => {
                      const allowed = hasPermission(matrixRole, roleViewPermission(module));
                      return (
                        <td key={`${module}-${matrixRole}`} className="px-4 py-3">
                          <span className={allowed ? "mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#e6f8ef] text-[#0f8d52]" : "mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#eef0f7] text-[#9aa4c4]"}>
                            {allowed ? <Check size={17} strokeWidth={3} /> : <X size={17} strokeWidth={3} />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8490b9]" />
            <input
              className="field pl-10"
              placeholder="Search users by name, email, or ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">User</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Login ID</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Status</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Role</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={4}>
                      <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading users...</span>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={4}>No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="border-b border-[#edf0f7] last:border-b-0">
                      <td className="px-5 py-4">
                        <span className="block font-extrabold text-[#303247]">{user.displayName}</span>
                        <span className="block text-xs font-medium text-[#7d86a8]">{user.email ?? user.internalEmail ?? user.uid}</span>
                      </td>
                      <td className="px-5 py-4 font-medium text-[#7d86a8]">{user.employeeId ?? user.internalEmail ?? "--"}</td>
                      <td className="px-5 py-4">
                        <span className={user.status === "inactive" ? "rounded-full bg-[#ffebed] px-3 py-1 text-xs font-extrabold text-[#c83f4d]" : "rounded-full bg-[#e6f8ef] px-3 py-1 text-xs font-extrabold text-[#0f8d52]"}>
                          {user.status ?? "active"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="relative max-w-[220px]">
                          <select
                            className="field pr-10"
                            value={user.role ?? ""}
                            disabled={pendingUid === user.uid}
                            onChange={(event) => void changeRole(user.uid, event.target.value as Role)}
                          >
                            <option value="" disabled>Unknown role</option>
                            {ROLES.map((option) => (
                              <option key={option} value={option}>{ROLE_LABELS[option]}</option>
                            ))}
                          </select>
                          {pendingUid === user.uid && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#8490b9]" />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
