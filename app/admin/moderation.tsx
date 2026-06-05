// PHASE 5 STEP 3
import { useCallback, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";
import {
  fetchModerationReports,
  resolveModerationReport,
  restoreModerationTarget,
  type ModerationReport,
} from "../../services/moderationService";

function getTargetId(report: ModerationReport): string | null {
  if (report.target_type === "CLAIM") {
    return report.claim_id ?? null;
  }

  if (report.target_type === "EVIDENCE") {
    return report.evidence_id ?? null;
  }

  return report.profile_id ?? null;
}

function getTargetSummary(report: ModerationReport): string {
  const target = report.target ?? {};
  const title = target.title ?? target.note ?? target.username ?? target.display_name;

  return typeof title === "string" && title.trim() ? title.trim() : getTargetId(report) ?? "Unknown target";
}

function isHidden(report: ModerationReport): boolean {
  return Boolean(report.target && report.target.hidden);
}

export default function ModerationScreen() {
  const [adminKey, setAdminKey] = useState("");
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const result = await fetchModerationReports(adminKey, status);
    setReports(result.reports);
    setMessage(result.error ?? "");
    setLoading(false);
  }, [adminKey, status]);

  const handleResolve = async (report: ModerationReport, hideTarget = false) => {
    setMessage("");
    const result = await resolveModerationReport(adminKey, report.id, {
      status: "RESOLVED",
      hideTarget,
      adminNote: hideTarget ? "Removed for violating community guidelines." : "Reviewed.",
    });

    if (!result.ok) {
      setMessage(result.error ?? "Could not update report.");
      return;
    }

    await loadReports();
  };

  const handleRestore = async (report: ModerationReport) => {
    const targetId = getTargetId(report);

    if (!targetId || (report.target_type !== "CLAIM" && report.target_type !== "EVIDENCE")) {
      setMessage("This target cannot be restored from the app.");
      return;
    }

    const result = await restoreModerationTarget(adminKey, report.target_type, targetId);

    if (!result.ok) {
      setMessage(result.error ?? "Could not restore content.");
      return;
    }

    await loadReports();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Moderation" subtitle="Recent reports and emergency controls" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadReports} />}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Admin API key</Text>
          <TextInput
            value={adminKey}
            onChangeText={setAdminKey}
            placeholder="Enter admin key"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            style={styles.input}
          />
          <View style={styles.statusRow}>
            {["OPEN", "REVIEWING", "RESOLVED", "ALL"].map((item) => (
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
          <TouchableOpacity style={styles.loadButton} activeOpacity={0.8} onPress={loadReports}>
            <Text style={styles.loadButtonText}>{loading ? "Loading..." : "Load reports"}</Text>
          </TouchableOpacity>
          {message ? <Text style={styles.messageText}>{message}</Text> : null}
        </View>

        {reports.map((report) => (
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
            {isHidden(report) ? <Text style={styles.hiddenText}>Target hidden</Text> : null}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.resolveButton} activeOpacity={0.8} onPress={() => handleResolve(report)}>
                <Text style={styles.resolveButtonText}>Resolve</Text>
              </TouchableOpacity>
              {report.target_type === "CLAIM" || report.target_type === "EVIDENCE" ? (
                <>
                  <TouchableOpacity
                    style={styles.hideButton}
                    activeOpacity={0.8}
                    onPress={() => handleResolve(report, true)}
                  >
                    <Text style={styles.hideButtonText}>Hide + Resolve</Text>
                  </TouchableOpacity>
                  {isHidden(report) ? (
                    <TouchableOpacity style={styles.restoreButton} activeOpacity={0.8} onPress={() => handleRestore(report)}>
                      <Text style={styles.restoreButtonText}>Restore</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        ))}

        {!loading && reports.length === 0 ? <Text style={styles.emptyText}>No reports loaded.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.card, flex: 1 },
  content: { gap: 10, padding: 10 },
  card: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    padding: 12,
  },
  label: { color: theme.colors.subtext, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  statusButton: {
    borderColor: theme.colors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusButtonActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy },
  statusButtonText: { color: theme.colors.subtext, fontSize: 11, fontWeight: "700" },
  statusButtonTextActive: { color: theme.colors.background },
  loadButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    marginTop: 10,
    paddingVertical: 10,
  },
  loadButtonText: { color: theme.colors.background, fontSize: 14, fontWeight: "700" },
  messageText: { color: theme.colors.danger, fontSize: 12, fontWeight: "600", marginTop: 8 },
  reportCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    padding: 12,
  },
  reportHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  targetType: { color: theme.colors.ai, fontSize: 12, fontWeight: "800" },
  reportStatus: { color: theme.colors.subtext, fontSize: 11, fontWeight: "700" },
  reason: { color: theme.colors.text, fontSize: 16, fontWeight: "800", marginTop: 8 },
  targetSummary: { color: theme.colors.text, fontSize: 13, lineHeight: 18, marginTop: 6 },
  note: { color: theme.colors.subtext, fontSize: 12, lineHeight: 17, marginTop: 6 },
  date: { color: theme.colors.muted, fontSize: 11, marginTop: 8 },
  hiddenText: { color: theme.colors.danger, fontSize: 12, fontWeight: "700", marginTop: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  resolveButton: {
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resolveButtonText: { color: theme.colors.success, fontSize: 12, fontWeight: "800" },
  hideButton: {
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hideButtonText: { color: theme.colors.danger, fontSize: 12, fontWeight: "800" },
  restoreButton: {
    backgroundColor: theme.colors.sourceBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  restoreButtonText: { color: theme.colors.sourceText, fontSize: 12, fontWeight: "800" },
  emptyText: { color: theme.colors.subtext, fontSize: 14, padding: 12, textAlign: "center" },
});
