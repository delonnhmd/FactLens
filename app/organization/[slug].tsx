import { useEffect, useMemo, useState } from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header } from "../../components/Header";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";
import { fetchOrganizationBySlug, type OrganizationProfile } from "../../services/organizationService";

export default function OrganizationProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    fetchOrganizationBySlug(slug ?? "")
      .then((result) => {
        if (!mounted) {
          return;
        }

        setOrganization(result.organization);
        setError(result.error ?? "");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  const initial = (organization?.name || "O").slice(0, 1).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Organization" subtitle="Verified Verifact organization" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={appTheme.colors.link} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {loading ? <Text style={styles.title}>Loading organization...</Text> : null}

          {!loading && error ? (
            <>
              <Text style={styles.title}>Organization unavailable</Text>
              <Text style={styles.bodyText}>This organization profile is not available right now.</Text>
            </>
          ) : null}

          {!loading && organization ? (
            <>
              <View style={styles.heroRow}>
                {organization.avatarUrl ? (
                  <Image source={{ uri: organization.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                )}
                <View style={styles.identity}>
                  <View style={styles.nameRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {organization.name}
                    </Text>
                    {organization.verified ? <Ionicons name="checkmark-circle" size={18} color={appTheme.colors.success} /> : null}
                  </View>
                  <Text style={styles.username}>@{organization.slug}</Text>
                </View>
              </View>
              {organization.description ? <Text style={styles.bodyText}>{organization.description}</Text> : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{organization.verified ? "Verified organization" : "Organization"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Added</Text>
                <Text style={styles.detailValue}>
                  {organization.createdAt ? new Date(organization.createdAt).toLocaleDateString() : "Unknown"}
                </Text>
              </View>
            </>
          ) : null}
        </View>
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
    content: {
      padding: 10,
    },
    backButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      marginBottom: 8,
    },
    backText: {
      color: theme.colors.link,
      fontSize: 13,
      fontWeight: "500",
    },
    card: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.md,
      borderWidth: 0.5,
      padding: 14,
    },
    heroRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    avatar: {
      alignItems: "center",
      backgroundColor: theme.colors.phaseBg,
      borderRadius: 28,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    avatarImage: {
      borderRadius: 28,
      height: 56,
      width: 56,
    },
    avatarText: {
      color: theme.colors.primary,
      fontSize: 24,
      fontWeight: "500",
    },
    identity: {
      flex: 1,
    },
    nameRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    title: {
      color: theme.colors.text,
      flexShrink: 1,
      fontSize: 22,
      fontWeight: "500",
    },
    username: {
      color: theme.colors.subtext,
      fontSize: 14,
      marginTop: 2,
    },
    bodyText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: theme.spacing.md,
    },
    detailRow: {
      borderTopColor: theme.colors.lightBorder,
      borderTopWidth: 0.5,
      paddingVertical: theme.spacing.md,
    },
    detailLabel: {
      color: theme.colors.subtext,
      fontSize: 12,
      fontWeight: "500",
      marginBottom: 5,
    },
    detailValue: {
      color: theme.colors.text,
      fontSize: 14,
    },
  });
}
