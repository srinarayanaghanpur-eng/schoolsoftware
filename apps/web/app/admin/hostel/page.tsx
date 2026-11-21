"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowRightLeft, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Room = { id: string; number: string; type?: string; capacity: number; occupied: number };
type Allotment = { id: string; studentId: string; studentName?: string; roomId: string; roomNumber?: string; fromDate: string };
type Student = { id: string; studentName?: string };

const emptyRoom = { number: "", type: "", capacity: "2" };

export default function HostelPage() {
  const { role } = useAdminSession();
  const toast = usePopup();
  const canEdit = hasPermission(role, "hostel.edit");
  const canDelete = hasPermission(role, "hostel.delete");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rForm, setRForm] = useState({ ...emptyRoom });
  const [editingRoomId, setEditingRoomId] = useState("");
  const [aForm, setAForm] = useState({ studentId: "", roomId: "", fromDate: new Date().toISOString().slice(0, 10) });
  const [showR, setShowR] = useState(false);
  const [transferFor, setTransferFor] = useState("");
  const [transferRoomId, setTransferRoomId] = useState("");

  async function load() {
    try {
      const [r, a] = await Promise.all([adminApiRequest<{ rooms: Room[] }>("/api/admin/hostel/rooms"), adminApiRequest<{ allotments: Allotment[] }>("/api/admin/hostel/allotments")]);
      setRooms(r.rooms); setAllotments(a.allotments);
      try { const s = await adminApiRequest<{ data?: Student[]; students?: Student[] }>("/api/admin/students?pageSize=100"); setStudents(s.data || s.students || []); } catch { /* optional */ }
    } catch (e) { toast.error("Failed to load hostel", e instanceof AdminApiError ? e.message : undefined); }
  }
  useEffect(() => { void load(); }, []);

  function resetRoom() { setRForm({ ...emptyRoom }); setEditingRoomId(""); }
  function startAdd() { resetRoom(); setShowR(true); }
  function startEdit(r: Room) { setEditingRoomId(r.id); setRForm({ number: r.number, type: r.type || "", capacity: String(r.capacity) }); setShowR(true); }

  async function saveRoom(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...rForm, capacity: Number(rForm.capacity) };
      if (editingRoomId) await adminApiRequest(`/api/admin/hostel/rooms/${editingRoomId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await adminApiRequest("/api/admin/hostel/rooms", { method: "POST", body: JSON.stringify(payload) });
      resetRoom(); setShowR(false); toast.success(editingRoomId ? "Room updated" : "Room added"); await load();
    } catch (e) { toast.error(editingRoomId ? "Failed to update room" : "Failed to add room", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function allot(e: FormEvent) {
    e.preventDefault();
    try { await adminApiRequest("/api/admin/hostel/allotments", { method: "POST", body: JSON.stringify(aForm) }); setAForm({ ...aForm, studentId: "", roomId: "" }); toast.success("Room allotted"); await load(); }
    catch (e) { toast.error("Failed to allot room", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function vacate(a: Allotment) {
    const ok = await toast.confirm(`Vacate ${a.studentName}?`, `Bed in room ${a.roomNumber} will be freed.`, { okLabel: "Vacate", danger: true });
    if (!ok) return;
    try { await adminApiRequest(`/api/admin/hostel/allotments/${a.id}/vacate`, { method: "POST" }); toast.success("Room vacated"); await load(); }
    catch (e) { toast.error("Failed to vacate", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function transfer(e: FormEvent) {
    e.preventDefault();
    if (!transferRoomId) return;
    try {
      await adminApiRequest(`/api/admin/hostel/allotments/${transferFor}/transfer`, { method: "POST", body: JSON.stringify({ roomId: transferRoomId }) });
      setTransferFor(""); setTransferRoomId(""); toast.success("Allotment transferred"); await load();
    } catch (e) { toast.error("Failed to transfer", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function delRoom(r: Room) {
    const ok = await toast.confirm(`Delete room ${r.number}?`, "This cannot be undone.", { okLabel: "Delete", danger: true });
    if (!ok) return;
    try { await adminApiRequest(`/api/admin/hostel/rooms/${r.id}`, { method: "DELETE" }); toast.success("Room deleted"); await load(); }
    catch (e) { toast.error("Failed to delete room", e instanceof AdminApiError ? e.message : undefined); }
  }

  if (!hasPermission(role, "hostel.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Hostel" description="Rooms, bed allotment, occupancy, vacate and transfer." />
      <section className="space-y-5 p-4 md:p-7">
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Rooms</h2>{canEdit && <button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={startAdd}>{showR && !editingRoomId ? <X size={14} /> : <Plus size={14} />}</button>}</div>
            {showR && (
              <form onSubmit={saveRoom} className="grid gap-2 border-t border-stone-100 p-4 sm:grid-cols-3">
                <input className="field" placeholder="Room no." required value={rForm.number} onChange={(e) => setRForm({ ...rForm, number: e.target.value })} />
                <input className="field" placeholder="Type (AC/Non-AC)" value={rForm.type} onChange={(e) => setRForm({ ...rForm, type: e.target.value })} />
                <input className="field" type="number" min="1" placeholder="Capacity" required value={rForm.capacity} onChange={(e) => setRForm({ ...rForm, capacity: e.target.value })} />
                <div className="flex gap-2 sm:col-span-3"><button className="btn-primary flex-1">{editingRoomId ? "Save changes" : "Add room"}</button><button type="button" className="btn-secondary" onClick={() => { resetRoom(); setShowR(false); }}>Cancel</button></div>
              </form>
            )}
            <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Room</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Occupancy</th>{(canEdit || canDelete) && <th className="px-4 py-2 text-right">Action</th>}</tr></thead>
              <tbody>{rooms.length === 0 ? <tr><td colSpan={canEdit || canDelete ? 4 : 3} className="px-4 py-6 text-center text-stone-400">No rooms</td></tr> : rooms.map((r) => (<tr key={r.id} className="border-t border-stone-100"><td className="px-4 py-2 font-semibold">{r.number}</td><td className="px-4 py-2">{r.type}</td><td className={`px-4 py-2 text-right font-semibold ${r.occupied >= r.capacity ? "text-[#ed515d]" : "text-[#14a762]"}`}>{r.occupied}/{r.capacity}</td>{(canEdit || canDelete) && <td className="px-4 py-2 text-right"><div className="inline-flex gap-1">{canEdit && <button onClick={() => startEdit(r)} aria-label={`Edit room ${r.number}`} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"><Pencil size={13} /> Edit</button>}{canDelete && <button onClick={() => delRoom(r)} aria-label={`Delete room ${r.number}`} className="inline-flex items-center gap-1 rounded-lg bg-[#ffebed] px-2 py-1 text-xs font-bold text-[#ed515d]"><Trash2 size={13} /> Delete</button>}</div></td>}</tr>))}</tbody>
            </table>
          </article>

          <div className="space-y-4">
            {canEdit && (
              <form onSubmit={allot} className="card space-y-3 p-5">
                <h2 className="font-bold text-[#1f2136]">Allot room</h2>
                <select className="field" required value={aForm.studentId} onChange={(e) => setAForm({ ...aForm, studentId: e.target.value })}><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.studentName}</option>)}</select>
                <select className="field" required value={aForm.roomId} onChange={(e) => setAForm({ ...aForm, roomId: e.target.value })}><option value="">Select room</option>{rooms.filter((r) => r.occupied < r.capacity).map((r) => <option key={r.id} value={r.id}>Room {r.number} ({r.capacity - r.occupied} free)</option>)}</select>
                <button className="btn-primary w-full">Allot</button>
              </form>
            )}
            <article className="card overflow-x-auto">
              <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Current allotments</h2></div>
              <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">Room</th>{canEdit && <th className="px-4 py-2 text-right">Action</th>}</tr></thead>
                <tbody>{allotments.length === 0 ? <tr><td colSpan={canEdit ? 3 : 2} className="px-4 py-6 text-center text-stone-400">None</td></tr> : allotments.map((a) => (<tr key={a.id} className="border-t border-stone-100"><td className="px-4 py-2">{a.studentName}</td><td className="px-4 py-2 font-semibold">{a.roomNumber}</td>{canEdit && <td className="px-4 py-2 text-right"><div className="inline-flex flex-wrap justify-end gap-1"><button onClick={() => { setTransferFor(a.id); setTransferRoomId(""); }} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"><ArrowRightLeft size={13} /> Transfer</button><button onClick={() => vacate(a)} className="inline-flex items-center gap-1 rounded-lg bg-[#ffebed] px-2 py-1 text-xs font-bold text-[#ed515d]"><LogOut size={13} /> Vacate</button></div></td>}</tr>))}</tbody>
              </table>
              {transferFor && (
                <form onSubmit={transfer} className="space-y-2 border-t border-stone-100 p-4">
                  <p className="text-xs font-semibold text-stone-600">Transfer {allotments.find((a) => a.id === transferFor)?.studentName} to:</p>
                  <select className="field" required value={transferRoomId} onChange={(e) => setTransferRoomId(e.target.value)}><option value="">Select room</option>{rooms.filter((r) => r.occupied < r.capacity && r.id !== allotments.find((a) => a.id === transferFor)?.roomId).map((r) => <option key={r.id} value={r.id}>Room {r.number} ({r.capacity - r.occupied} free)</option>)}</select>
                  <div className="flex gap-2"><button className="btn-primary flex-1" disabled={!transferRoomId}>Transfer</button><button type="button" className="btn-secondary" onClick={() => setTransferFor("")}>Cancel</button></div>
                </form>
              )}
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
