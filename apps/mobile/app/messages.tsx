import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { db } from "@/lib/firebase";
import { palette, themeForRole } from "@/lib/mobileTheme";
import { isAdminWorkspaceRole, useMobileSession, type MobileUserProfile } from "@/lib/mobileSession";
import { addDoc, collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { Role } from "@sri-narayana/shared";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const MESSAGE_COLLECTION = "campus_teacher_messages";

type TeacherOption = {
  id: string;
  fullName: string;
  employeeId: string;
  subject: string;
  status: "active" | "inactive";
};

type CampusTeacherMessage = {
  id: string;
  title: string;
  body: string;
  senderName: string;
  senderRole: Role;
  targetMode: "all" | "selected";
  targetTeacherIds: string[];
  createdAt: string;
};

type FirestoreDocLike = { id: string; data: () => unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeTeacher(id: string, data: Record<string, unknown>): TeacherOption {
  return {
    id,
    fullName: asString(data.fullName, "Teacher"),
    employeeId: asString(data.employeeId, id),
    subject: asString(data.subject, "General"),
    status: data.status === "inactive" ? "inactive" : "active"
  };
}

function normalizeMessage(id: string, data: Record<string, unknown>): CampusTeacherMessage {
  const targetTeacherIds = Array.isArray(data.targetTeacherIds)
    ? data.targetTeacherIds.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id,
    title: asString(data.title, "Campus message"),
    body: asString(data.body),
    senderName: asString(data.senderName, "School office"),
    senderRole: data.senderRole as Role,
    targetMode: data.targetMode === "selected" ? "selected" : "all",
    targetTeacherIds,
    createdAt: asString(data.createdAt, new Date(0).toISOString())
  };
}

async function loadTeachers() {
  const snapshot = await getDocs(query(collection(db, "teachers"), limit(300)));
  return snapshot.docs
    .map((item: FirestoreDocLike) => normalizeTeacher(item.id, asRecord(item.data())))
    .filter((teacher: TeacherOption) => teacher.status === "active")
    .sort((left: TeacherOption, right: TeacherOption) => left.fullName.localeCompare(right.fullName));
}

async function loadMessages(profile: MobileUserProfile | null) {
  const snapshot = await getDocs(query(collection(db, MESSAGE_COLLECTION), orderBy("createdAt", "desc"), limit(75)));
  const messages = snapshot.docs.map((item: FirestoreDocLike) => normalizeMessage(item.id, asRecord(item.data())));

  if (!profile) return [];
  if (isAdminWorkspaceRole(profile.role)) return messages;
  if (profile.role !== "teacher") return [];

  const teacherId = profile.teacherId;
  if (!teacherId) return messages.filter((message: CampusTeacherMessage) => message.targetMode === "all");
  return messages.filter((message: CampusTeacherMessage) => message.targetMode === "all" || message.targetTeacherIds.includes(teacherId));
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const { profile } = useMobileSession();
  const theme = themeForRole(profile?.role);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [messages, setMessages] = useState<CampusTeacherMessage[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCompose = isAdminWorkspaceRole(profile?.role);

  const selectedLabel = useMemo(() => {
    if (selectedTeacherIds.length === 0) return "No teacher selected: sends to everyone";
    return `${selectedTeacherIds.length} teacher${selectedTeacherIds.length === 1 ? "" : "s"} selected`;
  }, [selectedTeacherIds.length]);

  const refresh = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [nextMessages, nextTeachers] = await Promise.all([
        loadMessages(profile),
        canCompose ? loadTeachers() : Promise.resolve([])
      ]);
      setMessages(nextMessages);
      setTeachers(nextTeachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [profile?.uid, profile?.role, profile?.teacherId]);

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((current) => (
      current.includes(teacherId) ? current.filter((item) => item !== teacherId) : [...current, teacherId]
    ));
  };

  const sendMessage = async () => {
    if (!profile || !canCompose) return;
    if (!title.trim() || !body.trim()) {
      Alert.alert("Missing message", "Add a title and message before sending.");
      return;
    }

    setSending(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, MESSAGE_COLLECTION), {
        title: title.trim(),
        body: body.trim(),
        senderUid: profile.uid,
        senderName: profile.displayName,
        senderRole: profile.role,
        audience: "teachers",
        targetMode: selectedTeacherIds.length > 0 ? "selected" : "all",
        targetTeacherIds: selectedTeacherIds,
        createdAt: now,
        updatedAt: now
      });
      setTitle("");
      setBody("");
      setSelectedTeacherIds([]);
      await refresh();
      Alert.alert("Message sent", selectedTeacherIds.length > 0 ? "Sent to the selected teachers." : "Sent to all active teachers.");
    } catch (err) {
      Alert.alert("Send failed", err instanceof Error ? err.message : "Unable to send the message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen title="Messages" subtitle="Daily campus communication">
      {canCompose ? (
        <Card>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Message teachers</Text>
          <Text style={styles.helper} allowFontScaling={false}>{selectedLabel}</Text>
          <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#8a90ac" value={title} onChangeText={setTitle} allowFontScaling={false} />
          <TextInput style={[styles.input, styles.bodyInput]} placeholder="Message for teachers" placeholderTextColor="#8a90ac" value={body} onChangeText={setBody} multiline allowFontScaling={false} />
          <View style={styles.teacherWrap}>
            {teachers.map((teacher) => {
              const selected = selectedTeacherIds.includes(teacher.id);
              return (
                <Pressable key={teacher.id} style={[styles.teacherChip, selected && { backgroundColor: theme.tint, borderColor: theme.accent }]} onPress={() => toggleTeacher(teacher.id)}>
                  <Text style={[styles.teacherName, selected && { color: theme.accent }]} allowFontScaling={false}>{teacher.fullName}</Text>
                  <Text style={styles.teacherMeta} allowFontScaling={false}>{teacher.employeeId} | {teacher.subject}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={({ pressed }) => [styles.sendButton, { backgroundColor: theme.accent }, pressed && styles.pressed, sending && styles.disabled]} onPress={sendMessage} disabled={sending}>
            <Text style={styles.sendText} allowFontScaling={false}>{sending ? "Sending..." : "Send message"}</Text>
          </Pressable>
        </Card>
      ) : profile?.role === "teacher" ? (
        <Card>
          <Text style={styles.sectionTitle} allowFontScaling={false}>From campus office</Text>
          <Text style={styles.helper} allowFontScaling={false}>Messages sent to all teachers or directly to you appear here.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Messages</Text>
          <Text style={styles.helper} allowFontScaling={false}>Teacher campus messages are managed by Admin and Principal accounts.</Text>
        </Card>
      )}

      {loading ? (
        <Card><Text style={styles.helper} allowFontScaling={false}>Loading messages...</Text></Card>
      ) : error ? (
        <Card><Text style={styles.errorText} allowFontScaling={false}>{error}</Text></Card>
      ) : messages.length === 0 ? (
        <Card><Text style={styles.helper} allowFontScaling={false}>No campus messages yet.</Text></Card>
      ) : (
        messages.map((message) => (
          <Card key={message.id}>
            <View style={styles.messageTop}>
              <View style={styles.messageCopy}>
                <Text style={styles.messageTitle} allowFontScaling={false}>{message.title}</Text>
                <Text style={styles.messageMeta} allowFontScaling={false}>{message.senderName} | {dateLabel(message.createdAt)}</Text>
              </View>
              <View style={[styles.modePill, { backgroundColor: message.targetMode === "all" ? palette.goodTint : theme.tint }]}>
                <Text style={[styles.modeText, { color: message.targetMode === "all" ? palette.good : theme.accent }]} allowFontScaling={false}>{message.targetMode === "all" ? "All" : "Selected"}</Text>
              </View>
            </View>
            <Text style={styles.messageBody} allowFontScaling={false}>{message.body}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: "900", marginBottom: 6 },
  helper: { color: palette.ink2, fontSize: 13, lineHeight: 19, fontWeight: "700", marginBottom: 12 },
  input: { backgroundColor: "#f8f9ff", borderWidth: 1, borderColor: palette.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 10, color: palette.ink, fontSize: 14, fontWeight: "700" },
  bodyInput: { minHeight: 96, textAlignVertical: "top" },
  teacherWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  teacherChip: { borderWidth: 1, borderColor: palette.line, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 8, maxWidth: "48%" },
  teacherName: { color: palette.ink, fontSize: 12, fontWeight: "900" },
  teacherMeta: { marginTop: 2, color: palette.ink3, fontSize: 10, fontWeight: "700" },
  sendButton: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sendText: { color: "white", fontSize: 15, fontWeight: "900" },
  messageTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  messageCopy: { flex: 1 },
  messageTitle: { color: palette.ink, fontSize: 15, fontWeight: "900" },
  messageMeta: { marginTop: 4, color: palette.ink3, fontSize: 11, fontWeight: "700" },
  modePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  modeText: { fontSize: 10, fontWeight: "900" },
  messageBody: { marginTop: 12, color: palette.ink2, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  errorText: { color: palette.bad, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] }
});
