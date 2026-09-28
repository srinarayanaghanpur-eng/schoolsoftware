import { ArrowLeft, Camera, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import type { TransportRoute } from "./page";

export const GENDER_OPTIONS = ["Male", "Female", "Other"];
// Extra per-student fee types that can be added in Fee Details.
// "Transport Fee" is synced automatically from the selected bus stop.
export const CUSTOM_FEE_TYPES = ["Books", "Booklet", "Other", "Transport Fee"] as const;

export interface StudentFormData {
  admissionNumber: string;
  schoolId: string;
  studentName: string;
  class: string;
  section: string;
  gender: string;
  fatherName: string;
  fatherPhone: string;
  motherName: string;
  motherPhone: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  photoURL: string;
  aadhaarNumber: string;
  documentURLs: { name: string; url: string }[];
  previousSchoolName: string;
  previousSchoolAddress: string;
  previousSchoolYearLeft: string;
  siblingAdmissionNumbers: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  transportRouteId: string;
  transportStopName: string;
  transportFee: string;
  annualEnrollmentFee: string;
  commitmentFee: string;
  feeHeads: { name: string; original: number; committed: number }[];
}

interface Props {
  formData: StudentFormData;
  setFormData: React.Dispatch<React.SetStateAction<StudentFormData>>;
  handleChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  handleSubmit: React.FormEventHandler<HTMLFormElement>;
  editingId: string | null;
  closeForm: () => void;
  routeClassId: string;
  classLabel: string;
  sectionsFor: (classId: string) => string[];
  uploading: boolean;
  handlePhotoUpload: React.ChangeEventHandler<HTMLInputElement>;
  handleDocumentUpload: React.ChangeEventHandler<HTMLInputElement>;
  removeDocument: (index: number) => void;
  transportRoutes: TransportRoute[];
  syncTransportFeeRow: (routeId: string, stopName: string) => void;
  removeFeeHead: (name: string) => void;
  addFeeHead: () => void;
  newFeeType: string;
  setNewFeeType: React.Dispatch<React.SetStateAction<string>>;
  newFeeAmount: string;
  setNewFeeAmount: React.Dispatch<React.SetStateAction<string>>;
}

export function StudentFormModal({
  formData,
  setFormData,
  handleChange,
  handleSubmit,
  editingId,
  closeForm,
  routeClassId,
  classLabel,
  sectionsFor,
  uploading,
  handlePhotoUpload,
  handleDocumentUpload,
  removeDocument,
  transportRoutes,
  syncTransportFeeRow,
  removeFeeHead,
  addFeeHead,
  newFeeType,
  setNewFeeType,
  newFeeAmount,
  setNewFeeAmount
}: Props) {
  return (

          <div className="-m-4 md:-m-6 lg:-m-8 flex min-h-[100dvh] flex-col bg-white">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#edf0f7] bg-white px-4 py-3 md:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-[#1f2136]">
                  {editingId ? "Edit Student" : "Add New Student"}
                </h2>
              </div>
              <button type="submit" form="admission-form" className="btn-primary">
                <Save size={16} />
                {editingId ? "Save Changes" : "Save Student"}
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-none px-4 py-6 md:px-6 lg:px-8">
                <form id="admission-form" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3">

                    {/* ---- Basic Information ---- */}
                    <SectionDivider label="Basic Information" />

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Admission Number</label>
                      <input
                        type="text"
                        value={editingId ? formData.admissionNumber : "Auto-generated on save"}
                        readOnly
                        disabled
                        className="field mt-1 cursor-not-allowed bg-[#f4f5fb] text-[#5a6488]"
                      />
                      <p className="mt-1 text-xs font-medium text-[#7d86a8]">
                        {editingId ? "Admission number cannot be changed." : "Assigned automatically — no manual entry."}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">School ID <span className="font-normal text-[#7d86a8]">(optional)</span></label>
                      <input
                        type="text"
                        name="schoolId"
                        value={formData.schoolId}
                        onChange={handleChange}
                        placeholder="e.g. govt / SATS id"
                        className="field mt-1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Student Name *</label>
                      <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required placeholder="Full name" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Class *</label>
                      {/* Locked to this page's class — students are always admitted into the class in the URL. */}
                      <select
                        name="class"
                        value={routeClassId}
                        onChange={handleChange}
                        required
                        disabled
                        className="field mt-1 cursor-not-allowed bg-[#f4f5fb] text-[#5a6488]"
                      >
                        <option value={routeClassId}>{classLabel}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Section *</label>
                      <select name="section" value={formData.section} onChange={handleChange} required className="field mt-1">
                        {sectionsFor(formData.class).map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className="field mt-1">
                        <option value="">Select gender</option>
                        {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Date of Birth</label>
                      <div className="mt-1"><DatePicker name="dateOfBirth" value={formData.dateOfBirth} onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))} /></div>
                    </div>

                    {/* ---- Parent / Guardian Details ---- */}
                    <SectionDivider label="Parent / Guardian Details" />

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Father Name</label>
                      <input type="text" name="fatherName" value={formData.fatherName} onChange={handleChange} placeholder="Father's name" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Father Phone</label>
                      <input type="tel" name="fatherPhone" value={formData.fatherPhone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Mother Name</label>
                      <input type="text" name="motherName" value={formData.motherName} onChange={handleChange} placeholder="Mother's name" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Mother Phone</label>
                      <input type="tel" name="motherPhone" value={formData.motherPhone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Email</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Phone (Primary Contact)</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-semibold text-[#303247]">Address</label>
                      <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Street address" rows={2} className="field mt-1" />
                    </div>

                    {/* ---- Emergency Contact ---- */}
                    <SectionDivider label="Emergency Contact" />

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Contact Name</label>
                      <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} placeholder="Emergency contact name" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Contact Phone</label>
                      <input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} placeholder="10-digit number" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Relation</label>
                      <input type="text" name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} placeholder="e.g. uncle, grandparent" className="field mt-1" />
                    </div>

                    {/* ---- Photo & Documents ---- */}
                    <SectionDivider label="Photo & Documents" />

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Student Photo</label>
                      <div className="mt-1 flex items-center gap-3">
                        {formData.photoURL ? (
                          <div className="relative">
                            <img src={formData.photoURL} alt="Student" className="h-20 w-20 rounded-xl object-cover border border-[#edf0f7]" />
                            <button type="button" onClick={() => setFormData((prev) => ({ ...prev, photoURL: "" }))} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-[#ed515d] text-white text-xs">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-[#d0d5e8] bg-[#f7f8fd]">
                            <Camera size={24} className="text-[#9aa4c4]" />
                          </div>
                        )}
                        <label className="cursor-pointer rounded-lg bg-[#eef0ff] px-3 py-2 text-xs font-semibold text-[#3033a1] hover:bg-[#e3e5ff]">
                          <Upload size={14} className="inline mr-1" />
                          {uploading ? "Uploading..." : "Upload Photo"}
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Aadhaar Number</label>
                      <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} placeholder="12-digit Aadhaar" maxLength={12} className="field mt-1" />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-semibold text-[#303247]">Documents</label>
                      <div className="mt-1 space-y-2">
                        {formData.documentURLs.map((doc, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-[#edf0f7] bg-[#fafbff] px-3 py-2">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#3033a1] hover:underline truncate">{doc.name}</a>
                            <button type="button" onClick={() => removeDocument(i)} className="ml-2 text-[#ed515d] hover:text-[#c83f4d]">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#d0d5e8] px-3 py-2 text-xs font-semibold text-[#7d86a8] hover:border-[#3033a1] hover:text-[#3033a1]">
                          <Upload size={14} />
                          {uploading ? "Uploading..." : "Upload Document"}
                          <input type="file" onChange={handleDocumentUpload} className="hidden" disabled={uploading} />
                        </label>
                      </div>
                    </div>

                    {/* ---- Previous School Details ---- */}
                    <SectionDivider label="Previous School Details" />

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Previous School Name</label>
                      <input type="text" name="previousSchoolName" value={formData.previousSchoolName} onChange={handleChange} placeholder="School name" className="field mt-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Year Left</label>
                      <input type="text" name="previousSchoolYearLeft" value={formData.previousSchoolYearLeft} onChange={handleChange} placeholder="e.g. 2025-26" className="field mt-1" />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-semibold text-[#303247]">Previous School Address</label>
                      <input type="text" name="previousSchoolAddress" value={formData.previousSchoolAddress} onChange={handleChange} placeholder="School address" className="field mt-1" />
                    </div>

                    {/* ---- Sibling / Family Group ---- */}
                    <SectionDivider label="Sibling / Family Group" />

                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-semibold text-[#303247]">Sibling Admission Numbers</label>
                      <input type="text" name="siblingAdmissionNumbers" value={formData.siblingAdmissionNumbers} onChange={handleChange} placeholder="Comma-separated admission numbers, e.g. 1001, 1005" className="field mt-1" />
                      <p className="mt-1 text-xs font-medium text-[#7d86a8]">Enter admission numbers of siblings separated by commas.</p>
                    </div>

                    {/* ---- Transport ---- */}
                    <SectionDivider label="Transport" />

                    <div>
                      <label className="block text-sm font-semibold text-[#303247]">Transport Route</label>
                      <select name="transportRouteId" value={formData.transportRouteId} onChange={handleChange} className="field mt-1">
                        <option value="">No transport</option>
                        {transportRoutes.map((route) => (
                          <option key={route.id} value={route.id}>{route.name}</option>
                        ))}
                      </select>
                    </div>

                    {formData.transportRouteId && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#303247]">Stop</label>
                          <select
                            name="transportStopName"
                            value={formData.transportStopName}
                            onChange={(e) => {
                              const stopName = e.target.value;
                              setFormData((prev) => ({ ...prev, transportStopName: stopName }));
                              syncTransportFeeRow(formData.transportRouteId, stopName);
                            }}
                            className="field mt-1"
                          >
                            <option value="">Select stop</option>
                            {transportRoutes
                              .find((r) => r.id === formData.transportRouteId)
                              ?.stops.map((stop) => (
                                <option key={stop.name} value={stop.name}>
                                  {stop.name} (₹{stop.fee.toLocaleString("en-IN")})
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-xs font-medium text-[#7d86a8]">Stop fee auto-added as “Transport Fee” in Fee Details below.</p>
                        </div>
                      </>
                    )}

                    {/* ---- Fee Details ---- */}
                    <SectionDivider label="Fee Details" />

                    <div className="md:col-span-2 lg:col-span-3 space-y-4">
                      <div className="rounded-xl border border-[#edf0f7] bg-[#fafbff] p-4">
                        <h4 className="text-sm font-bold text-[#303247] mb-3">Fee Breakdown (per fee type)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[#edf0f7] text-xs font-bold uppercase tracking-wide text-[#6f7898]">
                                  <th className="px-3 py-2 text-left">Fee Type</th>
                                  <th className="px-3 py-2 text-right">Original (₹)</th>
                                  <th className="px-3 py-2 text-right">Committed Payable (₹)</th>
                                  <th className="px-3 py-2 text-right">Concession (₹)</th>
                                  <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(formData.feeHeads.length > 0 ? formData.feeHeads : [{ name: "Tuition Fee", original: Number(formData.annualEnrollmentFee || 0), committed: Number(formData.annualEnrollmentFee || 0) }]).map((head, idx) => {
                                  return (
                                <tr key={head.name} className="border-b border-[#edf0f7]">
                                  <td className="px-3 py-2 font-semibold text-[#303247]">{head.name}</td>
                                  <td className="px-3 py-2 text-right font-medium text-[#7d86a8]">₹{head.original.toLocaleString("en-IN")}</td>
                                  <td className="px-3 py-2 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      className="field w-32 text-right ml-auto"
                                      value={formData.feeHeads[idx]?.committed ?? head.original}
                                      onChange={(e) => {
                                        const val = Math.max(0, Number(e.target.value) || 0);
                                        setFormData((prev) => {
                                          const heads = [...prev.feeHeads];
                                          if (!heads[idx]) heads[idx] = { name: head.name, original: head.original, committed: head.original };
                                          heads[idx] = { ...heads[idx], committed: val };
                                          const totalCommitted = heads.reduce((s, h) => s + h.committed, 0);
                                          return { ...prev, feeHeads: heads, commitmentFee: String(totalCommitted) };
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-[#13a961]">
                                    ₹{Math.max(0, head.original - (formData.feeHeads[idx]?.committed ?? head.original)).toLocaleString("en-IN")}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {(CUSTOM_FEE_TYPES as readonly string[]).includes(head.name) && formData.feeHeads[idx] && (
                                      <button
                                        type="button"
                                        onClick={() => removeFeeHead(head.name)}
                                        aria-label={`Remove ${head.name}`}
                                        title={`Remove ${head.name}`}
                                        className="grid h-8 w-8 place-items-center rounded-lg text-[#7d86a8] hover:bg-[#ffebed] hover:text-[#c83f4d] ml-auto"
                                      >
                                        <X size={15} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                );
                                })}
                            </tbody>
                            <tfoot>
                              {(() => {
                                const heads = formData.feeHeads.length > 0 ? formData.feeHeads : [{ name: "Tuition Fee", original: Number(formData.annualEnrollmentFee || 0), committed: Number(formData.annualEnrollmentFee || 0) }];
                                const totalOriginal = heads.reduce((s, h) => s + h.original, 0);
                                const totalCommitted = heads.reduce((s, h) => s + h.committed, 0);
                                const totalConcession = totalOriginal - totalCommitted;
                                return (
                                  <tr className="border-t-2 border-[#3033a1] font-bold text-[#303247]">
                                    <td className="px-3 py-3">TOTAL</td>
                                    <td className="px-3 py-3 text-right">₹{totalOriginal.toLocaleString("en-IN")}</td>
                                    <td className="px-3 py-3 text-right text-[#3033a1]">₹{totalCommitted.toLocaleString("en-IN")}</td>
                                    <td className={`px-3 py-3 text-right ${totalConcession > 0 ? "text-[#13a961]" : "text-[#7d86a8]"}`}>
                                      ₹{totalConcession.toLocaleString("en-IN")}
                                    </td>
                                  </tr>
                                );
                              })()}
                            </tfoot>
                          </table>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-[#6f7898]">Fee Type</label>
                            <select value={newFeeType} onChange={(e) => setNewFeeType(e.target.value)} className="field mt-1 w-44">
                              {CUSTOM_FEE_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-[#6f7898]">Amount (₹)</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="₹0"
                              value={newFeeAmount}
                              onChange={(e) => setNewFeeAmount(e.target.value)}
                              className="field mt-1 w-36"
                            />
                          </div>
                          <button type="button" onClick={addFeeHead} className="btn-secondary">
                            <Plus size={15} /> Add Fee Type
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#edf0f7] bg-[#fafbff] p-4">
                        <h4 className="text-sm font-bold text-[#303247] mb-3">Fee Summary</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {(() => {
                            const totalOriginal = formData.feeHeads.reduce((s, h) => s + h.original, 0) || Number(formData.annualEnrollmentFee || 0);
                            const totalCommitted = formData.feeHeads.reduce((s, h) => s + h.committed, 0) || Number(formData.commitmentFee || 0);
                            const totalConcession = Math.max(0, totalOriginal - totalCommitted);
                            return (
                              <>
                                <div className="rounded-lg bg-[#f0f4ff] p-3">
                                  <p className="text-xs font-semibold text-[#6f7898]">Original Fee</p>
                                  <p className="text-lg font-extrabold text-[#303247]">₹{totalOriginal.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="rounded-lg bg-[#f0faf0] p-3">
                                  <p className="text-xs font-semibold text-[#6f7898]">Concession</p>
                                  <p className="text-lg font-extrabold text-[#13a961]">₹{totalConcession.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="rounded-lg bg-[#eef0ff] p-3">
                                  <p className="text-xs font-semibold text-[#6f7898]">Final Payable</p>
                                  <p className="text-lg font-extrabold text-[#3033a1]">₹{totalCommitted.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="rounded-lg bg-[#fff7e6] p-3">
                                  <p className="text-xs font-semibold text-[#6f7898]">Due (before payment)</p>
                                  <p className="text-lg font-extrabold text-[#ad7413]">₹{totalCommitted.toLocaleString("en-IN")}</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="text-xs font-medium text-[#7d86a8]">
                        {formData.feeHeads.some((h) => h.committed > h.original) && (
                          <span className="text-[#ed515d] font-semibold">Warning: Some committed amounts exceed original fee amounts.</span>
                        )}
                        {formData.feeHeads.length > 0 && !formData.feeHeads.some((h) => h.committed > h.original) && (
                          <span>Committed payable is the final fee after any concession. Fee structure total is ₹{(() => {
                            const totalOriginal = formData.feeHeads.reduce((s, h) => s + h.original, 0) || Number(formData.annualEnrollmentFee || 0);
                            return totalOriginal.toLocaleString("en-IN");
                          })()}.</span>
                        )}
                      </div>

                      <input type="hidden" name="commitmentFee" value={String(formData.feeHeads.reduce((s, h) => s + h.committed, 0) || Number(formData.commitmentFee || 0))} />
                    </div>

                  </div>

                  <div className="mt-8 flex flex-wrap gap-3 border-t border-[#edf0f7] pt-6">
                    <button type="submit" className="btn-primary">{editingId ? "Save Changes" : "Add Student"}</button>
                    <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-full border-t border-[#edf0f7] pt-4 pb-2">
      <h4 className="text-sm font-bold uppercase tracking-wide text-[#3033a1]">{label}</h4>
    </div>
  );
}
