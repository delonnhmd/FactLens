import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { onboardingStrings } from "../../constants/onboardingStrings";
import { useAuth } from "../../context/AuthContext";
import { useAppTheme } from "../../hooks/useTheme";
import { mapLocaleToAppLanguage } from "../../utils/detectUserLanguage";
import { getOnboardingPendingKey, getOnboardingSeenKey } from "../../utils/onboardingStorage";
import type { AppTheme } from "../../context/DisplaySettingsContext";

function getDeviceLocale(): string | null {
  const settings = NativeModules.SettingsManager?.settings;
  const appleLocale = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
  const nativeLocale = NativeModules.I18nManager?.localeIdentifier ?? NativeModules.SettingsManager?.localeIdentifier;

  if (Platform.OS === "ios") {
    return typeof appleLocale === "string" ? appleLocale : null;
  }

  if (typeof nativeLocale === "string") {
    return nativeLocale;
  }

  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}
interface FirstClaimOnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateClaim: () => void;
}

function FirstClaimOnboardingModal({ visible, onClose, onCreateClaim }: FirstClaimOnboardingModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const language = mapLocaleToAppLanguage(getDeviceLocale());
  const copy = onboardingStrings[language];
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const isLastStep = step === 2;
  const advance = () => {
    if (isLastStep) {
      onClose();
      return;
    }

    setStep((current) => current + 1);
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.stepLabel}>{step + 1} / 3</Text>
            <Pressable accessibilityLabel={copy.done} accessibilityRole="button" hitSlop={8} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            {[0, 1, 2].map((item) => (
              <View key={item} style={[styles.progressDot, item === step && styles.progressDotActive]} />
            ))}
          </View>

          {step === 0 ? (
            <>
              <Text style={styles.eyebrow}>FactFight</Text>
              <Text style={styles.title}>{copy.welcomeTitle}</Text>
              <Text style={styles.body}>{copy.welcomeBody}</Text>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.title}>{copy.howItWorksTitle}</Text>
              <Text style={styles.body}>{copy.howItWorksBody}</Text>
              <View style={styles.stepsList}>
                {copy.howItWorksSteps.map((label, index) => (
                  <View key={label} style={styles.stepItem}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                    <Text style={styles.stepText}>{label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.title}>{copy.firstClaimTitle}</Text>
              <Text style={styles.body}>{copy.firstClaimBody}</Text>
              <Pressable accessibilityRole="button" onPress={onCreateClaim} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{copy.createClaim}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>{copy.exploreFirst}</Text>
              </Pressable>
            </>
          ) : null}

          {step < 2 ? (
            <View style={styles.footerRow}>
              <Pressable accessibilityRole="button" disabled={step === 0} onPress={() => setStep((current) => current - 1)} style={styles.footerButton}>
                <Text style={[styles.footerText, step === 0 && styles.footerTextDisabled]}>{copy.back}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={advance} style={styles.primaryButtonSmall}>
                <Text style={styles.primaryButtonText}>{copy.next}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function FirstClaimOnboardingGate() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    if (loading || !currentUser) {
      setVisible(false);
      return () => {
        active = false;
      };
    }

    const userId = currentUser.id;
    void Promise.all([
      AsyncStorage.getItem(getOnboardingPendingKey(userId)),
      AsyncStorage.getItem(getOnboardingSeenKey(userId)),
    ]).then(([pending, seen]) => {
      if (!active || pending !== "1" || seen === "1") return;

      void AsyncStorage.setItem(getOnboardingSeenKey(userId), "1");
      setVisible(true);
    });

    return () => {
      active = false;
    };
  }, [currentUser, loading]);

  const close = () => {
    if (currentUser) void AsyncStorage.removeItem(getOnboardingPendingKey(currentUser.id));
    setVisible(false);
  };

  const createClaim = () => {
    close();
    router.push("/create");
  };

  return <FirstClaimOnboardingModal onClose={close} onCreateClaim={createClaim} visible={visible} />;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: { alignItems: "center", backgroundColor: "rgba(13, 27, 62, 0.62)", flex: 1, justifyContent: "center", padding: theme.spacing.lg },
    card: { backgroundColor: theme.colors.background, borderColor: theme.colors.lightBorder, borderRadius: theme.radius.md, borderWidth: 1, maxWidth: 420, padding: theme.spacing.lg, width: "100%" },
    topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
    stepLabel: { color: theme.colors.ai, fontSize: theme.typography.small.fontSize, fontWeight: "500" },
    closeText: { color: theme.colors.subtext, fontSize: 28, lineHeight: 28 },
    progressRow: { flexDirection: "row", gap: theme.spacing.xs, marginTop: theme.spacing.sm },
    progressDot: { backgroundColor: theme.colors.lightBorder, borderRadius: 4, flex: 1, height: 4 },
    progressDotActive: { backgroundColor: theme.colors.ai },
    eyebrow: { color: theme.colors.ai, fontSize: theme.typography.small.fontSize, fontWeight: "500", marginTop: theme.spacing.xl },
    title: { color: theme.colors.navy, fontSize: 24, fontWeight: "500", lineHeight: 30, marginTop: theme.spacing.sm },
    body: { color: theme.colors.subtext, fontSize: theme.typography.body.fontSize, lineHeight: theme.typography.body.lineHeight, marginTop: theme.spacing.md },
    stepsList: { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
    stepItem: { alignItems: "center", backgroundColor: theme.colors.card, borderRadius: theme.radius.sm, flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.sm },
    stepNumber: { alignItems: "center", backgroundColor: theme.colors.aiBg, borderRadius: 14, color: theme.colors.ai, fontSize: 13, fontWeight: "500", height: 28, lineHeight: 28, textAlign: "center", width: 28 },
    stepText: { color: theme.colors.text, flex: 1, fontSize: theme.typography.body.fontSize },
    footerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.xl },
    footerButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: theme.spacing.sm },
    footerText: { color: theme.colors.navy, fontSize: theme.typography.body.fontSize, fontWeight: "500" },
    footerTextDisabled: { color: theme.colors.muted },
    primaryButton: { alignItems: "center", backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, justifyContent: "center", marginTop: theme.spacing.xl, minHeight: 48, paddingHorizontal: theme.spacing.md },
    primaryButtonSmall: { alignItems: "center", backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, justifyContent: "center", minHeight: 44, paddingHorizontal: theme.spacing.lg },
    primaryButtonText: { color: theme.colors.chipActiveText, fontSize: theme.typography.body.fontSize, fontWeight: "500" },
    secondaryButton: { alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm, minHeight: 44 },
    secondaryButtonText: { color: theme.colors.subtext, fontSize: theme.typography.body.fontSize, fontWeight: "500" },
  });
}
