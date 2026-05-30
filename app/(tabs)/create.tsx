// PHASE 1 STEP 4
import { useMemo, useState } from "react";
import { Image, View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Header } from "../../components/Header";
import { claimCategories } from "../../constants/claimCategories";
import { theme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { pickClaimImage, uploadClaimImage, type PickedClaimImage } from "../../services/imageUploadService";
import { validateClaimContent } from "../../utils/contentValidation";
import { detectVideoPlatform, getYouTubeThumbnailUrl, isSupportedVideoUrl, normalizeUrl } from "../../utils/videoUrl";

// PHASE 2 STEP 10
const TITLE_MAX_LENGTH = 160;
const DESCRIPTION_MAX_LENGTH = 1000;

type FieldName = "title" | "description" | "sourceUrl" | "videoUrl";
type FormErrors = Partial<Record<FieldName | "category" | "general", string>>;

export default function CreateScreen() {
  const router = useRouter();
  // PHASE 3 STEP 2
  const { currentUser, profile, profileError, isAuthenticated, isVerified, loading, refreshUser, ensureProfile } = useAuth();
  const { createClaim } = useClaims();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState("");
  // PHASE 3 STEP 7
  const [selectedImage, setSelectedImage] = useState<PickedClaimImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // PHASE 3 STEP 15
  const [profileGateError, setProfileGateError] = useState("");
  const [profileGateMessage, setProfileGateMessage] = useState("");

  const titleOverLimit = title.length > TITLE_MAX_LENGTH;
  const descriptionOverLimit = description.length > DESCRIPTION_MAX_LENGTH;
  // PHASE 3 STEP 8
  const trimmedVideoUrl = videoUrl.trim();
  const normalizedVideoUrl = normalizeUrl(videoUrl);
  const videoPlatform = trimmedVideoUrl ? detectVideoPlatform(normalizedVideoUrl) : null;
  const youtubeThumbnailUrl = trimmedVideoUrl ? getYouTubeThumbnailUrl(normalizedVideoUrl) : null;
  const videoUrlInvalid = trimmedVideoUrl.length > 0 && !isSupportedVideoUrl(normalizedVideoUrl);
  const submitDisabled = titleOverLimit || descriptionOverLimit || videoUrlInvalid || isSubmitting;

  const titleCounterStyle = useMemo(
    () => [styles.counterText, titleOverLimit && styles.counterTextError],
    [titleOverLimit],
  );
  const descriptionCounterStyle = useMemo(
    () => [styles.counterText, descriptionOverLimit && styles.counterTextError],
    [descriptionOverLimit],
  );

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

    if (errors[field] || errors.general) {
      setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined, general: undefined }));
    }
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!isAuthenticated) {
      nextErrors.general = "You need an account to post.";
      return nextErrors;
    }

    if (!isVerified) {
      nextErrors.general = "Please verify your email before posting.";
      return nextErrors;
    }

    // PHASE 3 STEP 8
    const validation = validateClaimContent({
      title,
      description,
      sourceUrl,
      videoUrl,
      category,
    });

    if (!validation.ok) {
      nextErrors.general = validation.errors.join("\n");
    }

    return nextErrors;
  };

  // PHASE 3 STEP 7
  const handlePickImage = async () => {
    setImageError("");

    try {
      const image = await pickClaimImage();

      if (image) {
        setSelectedImage(image);
      }
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "We could not select this image. Please try again.");
    }
  };

  // PHASE 3 STEP 7
  const handleSubmit = async () => {
    if (submitDisabled) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        title: titleOverLimit ? "Title must be 160 characters or fewer." : currentErrors.title,
        description: descriptionOverLimit
          ? "Description must be 1000 characters or fewer."
          : currentErrors.description,
        videoUrl: videoUrlInvalid ? "Enter a valid video URL." : currentErrors.videoUrl,
      }));
      return;
    }

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      let imageUrl: string | null = null;

      if (selectedImage) {
        if (!currentUser) {
          throw new Error("You need an account to post.");
        }

        imageUrl = await uploadClaimImage(currentUser.id, selectedImage.uri, selectedImage.mimeType);
      }

      await createClaim({
        title,
        description,
        sourceUrl: normalizeUrl(sourceUrl),
        videoUrl: trimmedVideoUrl ? normalizedVideoUrl : "",
        imageUrl,
        category,
      });

      setTitle("");
      setDescription("");
      setSourceUrl("");
      setVideoUrl("");
      setCategory("");
      setSelectedImage(null);
      setImageError("");
      setErrors({});
      router.replace({ pathname: "/", params: { claimPosted: "1" } });
    } catch (claimError) {
      setErrors({
        general: claimError instanceof Error ? claimError.message : "We could not save this claim. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // PHASE 3 STEP 15
  const handleFixProfile = async () => {
    setProfileGateError("");
    setProfileGateMessage("");

    const result = await ensureProfile();

    if (result.error) {
      setProfileGateError(result.error);
      return;
    }

    setProfileGateMessage(result.message ?? "Profile ready.");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Claim" subtitle="Draft a new news claim" />
        <View style={styles.content}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>Checking account...</Text>
            <Text style={styles.gateText}>Please wait while FactLens checks your login session.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !isVerified) {
    const gateTitle = isAuthenticated ? "Please verify your email before posting." : "You need an account to post.";
    const buttonLabel = isAuthenticated ? "I verified my email" : "Log in or Create Account";
    const buttonAction = isAuthenticated ? refreshUser : () => router.push("/auth");

    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Claim" subtitle="Draft a new news claim" />
        <View style={styles.content}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>{gateTitle}</Text>
            <Text style={styles.gateText}>
              {isAuthenticated
                ? "Open the verification link from your email, then refresh your account status here."
                : "FactLens requires a verified account before posting a news claim."}
            </Text>
            <TouchableOpacity style={styles.button} onPress={buttonAction} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Claim" subtitle="Draft a new news claim" />
        <View style={styles.content}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>Profile required to post.</Text>
            <Text style={styles.gateText}>
              {profileGateError ||
                profileError ||
                "Your account profile is still syncing. Fix your profile before posting."}
            </Text>
            {profileGateMessage ? <Text style={styles.profileGateMessage}>{profileGateMessage}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleFixProfile} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Fix Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push("/profile")}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Open Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const username = profile.username;
  const displayName = profile.display_name || profile.username;
  const initial = displayName.slice(0, 1).toUpperCase() || "U";

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Create Claim" subtitle="Draft a new news claim" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.composeCard}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.accountTextWrap}>
              <View style={styles.accountNameRow}>
                <Text style={styles.accountName}>{displayName}</Text>
                {isVerified ? <Text style={styles.verifiedBadge}>Verified</Text> : null}
              </View>
              <Text style={styles.accountMeta}>@{username}</Text>
              <Text style={styles.accountScore}>Reputation {profile.reputation_score}</Text>
            </View>
          </View>

          <View style={styles.warningPanel}>
            <Text style={styles.warningText}>
              FactLens blocks nude, porn, sexually explicit, abusive, and harmful content. Images/videos may be
              reviewed by automated systems later.
            </Text>
          </View>

          {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

          <View style={styles.fieldGroup}>
            <TextInput
              value={title}
              onChangeText={(value) => updateField("title", value)}
              placeholder="What claim should the community verify?"
              style={[styles.titleInput, (errors.title || titleOverLimit) && styles.inputError]}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <View style={styles.fieldFooter}>
              {errors.title || titleOverLimit ? (
                <Text style={styles.errorText}>
                  {errors.title ?? "Title must be 160 characters or fewer."}
                </Text>
              ) : (
                <View />
              )}
              <Text style={titleCounterStyle}>{title.length}/{TITLE_MAX_LENGTH}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <TextInput
              value={description}
              onChangeText={(value) => updateField("description", value)}
              placeholder="Add context, what was said, and why it matters."
              style={[styles.input, styles.textArea, (errors.description || descriptionOverLimit) && styles.inputError]}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <View style={styles.fieldFooter}>
              {errors.description || descriptionOverLimit ? (
                <Text style={styles.errorText}>
                  {errors.description ?? "Description must be 1000 characters or fewer."}
                </Text>
              ) : (
                <View />
              )}
              <Text style={descriptionCounterStyle}>{description.length}/{DESCRIPTION_MAX_LENGTH}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Main Source URL</Text>
            <TextInput
              value={sourceUrl}
              onChangeText={(value) => updateField("sourceUrl", value)}
              placeholder="apple.com/news"
              style={[styles.input, errors.sourceUrl && styles.inputError]}
              placeholderTextColor={theme.colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.sourceUrl ? <Text style={styles.errorText}>{errors.sourceUrl}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Video URL (Optional)</Text>
            <TextInput
              value={videoUrl}
              onChangeText={(value) => updateField("videoUrl", value)}
              placeholder="youtube.com/watch, tiktok.com, x.com, or video link"
              style={[styles.input, errors.videoUrl && styles.inputError]}
              placeholderTextColor={theme.colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.videoUrl || videoUrlInvalid ? (
              <Text style={styles.errorText}>
                {errors.videoUrl ?? "Enter a valid video URL."}
              </Text>
            ) : null}
            {trimmedVideoUrl && videoPlatform ? (
              <View style={styles.videoPreviewPanel}>
                <Text style={styles.videoDetectedText}>Detected: {videoPlatform}</Text>
                {youtubeThumbnailUrl ? (
                  <Image source={{ uri: youtubeThumbnailUrl }} style={styles.videoThumbnail} resizeMode="cover" />
                ) : (
                  <Text style={styles.helperText}>A {videoPlatform} link preview will appear on the claim.</Text>
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {claimCategories.map((option) => {
                const selected = category === option;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.categoryButton, selected && styles.categoryButtonSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setCategory((currentCategory) => (currentCategory === option ? "" : option));
                      if (errors.category || errors.general) {
                        setErrors((currentErrors) => ({ ...currentErrors, category: undefined, general: undefined }));
                      }
                    }}
                  >
                    <Text style={[styles.categoryButtonText, selected && styles.categoryButtonTextSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Image / Screenshot</Text>
            {selectedImage ? (
              <View style={styles.imagePreviewPanel}>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedImage(null);
                    setImageError("");
                  }}
                >
                  <Text style={styles.removeImageButtonText}>Remove image</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.imageButton} activeOpacity={0.8} onPress={handlePickImage}>
              <Text style={styles.imageButtonText}>Add Image / Screenshot</Text>
            </TouchableOpacity>
            {imageError ? <Text style={styles.errorText}>{imageError}</Text> : null}
            <Text style={styles.helperText}>Images are compressed before upload to save storage.</Text>
            <Text style={styles.helperText}>
              Full 1200px resize compression will be enabled after expo-image-manipulator is installed.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, submitDisabled && styles.buttonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={submitDisabled}
          >
            <Text style={styles.buttonText}>{isSubmitting ? "Posting..." : "Post Claim"}</Text>
          </TouchableOpacity>
        </View>
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
  composeCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
    ...theme.shadows.light,
  },
  accountRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E0E7FF",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: "700",
  },
  accountTextWrap: {
    flex: 1,
  },
  accountNameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  accountName: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  accountMeta: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
  },
  accountScore: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginTop: theme.spacing.xs,
  },
  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
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
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  titleInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    minHeight: 96,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    textAlignVertical: "top",
  },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  textArea: {
    minHeight: 148,
    textAlignVertical: "top",
  },
  fieldFooter: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
  },
  counterText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontVariant: ["tabular-nums"],
    marginLeft: "auto",
  },
  counterTextError: {
    color: theme.colors.danger,
    fontWeight: "700",
  },
  errorText: {
    color: theme.colors.danger,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  categoryButton: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  categoryButtonSelected: {
    backgroundColor: "#E0E7FF",
    borderColor: theme.colors.primary,
  },
  categoryButtonText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  categoryButtonTextSelected: {
    color: theme.colors.primary,
  },
  imageButton: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingVertical: theme.spacing.md,
  },
  imagePreviewPanel: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  imagePreview: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    height: 180,
    width: "100%",
  },
  removeImageButton: {
    alignSelf: "flex-start",
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  removeImageButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  imageButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  videoPreviewPanel: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  videoDetectedText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
  videoThumbnail: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    height: 160,
    width: "100%",
  },
  helperText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.sm,
  },
  profileGateMessage: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "700",
  },
});
