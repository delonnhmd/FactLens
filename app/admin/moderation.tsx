import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  fetchAdminMetrics,
  fetchManagedClaims,
  fetchManagedUsers,
  fetchModerationReports,
  hideClaim,
  hideClaimFromFeeds,
  lockClaimVoting,
  markClaimFeatured,
  resolveModerationReport,
  restoreModerationTarget,
  suspendUser,
  unhideClaim,
  unsuspendUser,
  type AdminMetrics,
  type ManagedClaim,
  type ManagedUser,
  type ModerationReport,
} from "../../services/moderationService";
import {
  fetchAdminAppeals,
  resolveAdminAppeal,
  type AppealDecision,
  type ModerationAppeal,
} from "../../services/appealService";

// TEMPORARY: the admin "Delete" / "Delete claim" action is non-functional
// (tapping it flickers and does nothing), so it is hidden until the underlying
// delete is fixed. The handler (confirmDeleteClaim / deleteClaimAsAdmin) is left
// fully intact — flip this back to true to re-enable the button everywhere.
const ADMIN_DELETE_ENABLED = false;

type ReportStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED" | "ALL";
type UserFilter = "all" | "suspended" | "blocked";
type ClaimFilter = "all" | "hidden" | "visible";

const statusOptions: ReportStatus[] = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "ALL"];
const userFilterOptions: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked-by-users" },
];
const claimFilterOptions: { value: ClaimFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hidden", label: "Hidden" },
  { value: "visible", label: "Visible" },
];

function formatMetricNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(Number(value ?? 0));
}

function formatMetricRatio(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(1);
}

function formatAppealAction(actionType: ModerationAppeal["action_type"]): string {
  if (actionType === "claim_hidden") {
    return "Claim hidden";
  }

  if (actionType === "claim_removed") {
    return "Claim removed";
  }

  return "Account suspended";
}

