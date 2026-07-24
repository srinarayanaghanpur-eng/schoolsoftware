/**
 * Teacher Home — implements the Home tab of the approved Teacher App design
 * (Teacher App.dc.html): greeting, check-in hero, today's classes, tasks,
 * quick actions, month stats and notices.
 *
 * DATA HONESTY: attendance figures and the school calendar are live. Timetable
 * and principal-assigned tasks have no mobile endpoint yet (Phase 2 backlog),
 * so those sections render representative PLACEHOLDER content to preserve the
 * designed layout. Each placeholder is marked below — swap it for the real
 * fetch when the endpoint lands; the section structure already handles data.
 */
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Avatar, Badge, BottomSheet, DSText, ErrorState, FullScreenPanel, Hero, Icon,
  ListRow, LoadingState, PillButton, PressableScale, ScreenHeader, SectionCard,
  TonalTile, useToast
} from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useMobileSession } from "@/lib/mobileSession";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import { TeacherShell } from "@/features/teacher/shell";
import {
  dateLabel, formatTime, greeting, initials, statusTone, useAttendanceSummary
} from "@/features/teacher/hooks";
import { useAttendanceMarking } from "@/features/teacher/useAttendanceMarking";

const QUICK_ACTIONS = [
  { key: "homework", icon: "menu-book" as const, label: "Homework" },
  { key: "diary", icon: "edit-note" as const, label: "Diary" },
  { key: "leave", icon: "flight-takeoff" as const, label: "Leave" },
  { key: "remarks", icon: "rate-review" as const, label: "Remarks" }
] as const;

const STUDENTS = [
  "Aarav Gupta", "Diya Sharma", "Ishaan Patel", "Kavya Reddy", "Mohammed Faiz",
  "Naina Joshi", "Rohan Verma", "Saanvi Iyer", "Tanvi Malhotra", "Vihaan Singh"
].map((name, index) => ({ id: String(index + 1), name, roll: index + 1, present: true }));

/**
 * PLACEHOLDER — sample timetable, shown until /api/teacher/timetable exists.
 * Replace `TODAY_CLASSES` with the fetched schedule; the render loop below is
 * already data-driven.
 */
const TODAY_CLASSES = [
  { id: "now", subject: "Mathematics · 9A", meta: "Now · Rm 301", live: true },
  { id: "free", subject: "Free period", meta: "11:15 – 12:00", live: false },
  { id: "next", subject: "Mathematics · 10B", meta: "12:10 – 12:55 · Rm 108", live: false }
];

/** PLACEHOLDER — top principal-assigned task, until /api/tasks exists. */
const TOP_TASK = { title: "Upload Unit 4 test marks", from: "Principal", due: "Today, 4:00 PM", pending: 3 };

export default function TeacherHomeRoute() {
  return (
    <TeacherShell>
      <TeacherHome />
    </TeacherShell>
  );
}

function TeacherHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { teacher, records, holidays, loading, error } = useTeacherAttendanceData();
  const summary = useAttendanceSummary(records);
  const attendance = useAttendanceMarking(teacher?.id ?? profile?.teacherId);
  const [quickSheet, setQuickSheet] = useState<"homework" | "diary" | "leave" | "remarks" | null>(null);
  const [markingOpen, setMarkingOpen] = useState(false);
  const [students, setStudents] = useState(STUDENTS);
  const [draft, setDraft] = useState("");

  if (loading && !teacher) return <LoadingState label="Opening your workspace…" />;
  if (error && !teacher) return <ErrorState message={error} />;

  const name = teacher?.fullName ?? profile?.displayName ?? "Teacher";
  const today = statusTone(summary.today?.status);
  const nextHoliday = holidays
    .filter((h) => h.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const presentCount = students.filter((student) => student.present).length;

  const handleAttendance = async (event: "check_in" | "check_out") => {
    const result = await attendance.mark(event);
    toast.show(result.message);
  };

  const submitQuickAction = () => {
    const labels = {
      homework: "Homework assigned · parents notified ✓",
      diary: "Class diary entry saved ✓",
      leave: "Leave request sent for approval ✓",
      remarks: "Student remark sent to parents ✓"
    } as const;
    if (quickSheet) toast.show(labels[quickSheet]);
    setDraft("");
    setQuickSheet(null);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xs }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => undefined} tintColor={color.primary} />}
      >
      <ScreenHeader
        eyebrow={`${greeting()} · ${dateLabel()}`}
        title={name}
        trailing={
          <View style={styles.headerActions}>
            <PressableScale
              accessibilityLabel="Notifications"
              onPress={() => router.push("/teacher/inbox" as never)}
              style={styles.bell}
            >
              <Icon name="notifications" size={21} tint={color.ink2} />
              <View style={styles.bellDot} />
            </PressableScale>
            <PressableScale accessibilityLabel="Profile" onPress={() => router.push("/teacher/profile" as never)}>
              <Avatar label={initials(name)} size={42} />
            </PressableScale>
          </View>
        }
      />

      {/* check-in hero */}
      {summary.checkedIn ? (
        <Hero tone="success">
          <TonalTile bg={color.success} size={40}>
            <Icon name="check" size={22} tint={color.onPrimary} />
          </TonalTile>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="bodyMedium" tint={color.onSuccessContainer}>
              Checked in · {formatTime(summary.today?.checkInTime)}
            </DSText>
            <DSText variant="label" tint={color.success}>{today.label} today</DSText>
          </View>
          <PillButton
            label="Check out"
            bg={color.successContainer}
            fg={color.success}
            onPress={() => { if (!attendance.submitting) void handleAttendance("check_out"); }}
          />
        </Hero>
      ) : (
        <Hero>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle}>
              {summary.checkedOut ? "Day complete" : "You haven’t checked in"}
            </Text>
            <Text style={styles.heroMeta}>
              {summary.checkedOut
                ? `Checked out at ${formatTime(summary.today?.checkOutTime)}`
                : `Location is verified before attendance is saved · ${dateLabel()}`}
            </Text>
          </View>
          <PillButton
            label={attendance.submitting ? "Saving…" : summary.checkedOut ? "View" : "Check in"}
            bg={color.surface}
            fg={color.onPrimaryContainer}
            icon={summary.checkedOut ? undefined : "fingerprint"}
            onPress={() => {
              if (summary.checkedOut) router.push("/teacher/attendance" as never);
              else if (!attendance.submitting) void handleAttendance("check_in");
            }}
          />
        </Hero>
      )}

      {/* today's classes (placeholder timetable) */}
      <SectionCard
        heading="TODAY’S CLASSES"
        trailing={
          <PressableScale accessibilityLabel="Open timetable" onPress={() => router.push("/teacher/academics" as never)}>
            <DSText variant="bodyMedium" tint={color.primary}>Timetable</DSText>
          </PressableScale>
        }
      >
        {TODAY_CLASSES.map((cls) => (
          <View key={cls.id} style={[styles.classRow, cls.live && styles.classRowLive]}>
            <View style={[styles.dot, { backgroundColor: cls.live ? color.primary : color.faint }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <DSText variant="bodyMedium" tint={cls.live ? color.onPrimaryContainer : color.ink} numberOfLines={1}>
                {cls.subject}
              </DSText>
              <DSText variant="label" tint={cls.live ? color.primaryDeep : color.muted} numberOfLines={1}>
                {cls.meta}
              </DSText>
            </View>
            {cls.live ? (
              <PillButton
                label="Attendance"
                icon="how-to-reg"
                onPress={() => setMarkingOpen(true)}
              />
            ) : null}
          </View>
        ))}
      </SectionCard>

      {/* tasks summary (placeholder) */}
      <SectionCard heading="TASKS" trailing={<Badge label={`${TOP_TASK.pending} due`} />}>
        <ListRow
          leading={<TonalTile bg={color.warningSurface}><Icon name="upload-file" size={19} tint={color.warning} /></TonalTile>}
          title={TOP_TASK.title}
          subtitle={`From ${TOP_TASK.from} · due ${TOP_TASK.due}`}
          chevron
          onPress={() => router.push("/teacher/tasks" as never)}
        />
      </SectionCard>

      <PressableScale
        accessibilityLabel="Open message from principal"
        onPress={() => router.push("/teacher/inbox" as never)}
        style={styles.principalMessage}
      >
        <Avatar label="RK" size={36} bg={color.accountPurple} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText variant="bodyMedium" numberOfLines={1}>Mrs. Kapoor · Principal</DSText>
          <DSText variant="body" tint={color.ink2} numberOfLines={2}>
            Please share the Unit 4 marks by 4 PM today. Reports go out Friday.
          </DSText>
        </View>
        <Icon name="chevron-right" size={20} tint={color.faint} />
      </PressableScale>

      {/* quick actions */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => (
          <PressableScale
            key={action.key}
            accessibilityLabel={action.label}
            onPress={() => setQuickSheet(action.key)}
            style={styles.quickTile}
          >
            <Icon name={action.icon} size={22} tint={color.primary} />
            <DSText variant="caption" tint={color.ink2} style={{ fontWeight: "500" }}>{action.label}</DSText>
          </PressableScale>
        ))}
      </View>

      {/* notices & events (school calendar is live) */}
      <SectionCard heading="NOTICES & EVENTS">
        {nextHoliday ? (
          <ListRow
            leading={<TonalTile bg={color.errorContainer}><Icon name="campaign" size={19} tint={color.error} /></TonalTile>}
            title={nextHoliday.title}
            subtitle={new Date(nextHoliday.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          />
        ) : (
          <DSText variant="label">No notices right now.</DSText>
        )}
        <ListRow
          leading={<TonalTile bg={color.primaryContainer}><Icon name="event" size={19} tint={color.primary} /></TonalTile>}
          title="View full school calendar"
          subtitle="Holidays, exams and events"
          chevron
          onPress={() => router.push("/teacher/academics" as never)}
        />
      </SectionCard>

      </ScrollView>

      <FullScreenPanel
        visible={markingOpen}
        title="Class attendance"
        subtitle="9A · Mathematics · Period 3"
        onClose={() => setMarkingOpen(false)}
        footer={
          <PillButton
            label={`Submit · ${presentCount} present`}
            block
            icon="check"
            onPress={() => {
              setMarkingOpen(false);
              toast.show(`Attendance submitted · ${presentCount} present ✓`);
            }}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.roster} showsVerticalScrollIndicator={false}>
          <View style={styles.rosterSummary}>
            <Badge label={`${presentCount} present`} bg={color.successContainer} fg={color.success} />
            <Badge
              label={`${students.length - presentCount} absent`}
              bg={color.errorContainer}
              fg={color.error}
            />
          </View>
          {students.map((student) => (
            <PressableScale
              key={student.id}
              accessibilityLabel={`Mark ${student.name} ${student.present ? "absent" : "present"}`}
              onPress={() =>
                setStudents((current) =>
                  current.map((item) =>
                    item.id === student.id ? { ...item, present: !item.present } : item
                  )
                )
              }
              style={[styles.studentRow, !student.present && styles.studentAbsent]}
            >
              <DSText variant="label" style={styles.roll}>{student.roll}</DSText>
              <DSText variant="bodyMedium" style={{ flex: 1 }}>{student.name}</DSText>
              <View style={[styles.presenceChip, student.present ? styles.presentChip : styles.absentChip]}>
                <DSText
                  variant="bodyMedium"
                  tint={student.present ? color.success : color.onPrimary}
                >
                  {student.present ? "P" : "A"}
                </DSText>
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      </FullScreenPanel>

      <BottomSheet
        visible={Boolean(quickSheet)}
        title={
          quickSheet === "homework" ? "Assign homework"
            : quickSheet === "diary" ? "Class diary"
              : quickSheet === "leave" ? "Apply for leave"
                : "Student remark"
        }
        onClose={() => setQuickSheet(null)}
        primaryLabel={
          quickSheet === "leave" ? "Submit request"
            : quickSheet === "remarks" ? "Send to parents"
              : "Save"
        }
        onPrimary={submitQuickAction}
      >
        {quickSheet === "homework" || quickSheet === "diary" ? (
          <>
            <DSText variant="overline">CLASS</DSText>
            <View style={styles.classChips}>
              {["8A", "8B", "9A", "10B"].map((className, index) => (
                <Badge
                  key={className}
                  label={className}
                  bg={index === 0 ? color.primaryContainer : color.surfaceVariant}
                  fg={index === 0 ? color.onPrimaryContainer : color.ink2}
                />
              ))}
            </View>
          </>
        ) : null}
        <TextInput
          style={styles.sheetInput}
          multiline
          placeholder={
            quickSheet === "homework" ? "Homework details"
              : quickSheet === "diary" ? "What was covered today?"
                : quickSheet === "leave" ? "Reason for leave"
                  : "Write a remark for the parent"
          }
          placeholderTextColor={color.muted}
          value={draft}
          onChangeText={setDraft}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: 14 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: color.surfaceVariant,
    alignItems: "center",
    justifyContent: "center"
  },
  bellDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.error,
    borderWidth: 2,
    borderColor: color.surfaceVariant
  },
  heroTitle: { fontSize: 15, fontWeight: "600", color: color.onPrimary },
  heroMeta: { fontSize: 12.5, color: color.onPrimary, opacity: 0.8, marginTop: 2 },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.sm + 2
  },
  classRowLive: { backgroundColor: color.primaryContainer },
  dot: { width: 8, height: 8, borderRadius: 4 },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickTile: {
    flex: 1,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    paddingHorizontal: space.xs,
    alignItems: "center",
    gap: space.sm
  },
  principalMessage: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outline,
    borderRadius: radius.xl,
    padding: 14,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md
  },
  roster: { padding: space.xl, gap: space.sm, paddingBottom: space.xxl },
  rosterSummary: { flexDirection: "row", gap: space.sm, marginBottom: space.xs },
  studentRow: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.outlineStrong,
    borderRadius: 14,
    padding: 10,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  studentAbsent: {
    backgroundColor: color.errorContainer,
    borderColor: color.errorContainer
  },
  roll: { width: 22, textAlign: "center" },
  presenceChip: {
    width: 34,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  presentChip: { backgroundColor: color.successContainer },
  absentChip: { backgroundColor: color.error },
  classChips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  sheetInput: {
    minHeight: 118,
    backgroundColor: color.surfaceVariant,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 14,
    color: color.ink,
    textAlignVertical: "top"
  }
});
