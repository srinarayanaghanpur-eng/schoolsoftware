"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Room = { id: string; number: string; type?: string; capacity: number; occupied: number };
type Allotment = { id: string; studentName?: string; roomNumber?: string; fromDate: string };
type Student = { id: string; studentName?: string };

export default function HostelPage() {
  const { role } = useAdminSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [rForm, setRForm] = useState({ number: "", type: "", capacity: "2" });
  const [aForm, setAForm] = useState({ studentId: "", roomId: "", fromDate: new Date().toISOString().slice(0, 10) });
  const [showR, setShowR] = useState(false);

  async function load() {
    try {
      const [r, a] = await Promise.all([adminApiRequest<{ rooms: Room[] }>("/api/admin/hostel/rooms"), adminApiRequest<{ allotments: Allotment[] }>("/api/admin/hostel/allotments")]);
      setRooms(r.rooms); setAllotments(a.allotments);
      try { const s = await adminApiRequest<{ data?: Student[]; students?: Student[] }>("/api/admin/students"); setStudents(s.data || s.students || []); } catch { /* optional */ }
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }
  useEffect(() => { void load(); }, []);

  async function addRoom(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/hostel/rooms", { method: "POST", body: JSON.stringify({ ...rForm, capacity: Number(rForm.capacity) }) }); setRForm({ number: "", type: "", capacity: "2" }); setShowR(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function allot(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/hostel/allotments", { method: "POST", body: JSON.stringify(aForm) }); setAForm({ ...aForm, studentId: "", roomId: "" }); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "hostel.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Hostel" description="Rooms, bed allotment and occupancy." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Rooms</h2><button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setShowR((v) => !v)}>{showR ? <X size={14} /> : <Plus size={14} />}</button></div>
            {showR && <form onSubmit={addRoom} className="grid gap-2 border-t border-stone-100 p-4 sm:grid-cols-3"><input className="field" placeholder="Room no." required value={rForm.number} onChange={(e) => setRForm({ ...rForm, number: e.target.value })} /><input className="field" placeholder="Type (AC/Non-AC)" value={rForm.type} onChange={(e) => setRForm({ ...rForm, type: e.target.value })} /><input className="field" type="number" min="1" placeholder="Capacity" required value={rForm.capacity} onChange={(e) => setRForm({ ...rForm, capacity: e.target.value })} /><button className="btn-primary sm:col-span-3">Add room</button></form>}
            <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Room</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Occupancy</th></tr></thead>
              <tbody>{rooms.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">No rooms</td></tr> : rooms.map((r) => (<tr key={r.id} className="border-t border-stone-100"><td className="px-4 py-2 font-semibold">{r.number}</td><td className="px-4 py-2">{r.type}</td><td className={`px-4 py-2 text-right font-semibold ${r.occupied >= r.capacity ? "text-[#ed515d]" : "text-[#14a762]"}`}>{r.occupied}/{r.capacity}</td></tr>))}</tbody>
            </table>
          </article>
          <div className="space-y-4">
            <form onSubmit={allot} className="card space-y-3 p-5">
              <h2 className="font-bold text-[#1f2136]">Allot room</h2>
              <select className="field" required value={aForm.studentId} onChange={(e) => setAForm({ ...aForm, studentId: e.target.value })}><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.studentName}</option>)}</select>
              <select className="field" required value={aForm.roomId} onChange={(e) => setAForm({ ...aForm, roomId: e.target.value })}><option value="">Select room</option>{rooms.filter((r) => r.occupied < r.capacity).map((r) => <option key={r.id} value={r.id}>Room {r.number} ({r.capacity - r.occupied} free)</option>)}</select>
              <button className="btn-primary w-full">Allot</button>
            </form>
            <article className="card overflow-x-auto">
              <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Current allotments</h2></div>
              <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">Room</th></tr></thead>
                <tbody>{allotments.length === 0 ? <tr><td colSpan={2} className="px-4 py-6 text-center text-stone-400">None</td></tr> : allotments.map((a) => (<tr key={a.id} className="border-t border-stone-100"><td className="px-4 py-2">{a.studentName}</td><td className="px-4 py-2 font-semibold">{a.roomNumber}</td></tr>))}</tbody>
              </table>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
