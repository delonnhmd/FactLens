// PHASE 1 STEP 4
import { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { useClaims } from "../../context/ClaimsContext";
import { theme } from "../../constants/theme";

// PHASE 2 STEP 2
type FieldName = "title" | "description" | "sourceUrl";
type FormErrors = Partial<Record<FieldName, string>>;

export default function CreateScreen() {
  const router = useRouter();
  const { createClaim } = useClaims();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const updateField = (field: FieldName, value: string) => {
    if (field === "title") {
      setTitle(value);
    }

    if (field === "description") {
      setDescription(value);
    }

    if (field === "sourceUrl") {
      setSourceUrl(value);
    }

    if (errors[field]) {
      setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    }
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedSourceUrl = sourceUrl.trim();

    if (!trimmedTitle) {
      nextErrors.title = "Title is required.";
    } else if (trimmedTitle.length < 10) {
      nextErrors.title = "Title must be at least 10 characters.";
    }

    if (!trimmedDescription) {
      nextErrors.description = "Description is required.";
    } else if (trimmedDescription.length < 20) {
      nextErrors.description = "Description must be at least 20 characters.";
    }

    if (!trimmedSourceUrl) {
      nextErrors.sourceUrl = "Source URL is required.";
    } else if (!/^https?:\/\//i.test(trimmedSourceUrl)) {
      nextErrors.sourceUrl = "Source URL must start with http:// or https://.";
    }

    return nextErrors;
  };

  const handleSubmit = () => {
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    createClaim({
      title,
      description,
      sourceUrl,
      category,
    });

    setTitle("");
    setDescription("");
    setSourceUrl("");
    setCategory("");
    setErrors({});
    router.replace({ pathname: "/", params: { claimPosted: "1" } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create Claim" subtitle="Draft a new news claim" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Claim Title</Text>
          <TextInput
            value={title}
            onChangeText={(value) => updateField("title", value)}
            placeholder="Enter a concise claim title"
            style={[styles.input, errors.title && styles.inputError]}
            placeholderTextColor={theme.colors.muted}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={(value) => updateField("description", value)}
            placeholder="Describe the claim in a few sentences"
            style={[styles.input, styles.textArea, errors.description && styles.inputError]}
            placeholderTextColor={theme.colors.muted}
            multiline
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Source URL</Text>
          <TextInput
            value={sourceUrl}
            onChangeText={(value) => updateField("sourceUrl", value)}
            placeholder="Add a source link"
            style={[styles.input, errors.sourceUrl && styles.inputError]}
            placeholderTextColor={theme.colors.muted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.sourceUrl ? <Text style={styles.errorText}>{errors.sourceUrl}</Text> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category (Optional)</Text>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Politics, health, technology..."
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
          />
        </View>
        <TouchableOpacity style={styles.button} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Post Claim</Text>
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
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  button: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
  },
  buttonText: {
    color: theme.colors.background,
    fontWeight: "700",
    fontSize: theme.typography.body.fontSize,
  },
});
