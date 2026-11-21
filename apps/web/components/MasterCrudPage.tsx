"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import type { MasterConfig, MasterField } from "@/lib/masterConfig";
import type { Permission } from "@sri-narayana/shared";
import { hasPermission } from "@sri-narayana/shared";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type MasterRow = Record<string, unknown> & { id: string };
type FormValues = Record<string, string | boolean>;

function defaultsFor(config: MasterConfig): FormValues {
  const values: FormValues = {};
  for (const field of config.fields) {
    if (field.type === "boolean") values[field.key] = true;
    else if (field.type === "select") values[field.key] = field.options?.[0]?.value ?? "";
    else values[field.key] = "";
  }
  return values;
}

function displayValue(field: MasterField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "boolean") return value ? "Yes" : "No";
  if (field.type === "select") {
    const option = field.options?.find((item) => item.value === String(value));
    return option?.label ?? String(value);
  }
  return String(value);
}

function inputType(field: MasterField): string {
  if (field.type === "number") return "number";
  if (field.type === "date") return "date";
  return "text";
}

export function MasterCrudPage({ config }: { config: MasterConfig }) {
  const { role } = useAdminSession();
  const popup = usePopup();
  const [items, setItems] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues>(() => defaultsFor(config));

  const canView = hasPermission(role, `${config.module}.view` as Permission);
  const canCreate = hasPermission(role, `${config.module}.create` as Permission);
  const canEdit = hasPermission(role, `${config.module}.edit` as Permission);

  const endpoint = `/api/admin/masters/${config.slug}`;

  const load = async () => {
    try {
      const data = await adminApiRequest<{ items: MasterRow[] }>(endpoint);
      setItems(data.items ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView]);

  useEffect(() => {
    setValues(defaultsFor(config));
    setEditingId(null);
    setFormOpen(false);
  }, [config]);

  const tableFields = config.fields.filter((field) => !field.hideInTable);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      tableFields.some((field) => String(item[field.key] ?? "").toLowerCase().includes(term))
    );
  }, [items, search, tableFields]);

  const openCreate = () => {
    setValues(defaultsFor(config));
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (item: MasterRow) => {
    const next: FormValues = {};
    for (const field of config.fields) {
      const value = item[field.key];
      if (field.type === "boolean") next[field.key] = Boolean(value);
      else next[field.key] = value === undefined || value === null ? "" : String(value);
    }
    setValues(next);
    setEditingId(item.id);
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of config.fields) {
        const value = values[field.key];
        if (field.type === "boolean") payload[field.key] = Boolean(value);
        else if (field.type === "number") payload[field.key] = value === "" ? undefined : Number(value);
        else payload[field.key] = value;
      }
      if (editingId) {
        await adminApiRequest(`${endpoint}/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        popup.success("Updated", `${config.title} record saved.`);
      } else {
        await adminApiRequest(endpoint, { method: "POST", body: JSON.stringify(payload) });
        popup.success("Created", `${config.title} record added.`);
      }
      setFormOpen(false);
      setEditingId(null);
      setValues(defaultsFor(config));
      await load();
    } catch (err) {
      popup.error("Could not save", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: MasterRow) => {
    const label = String(item[config.fields[0]?.key ?? "id"] ?? "record");
    const confirmed = await popup.confirm("Delete record?", `“${label}” will be removed permanently.`, {
      okLabel: "Delete",
      danger: true
    });
    if (!confirmed) return;
    try {
      await adminApiRequest(`${endpoint}/${item.id}`, { method: "DELETE" });
      popup.success("Deleted");
      await load();
    } catch (err) {
      popup.error("Could not delete", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  if (!canView) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-red-500">Access denied.</div>
      </section>
    );
  }

  return (
    <>
      <PageHeader title={config.title} description={config.description} />

      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-xs flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field !pl-9"
              placeholder="Search..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {canCreate && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={openCreate}>
              <Plus size={16} /> Add {config.title.replace(/s$/, "")}
            </button>
          )}
        </div>

        {formOpen && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {config.fields.map((field) => (
              <label key={field.key} className={`text-sm font-semibold ${field.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                {field.label}
                {field.required ? " *" : ""}
                {field.type === "textarea" ? (
                  <textarea
                    className="field mt-1"
                    rows={3}
                    maxLength={field.max ?? 2000}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={String(values[field.key] ?? "")}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="field mt-1"
                    required={field.required}
                    value={String(values[field.key] ?? "")}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.type === "boolean" ? (
                  <span className="mt-1 flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={Boolean(values[field.key])}
                      onChange={(event) => setValues({ ...values, [field.key]: event.target.checked })}
                    />
                    {field.placeholder ?? "Enabled"}
                  </span>
                ) : (
                  <input
                    className="field mt-1"
                    type={inputType(field)}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    maxLength={field.type === "text" ? field.max ?? 200 : undefined}
                    placeholder={field.placeholder}
                    value={String(values[field.key] ?? "")}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                  />
                )}
              </label>
            ))}
            <div className="flex justify-end gap-3 sm:col-span-2 lg:col-span-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setFormOpen(false)}>
                <X size={16} /> Cancel
              </button>
              <button className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update" : "Save"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "No records yet." : "No records match your search."}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {tableFields.map((field) => (
                    <th key={field.key} className="px-4 py-3">{field.label}</th>
                  ))}
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    {tableFields.map((field) => (
                      <td key={field.key} className="px-4 py-3">{displayValue(field, item[field.key])}</td>
                    ))}
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
