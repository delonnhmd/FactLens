import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useTheme";
import {
  deleteClaimAsAdmin,
  fetchModerationReports,
  hideClaim,
  lockClaimVoting,
  markClaimFeatured,
  resolveModerationReport,
  restoreModerationTarget,
  suspendUser,
  type ModerationReport,
} from "../../services/moderationService";

type ReportStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED" | "ALL";

const statusOptions: ReportStatus[] = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "ALL"];

function getTargetId(report: ModerationReport): string | null {
  if (report.target_type === "CLAIM") {
    return report.claim_id ?? null;
  }

  if (report.target_type === "EVIDENCE") {
    return report.evidence_id ?? null;
  }

  return report.profile_id ?? null;
}

function getTargetOwnerId(report: ModerationReport): string | null {
  const target = report.target ?? {};
  const ownerId = report.target_type === "CLAIM" ? target.author_id : target.user_id;

  return typeof ownerId === "string" ? ownerId : null;
}

function getTargetSummary(report: ModerationReport): string {
  const target = report.target ?? {};
  const title = target.title ?? target.note ?? target.username ?? target.display_name;

  return typeof title === "string" && title.trim() ? title.trim() : getTargetId(report) ?? "Unknown target";
}

function getTargetHidden(report: ModerationReport): boolean {
  return Boolean(report.target?.hidden);
}

