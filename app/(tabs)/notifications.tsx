import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const loadNotifications = useCallback(
    async (showSpinner = false) => {
      if (!currentUser?.id) {
        setNotifications([]);
        setError("");
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }

      const result = await fetchNotifications(currentUser.id, 50);
      setNotifications(result.notifications);
      setError(result.error ?? "");

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

  const renderNotification = useCallback(
    ({ item }: { item: AppNotification }) => {
      const icon = getNotificationIcon(item);

      return (
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
      );
    },
    [handleNotificationPress, styles],
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
    listContent: {
      flexGrow: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    notificationRow: {
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.lightBorder,
      borderBottomWidth: 0.5,
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
  });
}
