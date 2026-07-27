import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Modal, NativeModules, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { onboardingStrings } from "../../constants/onboardingStrings";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useAppTheme } from "../../hooks/useTheme";
import { mapLocaleToAppLanguage } from "../../utils/detectUserLanguage";
import { getFirstClaimSeenKey } from "../../utils/onboardingStorage";

function getDeviceLocale(): string | null {
  const settings = NativeModules.SettingsManager?.settings;
  const appleLocale = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
  const nativeLocale = NativeModules.I18nManager?.localeIdentifier ?? NativeModules.SettingsManager?.localeIdentifier;
  if (Platform.OS === "ios" && typeof appleLocale === "string") return appleLocale;
  if (typeof nativeLocale === "string") return nativeLocale;
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}
interface FirstClaimCongratulationsModalProps {
  visible: boolean;
  userId: string | null;
  claimId: string;
  claimTitle: string;
  shareUrl: string;
  onClose: () => void;
}

export function FirstClaimCongratulationsModal({ visible, userId, claimId, claimTitle, shareUrl, onClose }: FirstClaimCongratulationsModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const copy = onboardingStrings[mapLocaleToAppLanguage(getDeviceLocale())];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!visible || !userId) {
      setReady(false);
      return () => {
        active = false;
      };
    }

    void AsyncStorage.getItem(getFirstClaimSeenKey(userId, claimId)).then((seen) => {
      if (!active) return;
      if (seen === "1") {
        onClose();
        return;
      }
      void AsyncStorage.setItem(getFirstClaimSeenKey(userId, claimId), "1");
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [claimId, onClose, userId, visible]);

  const share = async () => {
    try {
      await Share.share({ message: `${claimTitle}\n\nSee it on FactFight:\n${shareUrl}`, title: claimTitle, url: shareUrl });
    } finally {
      onClose();
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible && ready}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.celebration}>🎉</Text>
          <Text style={styles.title}>{copy.firstClaimLiveTitle.replace("🎉 ", "")}</Text>
          <Text style={styles.body}>{copy.firstClaimLiveBody}</Text>
          <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{copy.shareIt}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{copy.done}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: { alignItems: "center", backgroundColor: "rgba(13, 27, 62, 0.62)", flex: 1, justifyContent: "center", padding: theme.spacing.lg },
    card: { backgroundColor: theme.colors.background, borderColor: theme.colors.lightBorder, borderRadius: theme.radius.md, borderWidth: 1, maxWidth: 420, padding: theme.spacing.lg, width: "100%" },
    celebration: { fontSize: 42, textAlign: "center" },
    title: { color: theme.colors.navy, fontSize: 24, fontWeight: "500", lineHeight: 30, marginTop: theme.spacing.md, textAlign: "center" },
    body: { color: theme.colors.subtext, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight, marginTop: theme.spacing.md, textAlign: "center" },
    primaryButton: { alignItems: "center", backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, justifyContent: "center", marginTop: theme.spacing.xl, minHeight: 48 },
    primaryButtonText: { color: theme.colors.chipActiveText, fontSize: theme.typography.body.fontSize, fontWeight: "500" },
    secondaryButton: { alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm, minHeight: 44 },
    secondaryButtonText: { color: theme.colors.subtext, fontSize: theme.typography.body.fontSize, fontWeight: "500" },
  });
}
