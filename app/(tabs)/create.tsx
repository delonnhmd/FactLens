// PHASE 1 STEP 4
import { useState } from "react";
import { Alert, View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { PROHIBITED_CONTENT } from "../../constants/contentRules";
import { containsProhibitedContent, isValidHttpUrl, isValidVideoUrl } from "../../services/urlValidation";
import { theme } from "../../constants/theme";

// PHASE 2 STEP 8
type FieldName = "title" | "description" | "sourceUrl" | "videoUrl";
type FormErrors = Partial<Record<FieldName | "general", string>>;

export default function CreateScreen() {
  const router = useRouter();
  // PHASE 2 STEP 9
  const { currentUser, isAuthenticated, isVerified, loginPlaceholder } = useAuth();
  const { createClaim } = useClaims();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
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

    if (field === "videoUrl") {
      setVideoUrl(value);
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
    const trimmedVideoUrl = videoUrl.trim();

    if (!isAuthenticated) {
      nextErrors.general = "You need an account to post.";
      return nextErrors;
    }

    if (!isVerified) {
      nextErrors.general = "Verify your account before posting.";
      return nextErrors;
    }

    if (containsProhibitedContent(`${trimmedTitle} ${trimmedDescription}`, PROHIBITED_CONTENT)) {
      nextErrors.general = "This content is not allowed on FactLens.";
      return nextErrors;
    }

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
    } else if (!isValidHttpUrl(trimmedSourceUrl)) {
      nextErrors.sourceUrl = "Source URL must start with http:// or https://.";
    }

    if (trimmedVideoUrl && !isValidVideoUrl(trimmedVideoUrl)) {
      nextErrors.videoUrl = "Video URL must be YouTube, TikTok, X/Twitter, Facebook, Instagram, or a direct video link.";
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
      videoUrl,
      category,
    });

    setTitle("");
    setDescription("");
    setSourceUrl("");
    setVideoUrl("");
    setCategory("");
    setErrors({});
    router.replace({ pathname: "/", params: { claimPosted: "1" } });
  };

  if (!isAuthenticated || !isVerified) {
    const gateTitle = isAuthenticated ? "Verify your account before posting." : "You need an account to post.";
    const buttonLabel = isAuthenticated ? "Verify Account" : "Create Account";
    const buttonAction = isAuthenticated
      ? () => Alert.alert("Account verification will be added later.")
      : loginPlaceholder;

    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Claim" subtitle="Draft a new news claim" />
        <View style={styles.content}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>{gateTitle}</Text>
            <Text style={styles.gateText}>
              Account-required posting is a local placeholder until real authentication is added.
            </Text>
            <TouchableOpacity style={styles.button} onPress={buttonAction} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create Claim" subtitle="Draft a new news claim" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.noticePanel}>
          <Text style={styles.noticeTitle}>Account required to post.</Text>
          <Text style={styles.noticeText}>
            Posting as {currentUser.displayName} (@{currentUser.username}) - Verified demo account
          </Text>
        </View>
        <View style={styles.warningPanel}>
          <Text style={styles.warningText}>Nude, porn, and sexually explicit content are not allowed.</Text>
        </View>
        {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}
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
          <Text style={styles.label}>Main Source URL</Text>
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
          <Text style={styles.label}>YouTube / Video URL (Optional)</Text>
          <TextInput
            value={videoUrl}
            onChangeText={(value) => updateField("videoUrl", value)}
            placeholder="YouTube, TikTok, X/Twitter, Facebook, Instagram, or video link"
            style={[styles.input, errors.videoUrl && styles.inputError]}
            placeholderTextColor={theme.colors.muted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.videoUrl ? <Text style={styles.errorText}>{errors.videoUrl}</Text> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Image / Screenshot</Text>
          <TouchableOpacity
            style={styles.imageButton}
            activeOpacity={0.8}
            onPress={() => Alert.alert("Image upload will be added in backend phase.")}
          >
            <Text style={styles.imageButtonText}>Add Image / Screenshot</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>Images will be automatically resized and compressed before upload.</Text>
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
  gateCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
    ...theme.shadows.light,
  },
  gateTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  gateText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    marginBottom: theme.spacing.md,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  noticePanel: {
    backgroundColor: "#E0E7FF",
    borderColor: "#BFDBFE",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  noticeTitle: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
  },
  noticeText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
  },
  warningPanel: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  warningText: {
    color: theme.colors.warning,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  generalError: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
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
  imageButton: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingVertical: theme.spacing.md,
  },
  imageButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  helperText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
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
