"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { refreshClaims } from "@/lib/authClaims";
import { auth } from "@sri-narayana/shared/firebase/client";
import {
  PERMISSION_MATRIX,
  ROLE_LABELS,
  ROLES,
  SELF_LOCK_PERMISSIONS,
  SUPER_ADMIN_CRITICAL_PERMISSIONS,
  hasPermissionFromList,
  type Permission,
  type Role
} from "@sri-narayana/shared";
import { AlertCircle, Check, Link2, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserRow = {
  uid: string;
  displayName: string;
  email?: string;
  employeeId?: string;
  internalEmail?: string;
  status?: string;
  role?: Role;
  studentIds?: string[];
};

type RoleRecord = {
  slug: Role;
  label: string;
  permissions: Permission[];
};

type StudentOption = {
  id: string;
  admissionNumber?: string;
  studentName: string;
  class?: string;
  section?: string;
};

const VIEW_PERMISSIONS: Permission[] = ["users.view", "roles.view", "permissions.view"];
const EDIT_PERMISSIONS: Permission[] = ["roles.edit", "permissions.edit"];

function AccessNotice() {
  return (
    <section className="p-4 md:p-7">
      <div className="card flex max-w-2xl items-start gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
          <AlertCircle size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">Missing or insufficient permissions.</p>
        </div>
      </div>
    </section>
  );
}

function actionLabel(permission: Permission) {
  const action = String(permission).split(".").pop() || permission;
  return action.replace(/_/g, " ");
}

function roleCellKey(role: Role, permission: Permission) {
  return `${role}:${permission}`;
}

export default function UsersRolesPage() {
  const { role, hasPermission: sessionHasPermission, loading: sessionLoading } = useAdminSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [linkingUser, setLinkingUser] = useState<UserRow | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canView = role === "super_admin" || VIEW_PERMISSIONS.every((permission) => sessionHasPermission(permission));
  const canEditMatrix = role === "super_admin" || EDIT_PERMISSIONS.every((permission) => sessionHasPermission(permission));

  const roleBySlug = useMemo(() => {
    const map = new Map<Role, RoleRecord>();
    roles.forEach((item) => map.set(item.slug, item));
    return map;
  }, [roles]);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      `${user.displayName} ${user.email ?? ""} ${user.employeeId ?? ""} ${user.internalEmail ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [query, users]);

  const loadUsers = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: true; users: UserRow[] }>("/api/admin/users?pageSize=500", undefined, { fresh: true });
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  const loadRoles = useCallback(async () => {
    if (!canView) {
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: true; roles: RoleRecord[] }>("/api/admin/roles", undefined, { fresh: true });
      setRoles(result.roles);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load roles.");
    } finally {
      setRolesLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadUsers();
    void loadRoles();
  }, [loadUsers, loadRoles]);

  useEffect(() => {
    if (!canView) return;
    adminApiRequest<{ success?: boolean; data?: StudentOption[] }>("/api/admin/students")
      .then((result) => {
        setStudents(result.data ?? []);
      })
      .catch(() => undefined);
  }, [canView]);

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
        await refreshClaims(auth.currentUser).catch(() => undefined);
        setMessage("Your role was updated. Refreshed your session claims.");
      }
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Unable to update role.";
      setError(message);
    } finally {
      setPendingUid(null);
    }
  };

  const openLinkStudents = (user: UserRow) => {
    setLinkingUser(user);
    setSelectedStudentIds(user.studentIds ?? []);
    setError(null);
    setMessage(null);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId) ? current.filter((item) => item !== studentId) : [...current, studentId]
    );
  };

  const saveStudentLinks = async () => {
    if (!linkingUser) return;
    setPendingUid(linkingUser.uid);
    setError(null);
    setMessage(null);
    try {
      const result = await adminApiRequest<{ ok: true; uid: string; studentIds: string[] }>(`/api/admin/users/${linkingUser.uid}/students`, {
        method: "PATCH",
        body: JSON.stringify({ studentIds: selectedStudentIds })
      });
      setUsers((current) => current.map((user) => (user.uid === linkingUser.uid ? { ...user, studentIds: result.studentIds } : user)));
      setLinkingUser(null);
      setSelectedStudentIds([]);
      setMessage("Linked students updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to link students.");
    } finally {
      setPendingUid(null);
    }
  };

  const isPermissionAllowed = (targetRole: Role, permission: Permission) => {
    const roleRecord = roleBySlug.get(targetRole);
    return hasPermissionFromList(targetRole, roleRecord?.permissions, permission);
  };

  const protectedReason = (targetRole: Role, permission: Permission, currentlyAllowed: boolean) => {
    if (!currentlyAllowed) return "";
    if (targetRole === "super_admin" && SUPER_ADMIN_CRITICAL_PERMISSIONS.includes(permission)) {
      return "Super Admin permissions cannot be removed.";
    }
    if (targetRole === role && SELF_LOCK_PERMISSIONS.includes(permission)) {
      return "You cannot remove your own permission to manage roles.";
    }
    return "";
  };

  const togglePermission = async (targetRole: Role, permission: Permission) => {
    const currentlyAllowed = isPermissionAllowed(targetRole, permission);
    const reason = protectedReason(targetRole, permission, currentlyAllowed);
    if (reason) {
      setError(reason);
      return;
    }
    if (!canEditMatrix) {
      setError("Missing or insufficient permissions.");
      return;
    }

    const key = roleCellKey(targetRole, permission);
    setPendingCell(key);
    setError(null);
    setMessage(null);
    try {
      const result = await adminApiRequest<{ ok: true; role: RoleRecord }>(
        "/api/admin/roles",
        {
          method: "PATCH",
          body: JSON.stringify({ role: targetRole, permission, allowed: !currentlyAllowed })
        }
      );
      setRoles((current) => current.map((item) => (item.slug === result.role.slug ? result.role : item)));
      setMessage("Permission updated successfully");
      if (targetRole === role) {
        await refreshClaims(auth.currentUser).catch(() => undefined);
        window.dispatchEvent(new CustomEvent("snhs-rbac-updated", { detail: { role: targetRole, permission } }));
      }
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to update permission.");
    } finally {
      setPendingCell(null);
    }
  };

  if (sessionLoading) {
    return (
      <>
        <PageHeader title="Users & Roles" description="Review module access across school roles." />
        <section className="flex min-h-[300px] items-center justify-center p-4 md:p-7">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#7d86a8]">
            <Loader2 size={16} className="animate-spin" /> Loading session...
          </span>
        </section>
      </>
    );
  }

  if (!canView) {
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

        {linkingUser && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10122d]/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_24px_70px_rgba(16,18,45,0.22)] md:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1f2136]">Link students</h2>
                  <p className="mt-1 text-sm font-medium text-[#7d86a8]">{linkingUser.displayName} · {ROLE_LABELS[linkingUser.role ?? "parent"]}</p>
                </div>
                <button className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" type="button" onClick={() => setLinkingUser(null)} title="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[#edf0f7]">
                {students.map((student) => (
                  <label key={student.id} className="flex cursor-pointer items-center gap-3 border-b border-[#edf0f7] px-4 py-3 last:border-b-0 hover:bg-[#fafbff]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#3033a1]"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-[#303247]">{student.studentName}</span>
                      <span className="block text-xs font-medium text-[#7d86a8]">
                        {student.admissionNumber ?? student.id} · Class {student.class ?? "--"}{student.section ?? ""}
                      </span>
                    </span>
                  </label>
                ))}
                {!students.length && <p className="p-5 text-center text-sm font-semibold text-[#7d86a8]">No students found.</p>}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button className="btn-secondary" type="button" onClick={() => setLinkingUser(null)}>Cancel</button>
                <button className="btn-primary" type="button" onClick={() => void saveStudentLinks()} disabled={pendingUid === linkingUser.uid}>
                  <Link2 size={16} /> {pendingUid === linkingUser.uid ? "Saving..." : "Save links"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#edf0f7] px-4 py-4 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]">
              <ShieldCheck size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-[#1f2136]">Permission Matrix</h2>
              <p className="text-xs font-semibold text-[#7d86a8]">Click any action to allow or remove it for that role.</p>
            </div>
            {!canEditMatrix && <span className="rounded-full bg-[#fff8ea] px-3 py-1 text-xs font-extrabold text-[#9f7116]">Read only</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <tr>
                  <th className="w-[190px] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Module</th>
                  {ROLES.map((matrixRole) => (
                    <th key={matrixRole} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">
                      {roleBySlug.get(matrixRole)?.label ?? ROLE_LABELS[matrixRole]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rolesLoading ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={ROLES.length + 1}>
                      <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading permissions...</span>
                    </td>
                  </tr>
                ) : PERMISSION_MATRIX.map((group) => (
                  <tr key={group.key} className="border-b border-[#edf0f7] align-top last:border-b-0">
                    <td className="px-4 py-4">
                      <span className="block font-extrabold text-[#303247]">{group.label}</span>
                      <span className="mt-1 block text-xs font-semibold text-[#7d86a8]">{group.permissions.length} permission{group.permissions.length === 1 ? "" : "s"}</span>
                    </td>
                    {ROLES.map((matrixRole) => (
                      <td key={`${group.key}-${matrixRole}`} className="px-4 py-3">
                        <div className="flex min-w-[150px] flex-wrap gap-2">
                          {group.permissions.map((permission) => {
                            const allowed = isPermissionAllowed(matrixRole, permission);
                            const key = roleCellKey(matrixRole, permission);
                            const loadingCell = pendingCell === key;
                            const reason = protectedReason(matrixRole, permission, allowed);
                            const disabled = loadingCell || Boolean(reason) || !canEditMatrix;
                            const title = reason || (allowed ? "Click to remove" : "Click to allow");
                            return (
                              <button
                                key={permission}
                                type="button"
                                title={title}
                                disabled={disabled}
                                onClick={() => void togglePermission(matrixRole, permission)}
                                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold capitalize transition ${
                                  allowed
                                    ? "border-[#c8f0dc] bg-[#e6f8ef] text-[#0f8d52] hover:bg-[#d7f3e5]"
                                    : "border-[#e3e6f0] bg-[#eef0f7] text-[#8a93b1] hover:bg-[#ffebed] hover:text-[#c83f4d]"
                                } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                              >
                                {loadingCell ? <Loader2 size={14} className="animate-spin" /> : allowed ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                                {actionLabel(permission)}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    ))}
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
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Portal</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={5}>
                      <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading users...</span>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm font-semibold text-[#7d86a8]" colSpan={5}>No users found.</td>
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
                            disabled={pendingUid === user.uid || !sessionHasPermission("users.edit")}
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
                      <td className="px-5 py-4 text-right">
                        {user.role === "parent" ? (
                          <button className="btn-secondary" type="button" onClick={() => openLinkStudents(user)} disabled={!sessionHasPermission("users.edit")}>
                            <Link2 size={15} /> {user.studentIds?.length ? `${user.studentIds.length} linked` : "Link students"}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-[#9aa4c4]">--</span>
                        )}
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
