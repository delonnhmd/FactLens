// Report reason picker + optional note, shared by the feed card "..." menu
// (ClaimCard) and the claim detail report flow. JS-only change.
// Deploy: eas update --channel preview. Do NOT run eas build.
//
// The picker labels map to the EXISTING ReportReason values, which
// reportService.appToDbReason already converts to the reports.reason CHECK
// enum (019_phase5_step2_launch_reports) — no migration needed.
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ReportReason } from "../types/claim";
import { useAppTheme } from "../hooks/useTheme";
import type { AppTheme } from "../context/DisplaySettingsContext";

export const REPORT_NOTE_MAX_LENGTH = 300;

const reportReasonOptions: Array<{ label: string; value: ReportReason }> = [
  { label: "Spam", value: "Spam" },
  { label: "Misleading or false source", value: "Fake source" },
  { label: "Harassment or abuse", value: "Harassment or abuse" },
  { label: "Hate speech", value: "Harmful content" },
  { label: "Sexual content", value: "Explicit content" },
  { label: "Other", value: "Other" },
];

// Step 1: reason picker (same Alert-menu pattern as the "..." post options).
export function showReportReasonPicker(onPick: (reason: ReportReason) => void) {
  Alert.alert("Report claim", "Why are you reporting this?", [
    ...reportReasonOptions.map((option) => ({
      text: option.label,
      onPress: () => onPick(option.value),
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}

interface ReportNoteModalProps {
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}

// Step 2: optional note before the existing submit call.
export function ReportNoteModal({ visible, submitting = false, onCancel, onSubmit }: ReportNoteModalProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const [note, setNote] = useState("");

  const handleCancel = () => {
    setNote("");
    onCancel();
  };

  const handleSubmit = () => {
    const trimmedNote = note.trim();
    setNote("");
    onSubmit(trimmedNote);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Report claim</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add details (optional)"
            placeholderTextColor={appTheme.colors.muted}
            style={styles.input}
            multiline
            maxLength={REPORT_NOTE_MAX_LENGTH}
            editable={!submitting}
          />
          <Text style={styles.counter}>
            {note.length}/{REPORT_NOTE_MAX_LENGTH}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={handleCancel}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit report"
            >
              <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Report"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(appTheme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    sheet: {
      backgroundColor: appTheme.colors.background,
      borderColor: appTheme.colors.border,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 16,
      width: "100%",
    },
    title: {
      color: appTheme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
    },
    input: {
      backgroundColor: appTheme.colors.card,
      borderColor: appTheme.colors.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      color: appTheme.colors.text,
      fontSize: 14,
      minHeight: 88,
      padding: 10,
      textAlignVertical: "top",
    },
    counter: {
      alignSelf: "flex-end",
      color: appTheme.colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    buttonRow: {
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
    cancelText: {
      color: appTheme.colors.subtext,
      fontSize: 14,
      fontWeight: "500",
    },
    submitButton: {
      alignItems: "center",
      backgroundColor: appTheme.colors.danger,
      borderRadius: 8,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 16,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
