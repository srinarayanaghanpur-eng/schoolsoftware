"use client";

// The A4 admission sheet (print/preview body).
import { useRef } from "react";
import type { StudentData } from "./form-types";
import type { AdmissionResolved } from "./useAdmissionData";
import {
  resolveValue,
  display,
  formatDate,
  formatDateTime,
  previousSchoolName,
  previousSchoolValue,
  emergencyValue,
  documentNames,
  hasDocument,
  otherDocumentNames,
} from "./formatters";
import { FieldBox, FormSection, ChecklistItem, SignatureLine, DataRow } from "./AdmissionFieldKit";

export function AdmissionPrintSheet({
  r,
  student,
  printedAt,
}: {
  r: AdmissionResolved;
  student: StudentData;
  printedAt: Date;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  return (
      <div className="af-a4-wrapper">
        <div ref={printRef} className="af-a4-sheet" id="admission-form-print">
          {/* Header */}
          <div className="af-header">
            <div className="af-header-left">
              <div className="af-logo">
                <img
                  src="/sri-narayana-high-school-logo.jpg"
                  alt="School Logo"
                />
              </div>
              <div className="af-school-info">
                <h1 className="af-school-name">
                  SRI NARAYANA HIGH SCHOOL
                </h1>
                <p className="af-school-address">
                  Ghanpur (M), Jayashankar Bhupalpally District
                </p>
                <p className="af-school-contact">
                  Phone: 6300038389 &nbsp;|&nbsp; Academic Year:{" "}
                  {r.academicYearName}
                </p>
              </div>
            </div>
            <div className="af-photo-box">
              {student.photoURL ? (
                <img
                  src={student.photoURL}
                  alt="Student"
                  className="af-photo-img"
                />
              ) : (
              <div className="af-photo-placeholder">
                <span>STUDENT PHOTOGRAPH</span>
                <span>(affix passport-size photo)</span>
              </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="af-title-bar">
            DIGITAL STUDENT ADMISSION FORM
          </div>
          <div className="af-title-sub">
            ACADEMIC YEAR: {r.academicYearName || "—"}
          </div>

          {/* Admission Number & Date Strip */}
          <div className="af-strip">
            <div className="af-strip-item">
              <span className="af-strip-label">Admission No.</span>
              <span className="af-strip-value">{r.admissionNo}</span>
            </div>
            <div className="af-strip-item">
              <span className="af-strip-label">Admission Date</span>
              <span className="af-strip-value">
                {formatDate(r.admissionDate)}
              </span>
            </div>
            <div className="af-strip-item">
              <span className="af-strip-label">Class Applied</span>
              <span className="af-strip-value">{r.classApplied}</span>
            </div>
          </div>

          {/* Section A: Admission Details */}
          <FormSection number={1} title="ADMISSION DETAILS">
            <FieldBox label="Admission Number" value={r.admissionNo} />
            <FieldBox label="Admission Date" value={formatDate(r.admissionDate)} />
            <FieldBox label="Class Applied" value={r.classApplied} />
            <FieldBox label="Section" value={r.section} />
            <FieldBox label="Medium" value={r.medium} />
            <FieldBox label="Academic Year" value={r.academicYearName} />
            <FieldBox label="Second Language" value={r.secondLang} />
            <FieldBox label="Admission Type" value={r.admissionType} />
          </FormSection>

          {/* Section B: Student Details */}
          <FormSection number={2} title="STUDENT DETAILS">
            <FieldBox label="Student Name" value={r.name} />
            <FieldBox label="Gender" value={r.gender} />
            <FieldBox label="Date of Birth" value={formatDate(r.dob)} />
            <FieldBox label="Aadhaar Number" value={r.aadhaar} />
            <FieldBox label="Blood Group" value={r.bloodGroup} />
            <FieldBox label="EMIS / Child ID" value={r.emis} />
            <FieldBox label="Nationality" value={r.nationality} />
            <FieldBox label="Mother Tongue" value={r.motherTongue} />
            <FieldBox label="Category" value={r.category} />
          </FormSection>

          {/* Section C: Parent/Guardian Details */}
          <FormSection number={3} title="PARENT / GUARDIAN DETAILS">
            <FieldBox label="Father Name" value={r.fatherName} />
            <FieldBox label="Father Mobile" value={r.fatherMobile} />
            <FieldBox label="Father Occupation" value={r.fatherOcc} />
            <FieldBox label="Mother Name" value={r.motherName} />
            <FieldBox label="Mother Mobile" value={r.motherMobile} />
            <FieldBox label="Mother Occupation" value={r.motherOcc} />
            <FieldBox label="Guardian Name" value={r.guardianName} />
            <FieldBox label="Relation" value={r.guardianRelation} />
            <FieldBox label="Emergency Number" value={r.emergencyPhone} />
          </FormSection>

          {/* Section D: Address Details */}
          <FormSection number={4} title="ADDRESS DETAILS" cols={2}>
            <FieldBox
              label="House / Street"
              value={r.addressLine || "—"}
              wide
            />
            <FieldBox label="Village / Area" value={r.village} />
            <FieldBox label="Mandal" value={r.mandal} />
            <FieldBox label="District" value={r.district} />
            <FieldBox label="PIN Code" value={r.pincode} />
          </FormSection>

          {/* Section E: Previous School, Transport, Fee */}
          <FormSection number={5} title="PREVIOUS SCHOOL, TRANSPORT & FEE">
            <FieldBox label="Previous School" value={r.prevSchool} />
            <FieldBox label="Last Studied Class" value={r.lastClass} />
            <FieldBox label="TC Number" value={r.tcNo} />
            <FieldBox label="Transport Required" value={r.transportRequired} />
            <FieldBox label="Route / Village" value={r.routeName} />
            <FieldBox label="Pickup Point" value={r.pickupPoint} />
            <FieldBox label="Fee Plan" value={r.feePlan} />
            <FieldBox label="Fee Types Assigned" value={r.feeTypes} wide />
            <FieldBox label="Total Committed Fee" value={r.totalFee} />
            <FieldBox label="Concession" value={r.concession} />
          </FormSection>

          {/* Section F: Documents Checklist */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">06</span>
              <span>DOCUMENTS CHECKLIST</span>
            </div>
            <div className="af-checklist-grid">
              <ChecklistItem
                label="Birth Certificate"
                checked={hasDocument(student, ["birth"])}
              />
              <ChecklistItem
                label="Student Aadhaar"
                checked={
                  Boolean(r.aadhaar) ||
                  hasDocument(student, ["student aadhaar", "aadhaar"])
                }
              />
              <ChecklistItem
                label="Parent Aadhaar"
                checked={hasDocument(student, [
                  "parent aadhaar",
                  "father aadhaar",
                  "mother aadhaar",
                ])}
              />
              <ChecklistItem
                label="TC / Bonafide"
                checked={
                  Boolean(r.tcNo) ||
                  hasDocument(student, ["tc", "bonafide"])
                }
              />
              <ChecklistItem
                label="Previous Report Card"
                checked={hasDocument(student, ["report"])}
              />
              <ChecklistItem
                label="Passport Photos"
                checked={
                  Boolean(student.photoURL) ||
                  hasDocument(student, ["photo"])
                }
              />
              <ChecklistItem
                label="Caste / Income Certificate"
                checked={hasDocument(student, ["caste", "income"])}
              />
              <ChecklistItem
                label="Other Documents"
                checked={(student.documentURLs ?? []).length > 0}
              />
            </div>
            <div className="af-other-docs">
              <span className="af-other-docs-label">Other Documents (specify):</span>
              <span className="af-other-docs-value">{display(otherDocumentNames(student))}</span>
            </div>
          </div>

          {/* Section G: Declaration */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">07</span>
              <span>DECLARATION</span>
            </div>
            <div className="af-declaration-box">
              <p className="af-declaration-text">
                I, the parent/guardian of{" "}
                <strong>{r.name || "the above-named student"}</strong>, hereby
                declare that all the information provided in this admission form
                is true and correct to the best of my knowledge. I agree to abide
                by the rules and regulations of Sri Narayana High School,
                including the fee schedule, attendance policy, uniform rules,
                code of conduct, and transport safety instructions. I understand
                that any false information may lead to the cancellation of
                admission.
              </p>
            </div>
          </div>

          {/* Section H: Signatures */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">08</span>
              <span>SIGNATURES</span>
            </div>
            <div className="af-signatures">
              <SignatureLine title="Parent / Guardian Signature" />
              <SignatureLine title="Student Signature" />
              <SignatureLine title="Principal / Office Signature" />
            </div>
          </div>

          {/* Section I: Office Use Only */}
          <div className="af-section">
            <div className="af-section-heading">
              <span className="af-section-number">09</span>
              <span>OFFICE USE ONLY</span>
            </div>
            <div className="af-grid af-grid-3">
              <FieldBox label="Admission Status" value={r.admissionStatus} />
              <FieldBox label="Verified By" value={r.verifiedByName} />
              <FieldBox label="Created By" value={r.createdByName} />
              <FieldBox label="Student Login" value={r.studentLogin} />
              <FieldBox label="Parent Login" value={r.parentLogin} />
              <FieldBox
                label="Created Date"
                value={formatDateTime(student.createdAt)}
              />
              <FieldBox
                label="Last Updated"
                value={formatDateTime(student.updatedAt)}
              />
              <FieldBox label="Branch" value={r.branchName} />
              <FieldBox label="School ID" value={resolveValue(student.schoolId)} />
            </div>
          </div>

          {/* Record Footer — internal record IDs stay server-side only and are
              never printed. The human admission number is already on the form. */}
          <div className="af-footer">
            <span className="af-footer-text">
              Printed on{" "}
              {printedAt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              at{" "}
              {printedAt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>
  );
}
