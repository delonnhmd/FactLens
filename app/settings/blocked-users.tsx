// APPLE GUIDELINE 1.2 — blocked users management screen (NEW file)
// JS-only change. Deploy: eas update --channel preview
// Do NOT run eas build. Apple review response pending.
// Backend deploys to Render independently.
//
// Minimal by design: name + Unblock button per row. Header/back pattern
// copied from app/settings.tsx so the screen matches the settings look.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useClaims } from "../../context/ClaimsContext";
import { useAppTheme } from "../../hooks/useTheme";
import { fetchProfilesByIds, type BlockedProfileRow } from "../../services/blockService";

export default function BlockedUsersScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { blockedUserIds, unblockUser } = useClaims();
  const [profiles, setProfiles] = useState<BlockedProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingIds, setUnblockingIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    if (blockedUserIds.length === 0) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchProfilesByIds(blockedUserIds)
      .then((result) => {
        if (!mounted) {
          return;
        }

        // Keep a row even if the profile lookup missed it (e.g. deleted
        // account) so the user can still unblock.
        const profilesById = new Map(result.profiles.map((profile) => [profile.id, profile]));
        setProfiles(
          blockedUserIds.map(
            (id) => profilesById.get(id) ?? { id, username: null, display_name: null },
          ),
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [blockedUserIds]);

  const handleUnblock = (profile: BlockedProfileRow) => {
    setUnblockingIds((currentIds) => [...currentIds, profile.id]);
    unblockUser(profile.id)
      .then(() => {
        Alert.alert("User unblocked.", "Their claims return on the next refresh.");
      })
      .catch(() => {
        Alert.alert("Could not unblock this user right now.");
      })
      .finally(() => {
        setUnblockingIds((currentIds) => currentIds.filter((id) => id !== profile.id));
      });
  };

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
          <Ionicons name="chevron-back" size={22} color={appTheme.colors.chipActiveText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked users</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {loading ? (
          <ActivityIndicator color={appTheme.colors.primary} style={styles.loading} />
        ) : profiles.length === 0 ? (
          <Text style={styles.emptyText}>
            You have not blocked anyone. Blocking a user removes their claims from your feed and
            notifies Verifact moderation.
          </Text>
        ) : (
          <View style={styles.listCard}>
            {profiles.map((profile) => {
              const unblocking = unblockingIds.includes(profile.id);
              const name =
                profile.username
                  ? `@${profile.username}`
                  : profile.display_name || "Unknown user";

              return (
                <View key={profile.id} style={styles.row}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {name}
                  </Text>
                  <TouchableOpacity
                    style={[styles.unblockButton, unblocking && styles.unblockButtonDisabled]}
                    activeOpacity={0.8}
                    disabled={unblocking}
                    onPress={() => handleUnblock(profile)}
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${name}`}
                  >
                    <Text style={styles.unblockButtonText}>
                      {unblocking ? "Unblocking..." : "Unblock"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
      fontSize: Math.round(20 * (theme.typography.body.fontSize / 16)),
      fontWeight: "500",
    },
    content: {
      gap: 14,
      padding: 12,
      paddingBottom: 28,
    },
    loading: {
      marginTop: 24,
    },
    emptyText: {
      color: theme.colors.subtext,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      padding: 8,
    },
    listCard: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: 12,
      borderWidth: theme.borderWidth,
      overflow: "hidden",
    },
    row: {
      alignItems: "center",
      borderBottomColor: theme.colors.lightBorder,
      borderBottomWidth: theme.borderWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rowLabel: {
      color: theme.colors.text,
      flex: 1,
      fontSize: theme.typography.body.fontSize,
      fontWeight: "500",
      marginRight: 12,
    },
    unblockButton: {
      borderColor: theme.colors.danger,
      borderRadius: theme.radius?.sm ?? 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    unblockButtonDisabled: {
      opacity: 0.55,
    },
    unblockButtonText: {
      color: theme.colors.danger,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
  });
}
