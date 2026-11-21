/**
 * Shared management screens.
 *
 * Admin and Principal see the same staff / approvals / profile surfaces; the
 * only difference is the surrounding shell and its tab set. Keeping the bodies
 * here means one implementation instead of two drifting copies.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Avatar, Badge, BottomSheet, Card, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow,
  SkeletonPage, PageTitle, PillButton, PressableScale, ProgressRow, SectionCard, TextField, TonalTile, useToast,
  type IconName
} from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole, workspaceForRole, workspaceLabel } from "@/lib/roleRouting";
import { displayLoginContact } from "@/lib/text";
import { openWebsite } from "@/lib/openWebsite";
import { ROLE_LABELS } from "@sri-narayana/shared";
import { initials } from "@/features/teacher/hooks";
import {
  assignTask, createExam, decideChangeRequest, deleteExam, fetchAcademicYears,
  fetchVouchersByCategory, fetchVouchersByIds, reviewLeaveRequest, updateExam,
  updateTaskStatus, type ExamInput
} from "../api";
import type { AdminTeacher, DebitVoucher, Exam, Expense, StaffDriver, StaffOffice } from "../api";
import {
  formatDate, formatMoney, formatMoneyShort, formatText, useCashBook,
  useChangeRequests, useDashboardStats, useExams, useExpenses, useLeaveRequests,
  useStaffDirectory, useTasks, useTodayAttendance
} from "../hooks";
import { styles } from "./styles";
import { ADMIN_OFFICE_ROLES, STAFF_FILTERS, SUPPORT_ROLES, matchesStaffFilter, matchesStaffQuery, normalizeStaffRole, staffCategoryForOffice, staffField } from "./shared";
import type { StaffSection } from "./shared";

const EXAM_TYPES = [
  { label: "Unit test", value: "unit_test" },
  { label: "Midterm", value: "midterm" },
  { label: "Final", value: "final" },
  { label: "Olympiad", value: "olympiad" },
  { label: "Other", value: "other" }
];

export function ExamsScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { exams, loading, error, refresh } = useExams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [examType, setExamType] = useState("unit_test");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [academicYearId, setAcademicYearId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Exam | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAcademicYears()
      .then((years) => {
        if (!active || years.length === 0) return;
        const year = years.find((item) => item.isActive) ?? years[0];
        setAcademicYearId(year.id);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const examTypeLabel = EXAM_TYPES.find((option) => option.value === examType)?.label ?? "Unit test";

  const openCreate = () => {
    setEditing(null);
    setName("");
    setClassName("");
    setExamType("unit_test");
    setStartDate("");
    setEndDate("");
    setMaxMarks("100");
    setFormOpen(true);
  };

  const openEdit = (exam: Exam) => {
    setEditing(exam);
    setName(exam.name ?? "");
    setClassName(exam.className ?? "");
    setExamType(exam.examType ?? "unit_test");
    setStartDate(exam.startDate ?? "");
    setEndDate(exam.endDate ?? "");
    setMaxMarks(String(exam.maxMarks ?? 100));
    if (exam.academicYearId) setAcademicYearId(exam.academicYearId);
    setExpandedId(exam.id);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!name.trim() || !className.trim() || !startDate.trim()) {
      toast.show("Enter the exam name, class and start date.");
      return;
    }
    const marks = Number(maxMarks);
    if (!Number.isFinite(marks) || marks <= 0) {
      toast.show("Enter valid maximum marks.");
      return;
    }
    setSaving(true);
    try {
      let yearId = academicYearId;
      if (!yearId) {
        const years = await fetchAcademicYears();
        yearId = (years.find((item) => item.isActive) ?? years[0])?.id ?? "";
      }
      if (!yearId) throw new Error("No academic year found. Set an active academic year on the web dashboard.");
      const input: ExamInput = {
        name: name.trim(),
        academicYearId: yearId,
        className: className.trim(),
        examType: examType as ExamInput["examType"],
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        maxMarks: marks
      };
      if (editing) await updateExam(editing.id, input);
      else await createExam(input);
      toast.show(editing ? "Exam updated." : "Exam created.");
      setFormOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Could not save the exam.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const exam = deleting;
    setDeleting(null);
    try {
      await deleteExam(exam.id);
      toast.show("Exam deleted.");
      setExpandedId(null);
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Could not delete the exam.");
    }
  };

  if (loading && exams.length === 0) return <SkeletonPage />;
  if (error && exams.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <>
    <FlatList
      data={exams}
      keyExtractor={(exam) => exam.id}
      renderItem={({ item: exam }) => {
        const expanded = expandedId === exam.id;
        const papers = exam.timetable ?? [];
        return (
          <SectionCard
            heading={((exam.examType ?? exam.name ?? "EXAM") as string).toUpperCase()}
            trailing={
              <DSText variant="caption">
                {[exam.startDate, exam.endDate].filter(Boolean).join(" – ") || ""}
              </DSText>
            }
          >
            <ListRow
              leading={
                <TonalTile bg={t.tint}>
                  <Icon name="school" size={19} tint={t.blue} />
                </TonalTile>
              }
              title={exam.name ?? "Exam"}
              subtitle={`Class ${exam.className ?? "—"}${exam.section ? ` ${exam.section}` : ""} · ${papers.length} paper${papers.length === 1 ? "" : "s"}`}
              chevron
              onPress={() => setExpandedId(expanded ? null : exam.id)}
            />
            {expanded ? (
              <View style={{ marginTop: space.sm, gap: space.xs }}>
                {papers.length === 0 ? (
                  <DSText variant="label" tint={t.mute}>Timetable not published yet.</DSText>
                ) : (
                  papers.map((paper, index) => (
                    <View
                      key={`${paper.subject ?? index}-${paper.date ?? index}`}
                      style={[styles.examPaper, { borderColor: t.line }]}
                    >
                      <DSText variant="bodyMedium" style={{ flex: 1 }}>{paper.subject ?? "—"}</DSText>
                      <DSText variant="caption">{paper.date ?? ""}{paper.time ? ` · ${paper.time}` : ""}</DSText>
                    </View>
                  ))
                )}
                <View style={styles.examActions}>
                  <View style={{ flex: 1 }}>
                    <PillButton label="Edit exam" block onPress={() => openEdit(exam)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PillButton
                      label="Delete"
                      block
                      bg={t.badBg}
                      fg={t.bad}
                      onPress={() => setDeleting(exam)}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </SectionCard>
        );
      }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Exams</PageTitle>
          <PillButton label="New exam" block bg={t.blue} fg="#FFFFFF" icon="add" onPress={openCreate} />
        </View>
      }
      ListEmptyComponent={
        <EmptyState icon="school" label="No exams scheduled yet." />
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={true}
    />

    <BottomSheet
      visible={formOpen}
      title={editing ? "Edit exam" : "New exam"}
      onClose={() => { setFormOpen(false); setEditing(null); }}
    >
      <View style={styles.examForm}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Exam name — e.g. Half yearly"
          autoCapitalize="words"
          accessibilityLabel="Exam name"
        />
        <TextField
          value={className}
          onChangeText={setClassName}
          placeholder="Class — e.g. 10"
          accessibilityLabel="Class"
        />
        <DSText variant="label">Exam type</DSText>
        <FilterChips
          options={EXAM_TYPES.map((option) => option.label)}
          value={examTypeLabel}
          onChange={(label) => setExamType(EXAM_TYPES.find((option) => option.label === label)?.value ?? "unit_test")}
        />
        <TextField
          value={startDate}
          onChangeText={setStartDate}
          placeholder="Start date YYYY-MM-DD"
          accessibilityLabel="Start date"
        />
        <TextField
          value={endDate}
          onChangeText={setEndDate}
          placeholder="End date YYYY-MM-DD (optional)"
          accessibilityLabel="End date"
        />
        <TextField
          value={maxMarks}
          onChangeText={setMaxMarks}
          placeholder="Maximum marks"
          keyboardType="numeric"
          accessibilityLabel="Maximum marks"
        />
        <PillButton
          label={saving ? "Saving…" : editing ? "Save changes" : "Create exam"}
          block
          bg={t.blue}
          fg="#FFFFFF"
          onPress={() => { if (!saving) void submit(); }}
        />
      </View>
    </BottomSheet>

    <BottomSheet
      visible={Boolean(deleting)}
      title="Delete exam?"
      onClose={() => setDeleting(null)}
    >
      <DSText variant="label">
        {deleting ? `“${deleting.name ?? "Exam"}” and its marks will be removed permanently.` : ""}
      </DSText>
      <View style={styles.decisionRow}>
        <View style={{ flex: 1 }}>
          <PillButton label="Keep" block onPress={() => setDeleting(null)} />
        </View>
        <View style={{ flex: 1 }}>
          <PillButton label="Delete" block bg={t.bad} fg="#FFFFFF" onPress={() => void confirmDelete()} />
        </View>
      </View>
    </BottomSheet>
    </>
  );
}

/* --------------------------------------------------------------- Expenses */
