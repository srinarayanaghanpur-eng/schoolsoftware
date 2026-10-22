/**
 * Teacher Homework — post homework to a class (parents get a push
 * automatically from the server) plus the teacher's recently posted list.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow,
  PageTitle, PillButton, SectionCard, TextField, TonalTile, useToast
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { TeacherShell } from "@/features/teacher/shell";
import { useTeacherAttendanceData } from "@/lib/useTeacherAttendanceData";
import {
  fetchAcademicYears, fetchPostedHomework, postHomework,
  type HomeworkItem
} from "@/features/admin/api";
import { asText } from "@/lib/text";

const CLASSES = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTIONS = ["A", "B", "C", "D", "E"];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function TeacherHomeworkRoute() {
  return (
    <TeacherShell>
      <TeacherHomework />
    </TeacherShell>
  );
}

function TeacherHomework() {
  const { t } = useTheme();
  const toast = useToast();
  const { teacher } = useTeacherAttendanceData();

  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(tomorrowKey());
  const [yearId, setYearId] = useState("");
  const [yearName, setYearName] = useState("");
  const [posting, setPosting] = useState(false);

  const [posted, setPosted] = useState<HomeworkItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Default subject from the teacher's profile; active academic year.
  useEffect(() => {
    if (teacher?.subject) setSubject((s) => s || teacher.subject);
  }, [teacher?.subject]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const years = await fetchAcademicYears();
        if (cancelled || years.length === 0) return;
        const active = years.find((y) => y.isActive) ?? years[0];
        setYearId(active.id);
        setYearName(active.name);
      } catch {
        // Years failing must not block posting — server validates anyway.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPosted = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const items = await fetchPostedHomework(
        teacher?.subject ? { subject: teacher.subject } : {}
      );
      setPosted(items);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Unable to load posted homework.");
    } finally {
      setLoadingList(false);
    }
  }, [teacher?.subject]);

  useEffect(() => {
    void loadPosted();
  }, [loadPosted]);

  const canPost = useMemo(
    () =>
      subject.trim() !== "" &&
      className !== "" &&
      title.trim() !== "" &&
      description.trim() !== "" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim()) &&
      yearId !== "" &&
      !posting,
    [subject, className, title, description, dueDate, yearId, posting]
  );

  const submit = async () => {
    if (!canPost) {
      toast.show(!yearId ? "Academic year is still loading. Try again." : "Fill class, subject, title, description and due date (YYYY-MM-DD).");
      return;
    }
    setPosting(true);
    try {
      await postHomework({
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        className,
        section: section || undefined,
        assignedDate: todayKey(),
        dueDate: dueDate.trim(),
        academicYearId: yearId
      });
      toast.show("Homework posted ✓ Parents notified.");
      setTitle("");
      setDescription("");
      setDueDate(tomorrowKey());
      await loadPosted();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Unable to post homework.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <FlatList
      data={posted}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ListRow
          leading={
            <TonalTile bg={t.tint}>
              <Icon name="menu-book" size={19} tint={t.blue} />
            </TonalTile>
          }
          title={asText(item.title) || "Homework"}
          subtitle={`${asText(item.subject) || "—"} · Class ${asText(item.className) || "—"}${asText(item.section) ? asText(item.section) : ""} · Due ${asText(item.dueDate) || "—"}`}
        />
      )}
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: t.line }]} />}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loadingList} onRefresh={loadPosted} tintColor={t.blue} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <PageTitle>Homework</PageTitle>

          <SectionCard heading="POST HOMEWORK">
            <DSText variant="label" tint={t.mute}>
              {yearName ? `Academic year ${yearName} · ` : ""}Parents of the class are notified automatically.
            </DSText>
            <TextField
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              accessibilityLabel="Subject"
            />
            <DSText variant="overline">CLASS</DSText>
            <FilterChips options={CLASSES} value={className} onChange={setClassName} />
            <DSText variant="overline">SECTION (OPTIONAL)</DSText>
            <FilterChips options={SECTIONS} value={section} onChange={(v) => setSection(v === section ? "" : v)} />
            <TextField
              value={title}
              onChangeText={setTitle}
              placeholder="Title — e.g. Exercise 4.2, Q1–Q10"
              accessibilityLabel="Homework title"
            />
            <TextField
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              multiline
              accessibilityLabel="Homework description"
            />
            <TextField
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="Due date YYYY-MM-DD"
              accessibilityLabel="Due date"
            />
            <PillButton
              label={posting ? "Posting…" : "Post homework"}
              block
              bg={t.blue}
              fg="#FFFFFF"
              icon="send"
              onPress={() => void submit()}
            />
          </SectionCard>

          <DSText variant="overline">RECENTLY POSTED</DSText>
        </View>
      }
      ListEmptyComponent={
        loadingList ? null : listError ? (
          <ErrorState message={listError} onRetry={loadPosted} />
        ) : (
          <EmptyState icon="menu-book" label="Nothing posted yet." />
        )
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  divider: { height: StyleSheet.hairlineWidth }
});
