// PHASE 1 STEP 4
import { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { Header } from "../../components/Header";
import { theme } from "../../constants/theme";

export default function CreateScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create Claim" subtitle="Draft a new news claim" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Claim Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a concise claim title"
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the claim in a few sentences"
            style={[styles.input, styles.textArea]}
            placeholderTextColor={theme.colors.muted}
            multiline
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Source URL</Text>
          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="Add a source link"
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
            keyboardType="url"
          />
        </View>
        <TouchableOpacity style={styles.button} onPress={() => {}} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Submit Claim</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    padding: theme.spacing.lg,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.text,
    fontWeight: "600",
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  button: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
  },
  buttonText: {
    color: theme.colors.background,
    fontWeight: "700",
    fontSize: theme.typography.body.fontSize,
  },
});
