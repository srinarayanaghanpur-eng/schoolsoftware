/**
 * School notices — shared by admin, principal and accountant routes.
 * Admin/principal can create, edit and delete; accountant stays read-only.
 */
import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  BottomSheet, DSText, EmptyState, ErrorState, FilterChips, Icon, ListRow, SkeletonPage,
  PageTitle, PillButton, PressableScale, TextField, TonalTile, useToast
} from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { useTheme } from "@/lib/Theme";
import { useMobileSession } from "@/lib/mobileSession";
import { AdminShell } from "@/features/admin/shell";
import { createNotice, deleteNotice, updateNotice, type Notice } from "@/features/admin/api";
import { formatDate, useNotices } from "@/features/admin/hooks";

const CATEGORIES = [
  { label: "School", value: "school" },
  { label: "Holiday", value: "holiday" },
  { label: "Exam", value: "exam" },
  { label: "Event", value: "event" },
  { label: "Fee", value: "fee" },
  { label: "Emergency", value: "emergency" }
];

const AUDIENCES = ["Everyone", "Parents", "Teachers"];

export default function AdminNoticesRoute() {
  return (
    <AdminShell>
      <NoticesScreen />
    </AdminShell>
  );
}

/** Shared circulars list — reused by principal + accountant routes. */
export function NoticesScreen() {
  const { t } = useTheme();
  const toast = useToast();
  const { profile } = useMobileSession();
  const { notices, loading, error, refresh } = useNotices();
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("school");
  const [audience, setAudience] = useState("Everyone");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Notice | null>(null);

  const role = profile?.role ?? "";
  const canManage = ["super_admin", "admin", "settings_manager", "principal"].includes(role);
  const visible = showAll ? notices : notices.slice(0, 10);
  const categoryLabel = CATEGORIES.find((item) => item.value === category)?.label ?? "School";

  const tiles = [
    { bg: t.tint, tint: t.blue },
    { bg: t.tint, tint: t.blue },
    { bg: t.warnBg, tint: t.warn },
    { bg: t.okBg, tint: t.ok }
  ];

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setCategory("school");
    setAudience("Everyone");
    setFormOpen(true);
  };

  const openEdit = (notice: Notice) => {
    if (!canManage) return;
    setEditing(notice);
    setTitle(notice.title ?? "");
    setBody(notice.body ?? "");
    setCategory(notice.category ?? "school");
    const roles = notice.audienceRoles ?? [];
    setAudience(roles.includes("parent") ? "Parents" : roles.includes("teacher") ? "Teachers" : "Everyone");
    setFormOpen(true);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.show("Enter a notice title and message.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        body: body.trim(),
        category: category as "school" | "branch" | "class" | "holiday" | "exam" | "event" | "fee" | "emergency",
        audienceRoles: audience === "Parents" ? ["parent"] : audience === "Teachers" ? ["teacher"] : [],
        channels: ["app" as const]
      };
      if (editing) await updateNotice(editing.id, input);
      else await createNotice(input);
      toast.show(editing ? "Notice updated." : "Notice published.");
      setFormOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Could not save the notice.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const notice = deleting;
    setDeleting(null);
    setFormOpen(false);
    setEditing(null);
    try {
      await deleteNotice(notice.id);
      toast.show("Notice deleted.");
      refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Could not delete the notice.");
    }
  };

  if (loading && notices.length === 0) return <SkeletonPage />;
  if (error && notices.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <>
      <FlatList
        data={visible}
        keyExtractor={(notice) => notice.id}
        renderItem={({ item: notice, index }) => {
          const tile = tiles[index % tiles.length];
          return (
            <ListRow
              leading={
                <TonalTile bg={tile.bg}>
                  <Icon name="campaign" size={19} tint={tile.tint} />
                </TonalTile>
              }
              title={notice.title ?? "Untitled notice"}
              subtitle={`${categoryLabelFor(notice)} · ${formatDate(notice.createdAt)}`}
              chevron={canManage}
              onPress={canManage ? () => openEdit(notice) : undefined}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: t.line }]} />}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.blue} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <PageTitle>Notices</PageTitle>
            {canManage ? (
              <PillButton label="New notice" block bg={t.blue} fg="#FFFFFF" icon="add" onPress={openCreate} />
            ) : null}
            <DSText variant="overline">{`${notices.length} PUBLISHED`}</DSText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="campaign" label="No notices published yet." />
        }
        ListFooterComponent={
          notices.length > 10 ? (
            <PressableScale
              accessibilityLabel={showAll ? "Show fewer notices" : `View all ${notices.length} notices`}
              onPress={() => setShowAll((v) => !v)}
              style={styles.viewAll}
            >
              <DSText variant="bodyMedium" tint={t.blue}>{showAll ? "Show less" : "View all"}</DSText>
              <Icon name={showAll ? "expand-less" : "chevron-right"} size={18} tint={t.blue} />
            </PressableScale>
          ) : null
        }
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={true}
      />

      <BottomSheet
        visible={formOpen}
        title={editing ? "Edit notice" : "New notice"}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      >
        <View style={styles.form}>
          <TextField
            value={title}
            onChangeText={setTitle}
            placeholder="Notice title"
            autoCapitalize="sentences"
            accessibilityLabel="Notice title"
          />
          <TextField
            value={body}
            onChangeText={setBody}
            placeholder="Write the circular…"
            multiline
            autoCapitalize="sentences"
            accessibilityLabel="Notice message"
          />
          <DSText variant="label">Category</DSText>
          <FilterChips
            options={CATEGORIES.map((item) => item.label)}
            value={categoryLabel}
            onChange={(label) => setCategory(CATEGORIES.find((item) => item.label === label)?.value ?? "school")}
          />
          <DSText variant="label">Audience</DSText>
          <FilterChips options={AUDIENCES} value={audience} onChange={setAudience} />
          <PillButton
            label={saving ? "Publishing…" : editing ? "Save changes" : "Publish notice"}
            block
            bg={t.blue}
            fg="#FFFFFF"
            onPress={() => { if (!saving) void submit(); }}
          />
          {editing ? (
            <PillButton
              label="Delete notice"
              block
              bg={t.badBg}
              fg={t.bad}
              onPress={() => setDeleting(editing)}
            />
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={Boolean(deleting)}
        title="Delete notice?"
        onClose={() => setDeleting(null)}
      >
        <DSText variant="label">
          {deleting ? `“${deleting.title ?? "Untitled notice"}” will be removed for everyone.` : ""}
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

function categoryLabelFor(notice: Notice) {
  if (notice.category) {
    return CATEGORIES.find((item) => item.value === notice.category)?.label ?? notice.category;
  }
  return notice.audience ?? "School";
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: space.md, gap: 14 },
  header: { gap: 14 },
  divider: { height: StyleSheet.hairlineWidth },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm
  },
  form: { gap: space.sm, marginTop: space.sm },
  decisionRow: { flexDirection: "row", gap: space.md, marginTop: space.md }
});
