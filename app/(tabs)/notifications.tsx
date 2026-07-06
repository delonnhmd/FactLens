import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../../context/AuthContext";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../../services/notificationService";
import {
  fetchMyAppeals,
  submitAppeal,
  type AppealActionType,
  type ModerationAppeal,
} from "../../services/appealService";

const APPEALABLE_NOTIFICATION_TYPES: AppealActionType[] = [
  "claim_hidden",
  "claim_removed",
  "account_suspended",
];
const APPEAL_TEXT_MIN_LENGTH = 20;
const APPEAL_TEXT_MAX_LENGTH = 500;

function isAppealableNotification(notification: AppNotification): notification is AppNotification & {
  type: AppealActionType;
} {
  return APPEALABLE_NOTIFICATION_TYPES.includes(notification.type as AppealActionType);
}

function getAppealKey(actionType: AppealActionType, claimId?: string | null, notificationId?: string | null): string {
  const decisionId = claimId?.trim() || notificationId?.trim() || "none";

  return `${actionType}:${decisionId}`;
}

function getNotificationAppealKey(notification: AppNotification): string | null {
  if (!isAppealableNotification(notification)) {
    return null;
  }

  return getAppealKey(notification.type, notification.claimId, notification.id);
}

function getStoredAppealKey(appeal: ModerationAppeal): string {
  return getAppealKey(appeal.action_type, appeal.claim_id, appeal.notification_id);
}

function getNotificationIcon(notification: AppNotification): {
  name: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
} {
  if (notification.type === "badge_earned") {
    return { name: "ribbon-outline", backgroundColor: "#16825F" };
  }

  if (notification.type === "claim_finalized" || notification.type === "claim_verified") {
    return { name: "checkmark-circle-outline", backgroundColor: "#D97706" };
  }

  if (isAppealableNotification(notification) || notification.type === "appeal_resolved") {
    return { name: "shield-checkmark-outline", backgroundColor: "#7C3AED" };
  }

  return { name: "at-outline", backgroundColor: "#0D1B3E" };
}

function formatNotificationTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return "Just now";
  }

  if (diffMs < dayMs) {
    return `${Math.max(1, Math.floor(diffMs / hourMs))}h ago`;
  }

  if (diffMs < 7 * dayMs) {
    return `${Math.max(1, Math.floor(diffMs / dayMs))}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function NotificationsScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [appealMessage, setAppealMessage] = useState("");
  const [appealError, setAppealError] = useState("");
  const [appealText, setAppealText] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealStatusAvailable, setAppealStatusAvailable] = useState(true);
  const [selectedAppealNotification, setSelectedAppealNotification] = useState<AppNotification | null>(null);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const appealByKey = useMemo(() => {
    const next = new Map<string, ModerationAppeal>();

    for (const appeal of appeals) {
      next.set(getStoredAppealKey(appeal), appeal);
    }

    return next;
  }, [appeals]);

  const loadNotifications = useCallback(
    async (showSpinner = false) => {
      if (!currentUser?.id) {
        setNotifications([]);
        setAppeals([]);
        setAppealStatusAvailable(true);
        setError("");
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }

      const [notificationResult, appealResult] = await Promise.all([
        fetchNotifications(currentUser.id, 50),
        fetchMyAppeals(),
      ]);
      setNotifications(notificationResult.notifications);
      setAppeals(appealResult.appeals);
      setAppealStatusAvailable(!appealResult.error);
      setError(notificationResult.error ?? "");

      if (showSpinner) {
        setLoading(false);
      }
    },
    [currentUser?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void loadNotifications(true);
    }, [loadNotifications]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!currentUser?.id || unreadCount === 0) {
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    );

    const saved = await markAllNotificationsRead(currentUser.id);

    if (!saved) {
      await loadNotifications(false);
    }
  }, [currentUser?.id, loadNotifications, unreadCount]);

  const handleNotificationPress = useCallback(
    async (notification: AppNotification) => {
      if (!currentUser?.id) {
        return;
      }

      if (!notification.read) {
        setNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            currentNotification.id === notification.id ? { ...currentNotification, read: true } : currentNotification,
          ),
        );

        const saved = await markNotificationRead(notification.id, currentUser.id);

        if (!saved) {
          await loadNotifications(false);
        }
      }

      if (notification.claimId) {
        router.push(`/claim/${notification.claimId}`);
      }
    },
    [currentUser?.id, loadNotifications, router],
  );

  const closeAppealModal = useCallback(() => {
    if (appealSubmitting) {
      return;
    }

    setSelectedAppealNotification(null);
    setAppealText("");
    setAppealError("");
  }, [appealSubmitting]);

  const openAppealModal = useCallback((notification: AppNotification) => {
    if (!isAppealableNotification(notification)) {
      return;
    }

    setSelectedAppealNotification(notification);
    setAppealText("");
    setAppealError("");
    setAppealMessage("");
  }, []);

  const handleSubmitAppeal = useCallback(async () => {
    if (!selectedAppealNotification || !isAppealableNotification(selectedAppealNotification)) {
      return;
    }

    const trimmedText = appealText.trim();

    if (trimmedText.length < APPEAL_TEXT_MIN_LENGTH || trimmedText.length > APPEAL_TEXT_MAX_LENGTH) {
      setAppealError(`Appeal text must be ${APPEAL_TEXT_MIN_LENGTH}-${APPEAL_TEXT_MAX_LENGTH} characters.`);
      return;
    }

    setAppealSubmitting(true);
    setAppealError("");

    const result = await submitAppeal({
      action_type: selectedAppealNotification.type,
      claim_id: selectedAppealNotification.claimId,
      notification_id: selectedAppealNotification.id,
      appeal_text: trimmedText,
    });

    setAppealSubmitting(false);

    if (!result.ok || !result.appeal) {
      setAppealError(result.error ?? "Could not submit this appeal.");
      return;
    }

    setAppeals((currentAppeals) => [
      result.appeal as ModerationAppeal,
      ...currentAppeals.filter((appeal) => appeal.id !== result.appeal?.id),
    ]);
    setSelectedAppealNotification(null);
    setAppealText("");
    setAppealMessage("Appeal submitted - reviewed within 24 hours.");
  }, [appealText, selectedAppealNotification]);

  const renderNotification = useCallback(
    ({ item }: { item: AppNotification }) => {
      const icon = getNotificationIcon(item);
      const notificationAppealKey = getNotificationAppealKey(item);
      const existingAppeal = notificationAppealKey ? appealByKey.get(notificationAppealKey) : null;
      const showAppealControl =
        appealStatusAvailable && Boolean(notificationAppealKey) && (!existingAppeal || existingAppeal.status === "pending");
      const appealPending = existingAppeal?.status === "pending";

      return (
        <View style={styles.notificationCard}>
          <TouchableOpacity
            style={styles.notificationRow}
            activeOpacity={0.78}
            onPress={() => {
              void handleNotificationPress(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={item.claimId ? "Marks as read and opens the related claim" : "Marks as read"}
          >
            <View style={[styles.iconCircle, { backgroundColor: icon.backgroundColor }]}>
              <Ionicons name={icon.name} size={18} color="#FFFFFF" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.notificationBody} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
            </View>
            {item.read ? <View style={styles.unreadPlaceholder} /> : <View style={styles.unreadDot} />}
          </TouchableOpacity>
          {showAppealControl ? (
            <TouchableOpacity
              style={[styles.appealButton, appealPending && styles.appealButtonDisabled]}
              activeOpacity={0.8}
              disabled={appealPending}
              onPress={() => openAppealModal(item)}
              accessibilityRole="button"
              accessibilityLabel={appealPending ? "Appeal pending" : "Appeal this decision"}
            >
              <Ionicons
                name={appealPending ? "time-outline" : "create-outline"}
                size={15}
                color={appealPending ? appTheme.colors.muted : appTheme.colors.sourceText}
              />
              <Text style={[styles.appealButtonText, appealPending && styles.appealButtonTextDisabled]}>
                {appealPending ? "Appeal pending" : "Appeal this decision"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    },
    [
      appTheme.colors.muted,
      appTheme.colors.sourceText,
      appealByKey,
      appealStatusAvailable,
      handleNotificationPress,
      openAppealModal,
      styles,
    ],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={0.75}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityHint="Returns to the previous screen"
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.markAllButton}
          activeOpacity={0.75}
          onPress={() => {
            void handleMarkAllRead();
          }}
          disabled={unreadCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
          accessibilityHint="Marks every unread notification as read"
        >
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {appealMessage ? <Text style={styles.successText}>{appealMessage}</Text> : null}
      <FlatList
        data={notifications}
        keyExtractor={(notification) => notification.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              message="You'll be notified when someone tags you or you earn a badge."
            />
          ) : null
        }
      />
      <Modal visible={Boolean(selectedAppealNotification)} transparent animationType="fade" onRequestClose={closeAppealModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Appeal this decision</Text>
            <TextInput
              value={appealText}
              onChangeText={setAppealText}
              placeholder="Explain why this decision should be reviewed"
              placeholderTextColor={appTheme.colors.muted}
              style={styles.appealInput}
              multiline
              maxLength={APPEAL_TEXT_MAX_LENGTH}
              editable={!appealSubmitting}
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.counterText,
                appealText.trim().length > 0 && appealText.trim().length < APPEAL_TEXT_MIN_LENGTH && styles.counterTextWarning,
              ]}
            >
              {appealText.trim().length}/{APPEAL_TEXT_MAX_LENGTH}
            </Text>
            {appealError ? <Text style={styles.errorTextInline}>{appealError}</Text> : null}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.8}
                disabled={appealSubmitting}
                onPress={closeAppealModal}
                accessibilityRole="button"
                accessibilityLabel="Cancel appeal"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, appealSubmitting && styles.submitButtonDisabled]}
                activeOpacity={0.8}
                disabled={appealSubmitting}
                onPress={() => {
                  void handleSubmitAppeal();
                }}
                accessibilityRole="button"
                accessibilityLabel="Submit appeal"
              >
                <Text style={styles.submitButtonText}>{appealSubmitting ? "Submitting..." : "Submit"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
      backgroundColor: "#0D1B3E",
      flexDirection: "row",
      minHeight: 60,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    headerButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    headerTitle: {
      color: "#FFFFFF",
      flex: 1,
      fontSize: 18,
      fontWeight: "500",
      textAlign: "center",
    },
    markAllButton: {
      alignItems: "flex-end",
      justifyContent: "center",
      minHeight: 44,
      minWidth: 86,
    },
    markAllText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "500",
      textAlign: "right",
    },
    markAllTextDisabled: {
      opacity: 0.5,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    successText: {
      color: theme.colors.success,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    listContent: {
      flexGrow: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    notificationCard: {
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.lightBorder,
      borderBottomWidth: 0.5,
      paddingBottom: 10,
    },
    notificationRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      minHeight: 60,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    iconCircle: {
      alignItems: "center",
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    notificationText: {
      flex: 1,
      gap: 2,
    },
    notificationTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 18,
    },
    notificationBody: {
      color: theme.colors.subtext,
      fontSize: 12,
      lineHeight: 16,
    },
    notificationTime: {
      color: theme.colors.muted,
      fontSize: 11,
      lineHeight: 14,
    },
    unreadDot: {
      backgroundColor: "#2563EB",
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    unreadPlaceholder: {
      height: 8,
      width: 8,
    },
    appealButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: theme.colors.sourceBg,
      borderRadius: theme.radius.sm,
      flexDirection: "row",
      gap: 6,
      marginLeft: 58,
      minHeight: 36,
      paddingHorizontal: 10,
    },
    appealButtonDisabled: {
      backgroundColor: theme.colors.card,
    },
    appealButtonText: {
      color: theme.colors.sourceText,
      fontSize: 12,
      fontWeight: "600",
    },
    appealButtonTextDisabled: {
      color: theme.colors.muted,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 16,
      width: "100%",
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
    },
    appealInput: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      color: theme.colors.text,
      fontSize: 14,
      minHeight: 110,
      padding: 10,
    },
    counterText: {
      alignSelf: "flex-end",
      color: theme.colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    counterTextWarning: {
      color: theme.colors.warning,
    },
    errorTextInline: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "500",
      marginTop: 8,
    },
    modalButtonRow: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "flex-end",
      marginTop: 12,
    },
    cancelButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
    },
    cancelButtonText: {
      color: theme.colors.subtext,
      fontSize: 14,
      fontWeight: "500",
    },
    submitButton: {
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 16,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: theme.colors.chipActiveText,
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
