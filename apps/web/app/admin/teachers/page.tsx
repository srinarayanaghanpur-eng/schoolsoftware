"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { demoTeachers, type Teacher } from "@sri-narayana/shared";
import { CheckCircle2, Edit3, KeyRound, Plus, Search, UserX, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRefreshOnFocus } from "@/lib/useRefreshOnFocus";

type TeacherFormState = {
  fullName: string;
  employeeId: string;
  subject: string;
  phone: string;
  baseSalary: string;
  biometricUserId: string;
  password: string;
  confirmPassword: string;
  status: "active" | "inactive";
  employmentType: "full_time" | "part_time_morning" | "part_time_afternoon";
};

const blankForm: TeacherFormState = {
  fullName: "",
  employeeId: "",
  subject: "",
  phone: "",
  baseSalary: "",
  biometricUserId: "",
  password: "",
  confirmPassword: "",
  status: "active",
  employmentType: "full_time"
};

function formFromTeacher(teacher: Teacher): TeacherFormState {
  return {
    fullName: teacher.fullName,
    employeeId: teacher.employeeId,
    subject: teacher.subject,
    phone: teacher.phone ?? "",
    baseSalary: String(teacher.baseSalary ?? ""),
    biometricUserId: teacher.biometricUserId ?? "",
    password: "",
    confirmPassword: "",
    status: teacher.status,
    employmentType: teacher.employmentType ?? "full_time"
  };
}

function teacherPayload(form: TeacherFormState, includePassword: boolean) {
  const payload: Record<string, unknown> = {
    fullName: form.fullName,
    employeeId: form.employeeId,
    subject: form.subject,
    phone: form.phone,
    baseSalary: form.baseSalary,
    biometricUserId: form.biometricUserId,
    status: form.status,
    employmentType: form.employmentType
  };

  if (includePassword) {
    payload.password = form.password;
    payload.confirmPassword = form.confirmPassword;
  }

  return payload;
}