function getAppealUserLabel(appeal: ModerationAppeal): string {
  if (appeal.username) {
    return `@${appeal.username}`;
  }

  return appeal.display_name || appeal.user_id;
}

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
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsMessage, setMetricsMessage] = useState("");
  // ADMIN MANAGEMENT DASHBOARD (NEW, additive)
  const [usersSearch, setUsersSearch] = useState("");
  const [usersFilter, setUsersFilter] = useState<UserFilter>("all");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersMessage, setUsersMessage] = useState("");
  const [claimsSearch, setClaimsSearch] = useState("");
  const [claimsFilter, setClaimsFilter] = useState<ClaimFilter>("all");
  const [managedClaims, setManagedClaims] = useState<ManagedClaim[]>([]);
  const [claimsMessage, setClaimsMessage] = useState("");
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [appealsMessage, setAppealsMessage] = useState("");
  const [appealReviewNotes, setAppealReviewNotes] = useState<Record<string, string>>({});
  const [showResolvedAppeals, setShowResolvedAppeals] = useState(false);

  const loadReports = useCallback(async () => {
    setRefreshing(true);
    setMessage("");
    const result = await fetchModerationReports(status);
    setReports(result.reports);
    setMessage(result.error ?? "");
    setRefreshing(false);
  }, [status]);

  const loadMetrics = useCallback(async () => {
    setMetricsMessage("Loading...");
    const result = await fetchAdminMetrics();
    setMetrics(result.metrics);
    setMetricsMessage(result.error ?? "");
  }, []);

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

  // ADMIN MANAGEMENT DASHBOARD (NEW, additive) — debounced (400ms) loaders
  // for the Users and Claims sections; the Reports section above is
  // untouched.
  const isAdmin = Boolean(profile?.is_admin);

  const loadManagedUsers = useCallback(async () => {
    setUsersMessage("Loading...");
    const result = await fetchManagedUsers(usersSearch.trim(), usersFilter);
    setManagedUsers(result.users);
    setUsersMessage(result.error ?? (result.users.length === 0 ? "No users found." : ""));
  }, [usersFilter, usersSearch]);

  const loadManagedClaims = useCallback(async () => {
    setClaimsMessage("Loading...");
    const result = await fetchManagedClaims(claimsSearch.trim(), claimsFilter);
    setManagedClaims(result.claims);
    setClaimsMessage(result.error ?? (result.claims.length === 0 ? "No claims found." : ""));
  }, [claimsFilter, claimsSearch]);

  const loadAppeals = useCallback(async () => {
    setAppealsMessage("Loading...");
    const result = await fetchAdminAppeals("all", 100);
    setAppeals(result.appeals);
    setAppealsMessage(result.error ?? (result.appeals.length === 0 ? "No appeals found." : ""));
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void loadMetrics();
  }, [isAdmin, loadMetrics]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const timer = setTimeout(() => {
      void loadManagedUsers();
    }, 400);

    return () => clearTimeout(timer);
  }, [isAdmin, loadManagedUsers]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const timer = setTimeout(() => {
      void loadManagedClaims();
    }, 400);

    return () => clearTimeout(timer);
  }, [isAdmin, loadManagedClaims]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void loadAppeals();
  }, [isAdmin, loadAppeals]);

  const handleAdminRefresh = useCallback(async () => {
    await Promise.all([loadReports(), loadMetrics()]);
  }, [loadMetrics, loadReports]);

  const runUserAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
      setUsersMessage("");
      const result = await action();

      if (!result.ok) {
        setUsersMessage(result.error ?? "Admin action failed.");
        return;
      }

      setUsersMessage(successMessage);
      await loadManagedUsers();
    },
    [loadManagedUsers],
  );

  const runClaimAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
      setClaimsMessage("");
      const result = await action();

      if (!result.ok) {
        setClaimsMessage(result.error ?? "Admin action failed.");
        return;
      }

      setClaimsMessage(successMessage);
      await loadManagedClaims();
    },
    [loadManagedClaims],
  );

  const runAppealAction = useCallback(
    async (appealId: string, decision: AppealDecision) => {
      setAppealsMessage("");
      const result = await resolveAdminAppeal(appealId, decision, appealReviewNotes[appealId] ?? "");

      if (!result.ok) {
        setAppealsMessage(result.error ?? "Could not resolve appeal.");
        return;
      }

      setAppealsMessage(decision === "granted" ? "Appeal granted." : "Appeal denied.");
      setAppealReviewNotes((currentNotes) => {
        const nextNotes = { ...currentNotes };
        delete nextNotes[appealId];
        return nextNotes;
      });
      await loadAppeals();
      await Promise.all([loadManagedClaims(), loadManagedUsers()]);
    },
    [appealReviewNotes, loadAppeals, loadManagedClaims, loadManagedUsers],
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

  const pendingAppeals = appeals.filter((appeal) => appeal.status === "pending");
  const resolvedAppeals = appeals.filter((appeal) => appeal.status !== "pending");

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleAdminRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Metrics</Text>
          {metrics ? (
            <View style={[styles.healthBanner, metrics.health.wav_ratio < 30 && styles.healthBannerWarning]}>
              <Text style={[styles.healthText, metrics.health.wav_ratio < 30 && styles.healthTextWarning]}>
                Weekly active voters: {formatMetricNumber(metrics.health.weekly_active_voters)} (
                {formatMetricRatio(metrics.health.wav_ratio)}% of {formatMetricNumber(metrics.health.total_users)} users)
              </Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={loadMetrics}>
            <Text style={styles.primaryButtonText}>Refresh metrics</Text>
          </TouchableOpacity>
          {metricsMessage ? <Text style={styles.messageText}>{metricsMessage}</Text> : null}
        </View>

        {metrics ? (
          <>
            <MetricSection
              title="Today"
              items={[
                { label: "New users", value: metrics.today.new_users },
                { label: "Claims posted", value: metrics.today.claims_posted },
                { label: "Votes cast", value: metrics.today.votes_cast },
                { label: "Reports opened", value: metrics.today.reports_opened },
              ]}
              styles={styles}
            />
            <MetricSection
              title="This Week"
              items={[
                { label: "New users", value: metrics.week.new_users },
                { label: "Claims posted", value: metrics.week.claims_posted },
                { label: "Votes cast", value: metrics.week.votes_cast },
                { label: "Reports opened", value: metrics.week.reports_opened },
                { label: "Active voters", value: metrics.week.active_voters },
              ]}
              styles={styles}
            />
            <MetricSection
              title="This Month"
              items={[
                { label: "New users", value: metrics.month.new_users },
                { label: "Claims posted", value: metrics.month.claims_posted },
                { label: "Votes cast", value: metrics.month.votes_cast },
                { label: "Active voters", value: metrics.month.active_voters },
              ]}
              styles={styles}
            />
            <MetricSection
              title="Totals"
              items={[
                { label: "Users", value: metrics.totals.users },
                { label: "Claims", value: metrics.totals.claims },
                { label: "Votes", value: metrics.totals.votes },
                { label: "Hidden claims", value: metrics.totals.hidden_claims },
                { label: "Pending reports", value: metrics.totals.pending_reports },
                { label: "Pending appeals", value: metrics.totals.pending_appeals },
                { label: "Blocks", value: metrics.totals.blocks },
              ]}
              styles={styles}
            />
          </>
        ) : null}

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
                    {/* Delete temporarily hidden — non-functional; see ADMIN_DELETE_ENABLED. */}
                    {ADMIN_DELETE_ENABLED ? (
                      <AdminAction label="Delete" danger styles={styles} onPress={() => confirmDeleteClaim(targetId)} />
                    ) : null}
                    {/* HIDE/UNHIDE CLAIM (NEW, additive) — reversible alternative to delete */}
                    <AdminAction label="Hide claim" danger styles={styles} onPress={() => runAction(() => hideClaimFromFeeds(targetId, reason), "Claim hidden from feeds.")} />
                    <AdminAction label="Unhide claim" styles={styles} onPress={() => runAction(() => unhideClaim(targetId), "Claim restored to feeds.")} />
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
          <Text style={styles.cardTitle}>Appeals</Text>
          <View style={styles.actionRow}>
            <AdminAction label="Load appeals" styles={styles} onPress={loadAppeals} />
            <AdminAction
              label={showResolvedAppeals ? "Hide resolved" : "Show resolved"}
              styles={styles}
              onPress={() => setShowResolvedAppeals((current) => !current)}
            />
          </View>
          {appealsMessage ? <Text style={styles.messageText}>{appealsMessage}</Text> : null}
          <Text style={styles.note}>
            Pending {pendingAppeals.length} / Resolved {resolvedAppeals.length}
          </Text>
        </View>

        {pendingAppeals.map((appeal) => (
          <View key={appeal.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.targetType}>{formatAppealAction(appeal.action_type)}</Text>
              <Text style={styles.reportStatus}>PENDING</Text>
            </View>
            <Text style={styles.targetSummary} numberOfLines={1}>
              {getAppealUserLabel(appeal)}
            </Text>
            {appeal.claim_title || appeal.claim_id ? (
              <Text style={styles.note} numberOfLines={2}>
                Claim: {appeal.claim_title || appeal.claim_id}
              </Text>
            ) : null}
            <Text style={styles.reason}>{appeal.appeal_text}</Text>
            <Text style={styles.date}>{new Date(appeal.created_at).toLocaleString()}</Text>
            <TextInput
              value={appealReviewNotes[appeal.id] ?? ""}
              onChangeText={(value) =>
                setAppealReviewNotes((currentNotes) => ({
                  ...currentNotes,
                  [appeal.id]: value,
                }))
              }
              placeholder="Review note"
              placeholderTextColor={appTheme.colors.muted}
              style={[styles.input, styles.reasonInput, styles.appealReviewInput]}
              multiline
            />
            <View style={styles.actionRow}>
              <AdminAction label="Grant" styles={styles} onPress={() => runAppealAction(appeal.id, "granted")} />
              <AdminAction label="Deny" danger styles={styles} onPress={() => runAppealAction(appeal.id, "denied")} />
            </View>
          </View>
        ))}

        {showResolvedAppeals
          ? resolvedAppeals.map((appeal) => (
              <View key={appeal.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.targetType}>{formatAppealAction(appeal.action_type)}</Text>
                  <Text
                    style={[
                      styles.reportStatus,
                      appeal.status === "granted" ? styles.appealGrantedText : styles.appealDeniedText,
                    ]}
                  >
                    {appeal.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.targetSummary} numberOfLines={1}>
                  {getAppealUserLabel(appeal)}
                </Text>
                {appeal.claim_title || appeal.claim_id ? (
                  <Text style={styles.note} numberOfLines={2}>
                    Claim: {appeal.claim_title || appeal.claim_id}
                  </Text>
                ) : null}
                <Text style={styles.note}>{appeal.appeal_text}</Text>
                {appeal.review_note ? <Text style={styles.reason}>Review: {appeal.review_note}</Text> : null}
                <Text style={styles.date}>
                  {appeal.reviewed_at ? new Date(appeal.reviewed_at).toLocaleString() : new Date(appeal.created_at).toLocaleString()}
                </Text>
              </View>
            ))
          : null}

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
            {/* HIDE/UNHIDE CLAIM (NEW, additive) — removes from feeds via RLS, unlike legacy "Hide claim" above */}
            <AdminAction label="Hide from feeds" danger styles={styles} onPress={() => runAction(() => hideClaimFromFeeds(claimId.trim(), reason), "Claim hidden from feeds.")} />
            <AdminAction label="Unhide claim" styles={styles} onPress={() => runAction(() => unhideClaim(claimId.trim()), "Claim restored to feeds.")} />
            <AdminAction label="Lock voting" styles={styles} onPress={() => runAction(() => lockClaimVoting(claimId.trim(), reason), "Voting locked.")} />
            <AdminAction label="Feature" styles={styles} onPress={() => runAction(() => markClaimFeatured(claimId.trim(), true), "Claim featured.")} />
            {/* Delete temporarily hidden — non-functional; see ADMIN_DELETE_ENABLED. */}
            {ADMIN_DELETE_ENABLED ? (
              <AdminAction label="Delete claim" danger styles={styles} onPress={() => confirmDeleteClaim(claimId.trim())} />
            ) : null}
            <AdminAction label="Suspend user" danger styles={styles} onPress={() => runAction(() => suspendUser(userId.trim(), reason), "User suspended.")} />
          </View>
        </View>

        {/* ADMIN MANAGEMENT DASHBOARD (NEW, additive) — Users */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Users</Text>
          <TextInput
            value={usersSearch}
            onChangeText={setUsersSearch}
            placeholder="Search username or email"
            placeholderTextColor={appTheme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.statusRow}>
            {userFilterOptions.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.statusButton, usersFilter === item.value && styles.statusButtonActive]}
                activeOpacity={0.8}
                onPress={() => setUsersFilter(item.value)}
              >
                <Text style={[styles.statusButtonText, usersFilter === item.value && styles.statusButtonTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {usersMessage ? <Text style={styles.messageText}>{usersMessage}</Text> : null}
        </View>

        {managedUsers.map((user) => (
          <View key={user.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.targetType}>@{user.username || "unknown"}</Text>
              <Text style={styles.reportStatus}>{new Date(user.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.targetSummary} numberOfLines={1}>
              {user.email || "No email on record"}
            </Text>
            <Text style={styles.note}>
              {user.claim_count} {user.claim_count === 1 ? "claim" : "claims"} {"·"} blocked by {user.blocked_by_count}{" "}
              {user.blocked_by_count === 1 ? "user" : "users"}
            </Text>
            {user.is_admin ? <Text style={styles.note}>ADMIN</Text> : null}
            {user.is_suspended ? <Text style={styles.hiddenText}>SUSPENDED</Text> : null}
            <View style={styles.actionRow}>
              {user.is_suspended ? (
                <AdminAction
                  label="Unsuspend"
                  styles={styles}
                  onPress={() => runUserAction(() => unsuspendUser(user.id), "User unsuspended.")}
                />
              ) : (
                <AdminAction
                  label="Suspend"
                  danger
                  styles={styles}
                  onPress={() => runUserAction(() => suspendUser(user.id, reason), "User suspended.")}
                />
              )}
            </View>
          </View>
        ))}

        {/* ADMIN MANAGEMENT DASHBOARD (NEW, additive) — Claims */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Claims</Text>
          <TextInput
            value={claimsSearch}
            onChangeText={setClaimsSearch}
            placeholder="Search claim title"
            placeholderTextColor={appTheme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.statusRow}>
            {claimFilterOptions.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.statusButton, claimsFilter === item.value && styles.statusButtonActive]}
                activeOpacity={0.8}
                onPress={() => setClaimsFilter(item.value)}
              >
                <Text style={[styles.statusButtonText, claimsFilter === item.value && styles.statusButtonTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {claimsMessage ? <Text style={styles.messageText}>{claimsMessage}</Text> : null}
        </View>

        {managedClaims.map((claim) => (
          <View key={claim.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.targetType}>{claim.author_username ? `@${claim.author_username}` : "Unknown author"}</Text>
              <Text style={styles.reportStatus}>{new Date(claim.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.targetSummary} numberOfLines={2}>
              {claim.title || claim.id}
            </Text>
            <Text style={styles.note}>
              True {claim.votes_true ?? 0} {"·"} Fake {claim.votes_fake ?? 0} {"·"} Not sure {claim.votes_unsure ?? 0}
            </Text>
            {claim.is_hidden ? (
              <Text style={styles.hiddenText}>Hidden{claim.hidden_reason ? ` — ${claim.hidden_reason}` : ""}</Text>
            ) : claim.hidden ? (
              <Text style={styles.hiddenText}>Removed (legacy hide){claim.hidden_reason ? ` — ${claim.hidden_reason}` : ""}</Text>
            ) : null}
            <View style={styles.actionRow}>
              {claim.is_hidden ? (
                <AdminAction
                  label="Unhide"
                  styles={styles}
                  onPress={() => runClaimAction(() => unhideClaim(claim.id), "Claim restored to feeds.")}
                />
              ) : (
                <AdminAction
                  label="Hide"
                  danger
                  styles={styles}
                  onPress={() => runClaimAction(() => hideClaimFromFeeds(claim.id, reason), "Claim hidden from feeds.")}
                />
              )}
              {/* Delete temporarily hidden — non-functional; see ADMIN_DELETE_ENABLED. */}
              {ADMIN_DELETE_ENABLED ? (
                <AdminAction label="Delete" danger styles={styles} onPress={() => confirmDeleteClaim(claim.id)} />
              ) : null}
            </View>
          </View>
        ))}
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

function MetricSection({
  title,
  items,
  styles,
}: {
  title: string;
  items: Array<{ label: string; value?: number | null }>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricSection}>
      <Text style={styles.metricSectionTitle}>{title}</Text>
      <View style={styles.metricGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.metricItem}>
            <Text style={styles.metricValue}>{formatMetricNumber(item.value)}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
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
    healthBanner: {
      backgroundColor: theme.colors.successBg,
      borderColor: theme.colors.success,
      borderRadius: theme.radius.sm,
      borderWidth: theme.borderWidth,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    healthBannerWarning: {
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warningBorder,
    },
    healthText: {
      color: theme.colors.success,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
    healthTextWarning: {
      color: theme.colors.warningText,
    },
    metricSection: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.md,
      borderWidth: theme.borderWidth,
      padding: 12,
    },
    metricSectionTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 10,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metricItem: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.sm,
      borderWidth: theme.borderWidth,
      minWidth: 102,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: "700",
      lineHeight: 26,
    },
    metricLabel: {
      color: theme.colors.subtext,
      fontSize: 11,
      fontWeight: "500",
      marginTop: 3,
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
    appealReviewInput: {
      marginTop: 10,
    },
    appealGrantedText: {
      color: theme.colors.success,
    },
    appealDeniedText: {
      color: theme.colors.danger,
    },
    emptyText: {
      color: theme.colors.subtext,
      fontSize: 14,
      padding: 12,
      textAlign: "center",
    },
  });
}
