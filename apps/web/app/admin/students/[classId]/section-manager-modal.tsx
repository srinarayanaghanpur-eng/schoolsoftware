import { useState } from "react";
import { Plus, X } from "lucide-react";
import { usePopup } from "@/components/CenterPopup";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";

export function SectionManagerModal({
  classId,
  classLabel,
  sections,
  onClose,
  onSaved
}: {
  classId: string;
  classLabel: string;
  sections: string[];
  onClose: () => void;
  onSaved: (sections: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(sections);
  const [newSection, setNewSection] = useState("");
  const [mergeFrom, setMergeFrom] = useState(sections[0] ?? "");
  const [mergeTo, setMergeTo] = useState(sections[1] ?? "");
  const [busy, setBusy] = useState(false);
  const toast = usePopup();

  // "From" can also be a legacy section (e.g. C/D/E from before the A/B
  // default) that still holds students but is no longer configured.
  const mergeFromOptions = Array.from(new Set([...sections, "A", "B", "C", "D", "E"])).sort();

  const addSection = () => {
    const value = newSection.trim().toUpperCase();
    if (!value || draft.includes(value)) return;
    setDraft([...draft, value].sort());
    setNewSection("");
  };

  const saveSections = async (next: string[]) => {
    setBusy(true);
    
    try {
      const result = await adminApiRequest<{ ok: boolean; sections: string[] }>("/api/admin/class-sections", {
        method: "PUT",
        body: JSON.stringify({ classId, sections: next })
      });
      setDraft(result.sections);
      onSaved(result.sections);
      toast.success("Sections saved.");
    } catch (err) {
      toast.error("Unable to save sections.", err instanceof AdminApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const runMerge = async () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) {
      toast.error("Pick two different sections to merge.");
      return;
    }
    const mergeOk = await toast.confirm(
      `Move ALL students of ${classLabel} Section ${mergeFrom} into Section ${mergeTo}?`,
      `Section ${mergeFrom} will be removed.`,
      { okLabel: "Move all", danger: true }
    );
    if (!mergeOk) {
      return;
    }
    setBusy(true);
    
    try {
      const result = await adminApiRequest<{ ok: boolean; movedStudents: number; sections: string[] }>(
        "/api/admin/class-sections/merge",
        {
          method: "POST",
          body: JSON.stringify({ classId, fromSection: mergeFrom, toSection: mergeTo })
        }
      );
      setDraft(result.sections);
      onSaved(result.sections);
      setMergeFrom(result.sections[0] ?? "");
      setMergeTo(result.sections[1] ?? "");
      toast.success(`Moved ${result.movedStudents} student(s) from Section ${mergeFrom} to Section ${mergeTo}.`);
    } catch (err) {
      toast.error("Unable to merge sections.", err instanceof AdminApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1f2136]">Sections · {classLabel}</h3>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">Add, remove or merge sections for this class.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3f4fb] text-[#475067]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-[#303247]">Current sections</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {draft.map((section) => (
              <span key={section} className="inline-flex items-center gap-1.5 rounded-full bg-[#eef0ff] px-3 py-1.5 text-sm font-bold text-[#3033a1]">
                {section}
                {draft.length > 1 && (
                  <button
                    type="button"
                    className="text-[#8a91b4] hover:text-[#ed515d]"
                    aria-label={`Remove section ${section}`}
                    onClick={() => setDraft(draft.filter((s) => s !== section))}
                  >
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="field flex-1"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSection();
                }
              }}
              maxLength={3}
              placeholder="New section (e.g. C)"
            />
            <button type="button" className="btn-secondary" onClick={addSection} disabled={busy}>
              <Plus size={15} />
              Add
            </button>
            <button type="button" className="btn-primary" onClick={() => saveSections(draft)} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-[#7d86a8]">
            Deleting a section is only allowed when it has no students — merge them first below.
          </p>
        </div>

        <div className="mt-6 border-t border-[#edf0f7] pt-5">
          <p className="text-sm font-bold text-[#303247]">Merge sections</p>
          <p className="mt-1 text-xs font-medium text-[#7d86a8]">Moves every student across and removes the source section.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-[#7d86a8]">
              From
              <select className="field mt-1" value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)}>
                {mergeFromOptions.map((s) => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#7d86a8]">
              Into
              <select className="field mt-1" value={mergeTo} onChange={(e) => setMergeTo(e.target.value)}>
                {sections.map((s) => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </label>
            <button type="button" className="btn-primary" onClick={runMerge} disabled={busy || sections.length < 2}>
              {busy ? "Working..." : "Merge"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