export default function TeachersPage() {
  const { role } = useAdminSession();
  const canManageTeachers = role === "admin" || role === "super_admin";
  const [query, setQuery] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>(isFirebaseConfigured ? [] : demoTeachers);
  const [form, setForm] = useState<TeacherFormState>(blankForm);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [resetTeacher, setResetTeacher] = useState<Teacher | null>(null);
  const [resetPassword, setResetPassword] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredTeachers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return teachers;
    return teachers.filter((teacher) =>
      `${teacher.fullName} ${teacher.employeeId} ${teacher.subject}`.toLowerCase().includes(term)
    );
  }, [query, teachers]);

  const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Please sign in as admin again.");
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) {
      throw new Error(result.error ?? "Request failed");
    }
    return result;
  };

  const loadTeachers = async () => {
    if (!isFirebaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ teachers: Teacher[] }>("/api/admin/teachers");
      setTeachers(result.teachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load teachers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);
  useRefreshOnFocus(loadTeachers);

  const startCreate = () => {
    if (!canManageTeachers) return;
    setEditingTeacher(null);
    setForm(blankForm);
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const startEdit = (teacher: Teacher) => {
    if (!canManageTeachers) return;
    setEditingTeacher(teacher);
    setForm(formFromTeacher(teacher));
    setShowForm(true);
    setMessage(null);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTeacher(null);
    setForm(blankForm);
  };

  const submitTeacher = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        throw new Error("Firebase web config is required before creating teacher logins.");
      }

      if (editingTeacher) {
        const result = await apiRequest<{ message?: string }>(`/api/admin/teachers/${editingTeacher.id}`, {
          method: "PATCH",
          body: JSON.stringify({ teacher: teacherPayload(form, false) })
        });
        setMessage(result.message ?? "Teacher details updated.");
      } else {
        const result = await apiRequest<{ message?: string }>("/api/admin/teachers", {
          method: "POST",
          body: JSON.stringify({ teacher: teacherPayload(form, true) })
        });
        setMessage(result.message ?? "Teacher login and Firestore profile created.");
      }
      closeForm();
      await loadTeachers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save teacher");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (teacher: Teacher) => {
    if (!canManageTeachers) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>(`/api/admin/teachers/${teacher.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          teacher: {
            fullName: teacher.fullName,
            employeeId: teacher.employeeId,
            subject: teacher.subject,
            phone: teacher.phone ?? "",
            baseSalary: teacher.baseSalary,
            biometricUserId: teacher.biometricUserId ?? "",
            status: teacher.status === "active" ? "inactive" : "active"
          }
        })
      });
      setMessage(result.message ?? (teacher.status === "active" ? "Teacher deactivated." : "Teacher activated."));
      await loadTeachers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetTeacher) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ message?: string }>(`/api/admin/teachers/${resetTeacher.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify(resetPassword)
      });
      setResetTeacher(null);
      setResetPassword({ password: "", confirmPassword: "" });
      setMessage(result.message ?? "Teacher password reset in Firebase Auth.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Teacher Management"
        description="Create Employee ID logins, maintain teacher profiles, and control active access."
        action={
          canManageTeachers ? (
            <button className="btn-primary" onClick={startCreate}>
              <Plus size={16} /> Add Teacher Login
            </button>
          ) : null
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {!isFirebaseConfigured && (
          <div className="rounded-2xl border border-[#ffe1ab] bg-[#fff8ea] px-4 py-3 text-sm font-semibold text-[#9f7116]">
            Firebase web config is not set yet. Add Teacher Login needs Firebase Auth and Admin credentials.
          </div>
        )}
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        {showForm && (
          <form onSubmit={submitTeacher} className="card p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1f2136]">{editingTeacher ? "Edit teacher" : "Add Teacher Login"}</h2>
                <p className="text-sm font-medium text-[#7d86a8]">
                  Employee ID becomes the hidden Firebase email automatically. Password is sent only to Firebase Auth.
                </p>
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]" onClick={closeForm} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-sm font-medium">
                <span>Full name</span>
                <input className="field" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Employee ID</span>
                <input className="field uppercase" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Subject</span>
                <input className="field" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Phone number</span>
                <input className="field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Base salary</span>
                <input className="field" type="number" min="0" value={form.baseSalary} onChange={(event) => setForm({ ...form, baseSalary: event.target.value })} required />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Biometric User ID</span>
                <input className="field" value={form.biometricUserId} onChange={(event) => setForm({ ...form, biometricUserId: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Status</span>
                <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "active" | "inactive" })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Employment type</span>
                <select
                  className="field"
                  value={form.employmentType}
                  onChange={(event) => setForm({ ...form, employmentType: event.target.value as TeacherFormState["employmentType"] })}
                >
                  <option value="full_time">Full-time (6:00–9:30 in · 4:30–5:30 out)</option>
                  <option value="part_time_morning">Part-time Morning (in by 9:30 · out by 12:00)</option>
                  <option value="part_time_afternoon">Part-time Afternoon (in 12:00–1:00 · out 4:30–5:30)</option>
                </select>
              </label>
              {!editingTeacher && (
                <>
                  <label className="space-y-1 text-sm font-medium">
                    <span>Password</span>
                    <input className="field" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    <span>Confirm password</span>
                    <input className="field" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required />
                  </label>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={loading}>
                {loading ? "Saving..." : editingTeacher ? "Save changes" : "Create teacher login"}
              </button>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {resetTeacher && (
          <form onSubmit={submitResetPassword} className="card p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1f2136]">Reset password</h2>
                <p className="text-sm font-medium text-[#7d86a8]">{resetTeacher.fullName} · {resetTeacher.employeeId}</p>
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]" onClick={() => setResetTeacher(null)} title="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" type="password" placeholder="New password" value={resetPassword.password} onChange={(event) => setResetPassword({ ...resetPassword, password: event.target.value })} required />
              <input className="field" type="password" placeholder="Confirm new password" value={resetPassword.confirmPassword} onChange={(event) => setResetPassword({ ...resetPassword, confirmPassword: event.target.value })} required />
            </div>
            <button className="btn-primary mt-4" disabled={loading}>
              <KeyRound size={16} /> {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        <div className="card p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8490b9]" />
            <input
              className="field pl-10"
              placeholder="Search by Employee ID, name, or subject"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Biometric ID</th>
                <th className="px-4 py-3">Base salary</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">{teacher.fullName}</td>
                  <td className="px-4 py-3">{teacher.employeeId}</td>
                  <td className="px-4 py-3">{teacher.subject}</td>
                  <td className="px-4 py-3">{teacher.phone || "--"}</td>
                  <td className="px-4 py-3">{teacher.biometricUserId || "--"}</td>
                  <td className="px-4 py-3">₹{Number(teacher.baseSalary ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={teacher.status === "active" ? "rounded-full bg-[#e6f8ef] px-2.5 py-1 text-xs font-bold text-[#13a961]" : "rounded-full bg-[#eef0f7] px-2.5 py-1 text-xs font-bold text-[#7d86a8]"}>
                      {teacher.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManageTeachers ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" onClick={() => startEdit(teacher)} disabled={!isFirebaseConfigured || loading}>
                          <Edit3 size={15} /> Edit
                        </button>
                        <button className="btn-secondary" onClick={() => setResetTeacher(teacher)} disabled={!isFirebaseConfigured || loading}>
                          <KeyRound size={15} /> Reset
                        </button>
                        <button className="btn-secondary" onClick={() => toggleStatus(teacher)} disabled={!isFirebaseConfigured || loading}>
                          {teacher.status === "active" ? <UserX size={15} /> : <CheckCircle2 size={15} />}
                          {teacher.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-[#9aa4c4]">View only</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredTeachers.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-medium text-[#7d86a8]" colSpan={8}>
                    {loading ? "Loading teachers..." : "No teachers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