export default function ModerationScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { loading, profile } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [claimId, setClaimId] = useState("");
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("Admin moderation action.");

  const loadReports = useCallback(async () => {
    setRefreshing(true);
    setMessage("");
    const result = await fetchModerationReports(status);
    setReports(result.reports);
    setMessage(result.error ?? "");
    setRefreshing(false);
  }, [status]);

  const runAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
      setMessage("");
      const result = await action();

      if (!result.ok) {
        setMessage(result.error ?? "Admin action failed.");
        return;
      }

      setMessage(successMessage);
      await loadReports();
    },
    [loadReports],
  );

  const confirmDeleteClaim = (targetClaimId: string) => {
    Alert.alert("Delete claim?", "This permanently removes the claim and related rows.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void runAction(() => deleteClaimAsAdmin(targetClaimId, reason), "Claim deleted.");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin</Text>
        </View>
        <Text style={styles.emptyText}>Checking access...</Text>
      </SafeAreaView>
    );
  }

  if (!profile?.is_admin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.replace("/profile")}>
            <Ionicons name="chevron-back" size={22} color={appTheme.colors.chipActiveText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Not found</Text>
          <View style={styles.headerButton} />
        </View>
        <Text style={styles.emptyText}>This screen is unavailable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={appTheme.colors.chipActiveText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadReports} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reports</Text>
          <View style={styles.statusRow}>
            {statusOptions.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.statusButton, status === item && styles.statusButtonActive]}
                activeOpacity={0.8}
                onPress={() => setStatus(item)}
              >
                <Text style={[styles.statusButtonText, status === item && styles.statusButtonTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={loadReports}>
            <Text style={styles.primaryButtonText}>{refreshing ? "Loading..." : "Load reports"}</Text>
          </TouchableOpacity>
          {message ? <Text style={styles.messageText}>{message}</Text> : null}
        </View>

        {reports.map((report) => {
          const targetId = getTargetId(report);
          const ownerId = getTargetOwnerId(report);

          return (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.targetType}>{report.target_type}</Text>
                <Text style={styles.reportStatus}>{report.status}</Text>
              </View>
              <Text style={styles.reason}>{report.reason}</Text>
              <Text style={styles.targetSummary} numberOfLines={3}>
                {getTargetSummary(report)}
              </Text>
              {report.note ? <Text style={styles.note}>{report.note}</Text> : null}
              <Text style={styles.date}>{new Date(report.created_at).toLocaleString()}</Text>
              {getTargetHidden(report) ? <Text style={styles.hiddenText}>Target hidden</Text> : null}

              <View style={styles.actionRow}>
                <AdminAction label="Resolve" styles={styles} onPress={() => runAction(() => resolveModerationReport(report.id), "Report resolved.")} />
                <AdminAction
                  label="Dismiss"
                  styles={styles}
                  onPress={() => runAction(() => resolveModerationReport(report.id, { status: "DISMISSED" }), "Report dismissed.")}
                />
                {targetId && (report.target_type === "CLAIM" || report.target_type === "EVIDENCE") ? (
                  <AdminAction
                    label={getTargetHidden(report) ? "Restore" : "Hide"}
                    danger={!getTargetHidden(report)}
                    styles={styles}
                    onPress={() =>
                      runAction(
                        () =>
                          getTargetHidden(report)
                            ? restoreModerationTarget(report.target_type === "CLAIM" ? "CLAIM" : "EVIDENCE", targetId)
                            : report.target_type === "CLAIM"
                              ? hideClaim(targetId, reason)
                              : resolveModerationReport(report.id, {
                                  hideTarget: true,
                                  adminNote: reason,
                                }),
                        getTargetHidden(report) ? "Target restored." : "Target hidden.",
                      )
                    }
                  />
                ) : null}
                {report.target_type === "CLAIM" && targetId ? (
                  <>
                    <AdminAction label="Lock voting" styles={styles} onPress={() => runAction(() => lockClaimVoting(targetId, reason), "Voting locked.")} />
                    <AdminAction label="Feature" styles={styles} onPress={() => runAction(() => markClaimFeatured(targetId, true), "Claim featured.")} />
                    <AdminAction label="Delete" danger styles={styles} onPress={() => confirmDeleteClaim(targetId)} />
                  </>
                ) : null}
                {(report.target_type === "PROFILE" && targetId) || ownerId ? (
                  <AdminAction
                    label="Suspend user"
                    danger
                    styles={styles}
                    onPress={() => runAction(() => suspendUser((report.target_type === "PROFILE" ? targetId : ownerId) ?? "", reason), "User suspended.")}
                  />
                ) : null}
              </View>
            </View>
          );
        })}

        {!refreshing && reports.length === 0 ? <Text style={styles.emptyText}>No reports loaded.</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Direct action</Text>
          <TextInput
            value={claimId}
            onChangeText={setClaimId}
            placeholder="Claim ID"
            placeholderTextColor={appTheme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput
            value={userId}
            onChangeText={setUserId}
            placeholder="User ID"
            placeholderTextColor={appTheme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason"
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.input, styles.reasonInput]}
            multiline
          />
          <View style={styles.actionRow}>
            <AdminAction label="Hide claim" styles={styles} onPress={() => runAction(() => hideClaim(claimId.trim(), reason), "Claim hidden.")} />
            <AdminAction label="Lock voting" styles={styles} onPress={() => runAction(() => lockClaimVoting(claimId.trim(), reason), "Voting locked.")} />
            <AdminAction label="Feature" styles={styles} onPress={() => runAction(() => markClaimFeatured(claimId.trim(), true), "Claim featured.")} />
            <AdminAction label="Delete claim" danger styles={styles} onPress={() => confirmDeleteClaim(claimId.trim())} />
            <AdminAction label="Suspend user" danger styles={styles} onPress={() => runAction(() => suspendUser(userId.trim(), reason), "User suspended.")} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminAction({
  label,
  onPress,
  styles,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, danger && styles.actionButtonDanger]} activeOpacity={0.8} onPress={onPress}>
      <Text style={[styles.actionButtonText, danger && styles.actionButtonDangerText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      flex: 1,
    },
    header: {
      alignItems: "center",
      backgroundColor: theme.colors.navy,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    headerButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    headerTitle: {
      color: theme.colors.chipActiveText,
      fontSize: theme.typography.title.fontSize,
      fontWeight: "500",
    },
    content: {
      gap: 10,
      padding: 10,
      paddingBottom: 20,
    },
    card: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.md,
      borderWidth: theme.borderWidth,
      gap: 10,
      padding: 12,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: theme.typography.body.fontSize,
      fontWeight: "500",
    },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    statusButton: {
      borderColor: theme.colors.lightBorder,
      borderRadius: 999,
      borderWidth: theme.borderWidth,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    statusButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    statusButtonText: {
      color: theme.colors.subtext,
      fontSize: 11,
      fontWeight: "500",
    },
    statusButtonTextActive: {
      color: theme.colors.chipActiveText,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm,
      minHeight: 42,
      justifyContent: "center",
      paddingVertical: 10,
    },
    primaryButtonText: {
      color: theme.colors.chipActiveText,
      fontSize: 14,
      fontWeight: "500",
    },
    messageText: {
      color: theme.colors.subtext,
      fontSize: 12,
      fontWeight: "500",
    },
    reportCard: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.md,
      borderWidth: theme.borderWidth,
      padding: 12,
    },
    reportHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    targetType: {
      color: theme.colors.ai,
      fontSize: 12,
      fontWeight: "500",
    },
    reportStatus: {
      color: theme.colors.subtext,
      fontSize: 11,
      fontWeight: "500",
    },
    reason: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "500",
      marginTop: 8,
    },
    targetSummary: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
    },
    note: {
      color: theme.colors.subtext,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
    },
    date: {
      color: theme.colors.muted,
      fontSize: 11,
      marginTop: 8,
    },
    hiddenText: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "500",
      marginTop: 8,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    actionButton: {
      backgroundColor: theme.colors.sourceBg,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    actionButtonDanger: {
      backgroundColor: theme.colors.dangerBg,
    },
    actionButtonText: {
      color: theme.colors.sourceText,
      fontSize: 12,
      fontWeight: "500",
    },
    actionButtonDangerText: {
      color: theme.colors.danger,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      color: theme.colors.text,
      fontSize: theme.typography.body.fontSize,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    reasonInput: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    emptyText: {
      color: theme.colors.subtext,
      fontSize: 14,
      padding: 12,
      textAlign: "center",
    },
  });
}
