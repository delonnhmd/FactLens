// PHASE 1 STEP 4
// PHASE 3 STEP 28
// PHASE 5 STEP 5 PRE-LAUNCH
// PHASE 5 STEP 6
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ClaimQualityBox } from "../../components/ClaimQualityBox";
import { Header } from "../../components/Header";
import { MentionTextInput } from "../../components/MentionTextInput";
import { claimCategories } from "../../constants/claimCategories";
import type { AppTheme } from "../../context/DisplaySettingsContext";
import { useScrollAwareTabBar } from "../../context/TabBarVisibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useClaims } from "../../context/ClaimsContext";
import { useAppTheme } from "../../hooks/useTheme";
import {
  formatImageSize,
  pickImageFromCamera,
  pickImageFromLibrary,
  type PickedOptimizedImage,
} from "../../services/imageUploadService";
import { analyzeClaimDraft } from "../../utils/claimQuality";
import { validateClaimContent } from "../../utils/contentValidation";
import { detectVideoPlatform, getYouTubeThumbnailUrl, isSupportedVideoUrl } from "../../utils/videoUrl";
import { normalizeUrl } from "../../utils/url";
import { getSourceQuality, getSourceTrustLabel } from "../../services/sourceQuality";
import { cleanUserError } from "../../utils/debugError";
import { CLAIM_MENTION_LIMIT, getMentionLimitError } from "../../utils/mentions";

// PHASE 2 STEP 10
const TITLE_MAX_LENGTH = 160;
const DESCRIPTION_MAX_LENGTH = 1000;
// PHASE 5 election positioning UI
const politicsSubCategories = ["Election 2026", "Policy", "Politician", "Government"];

type FieldName = "title" | "description" | "sourceUrl" | "videoUrl" | "politicianTag";
type FormErrors = Partial<Record<FieldName | "category" | "general", string>>;

export default function CreateScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const { contentBottomPadding } = useScrollAwareTabBar();
  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingBottom: contentBottomPadding }],
    [contentBottomPadding, styles.content],
  );
  // PHASE 3 STEP 2
  const { currentUser, profile, profileError, isAuthenticated, isVerified, loading, refreshUser, ensureProfile } = useAuth();
  const { createClaim } = useClaims();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState("");
  // PHASE 5 election positioning UI
  const [subCategory, setSubCategory] = useState("");
  const [politicianTag, setPoliticianTag] = useState("");
  // PHASE 3 STEP 7
  const [selectedImage, setSelectedImage] = useState<PickedOptimizedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // PHASE 3 STEP 15
  const [profileGateError, setProfileGateError] = useState("");
  const [profileGateMessage, setProfileGateMessage] = useState("");
  const profileAutoFixAttempted = useRef(false);

  const titleOverLimit = title.length > TITLE_MAX_LENGTH;
  const descriptionOverLimit = description.length > DESCRIPTION_MAX_LENGTH;
  const descriptionMentionLimitError = getMentionLimitError(description, CLAIM_MENTION_LIMIT, "Claim description");
  // PHASE 4 STEP 11
  // PHASE 4 STEP 11 REVISED
  const claimQuality = useMemo(
    () => analyzeClaimDraft({ title, description, sourceUrl, category }),
    [title, description, sourceUrl, category],
  );
  const showClaimQualityBox = Boolean(title.trim() || description.trim() || sourceUrl.trim());
  // PHASE 3 STEP 8
  const trimmedVideoUrl = videoUrl.trim();
  const normalizedVideoUrl = normalizeUrl(videoUrl);
  const videoPlatform = trimmedVideoUrl ? detectVideoPlatform(normalizedVideoUrl) : null;
  const youtubeThumbnailUrl = trimmedVideoUrl ? getYouTubeThumbnailUrl(normalizedVideoUrl) : null;
  const videoUrlInvalid = trimmedVideoUrl.length > 0 && !isSupportedVideoUrl(normalizedVideoUrl);
  const normalizedSourceUrl = sourceUrl.trim() ? normalizeUrl(sourceUrl) : "";
  const sourcePreviewDomain = useMemo(() => {
    if (!normalizedSourceUrl) {
      return "";
    }

    try {
      return new URL(normalizedSourceUrl).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  }, [normalizedSourceUrl]);
  const sourcePreviewQuality = useMemo(
    () => (normalizedSourceUrl ? getSourceQuality(normalizedSourceUrl) : null),
    [normalizedSourceUrl],
  );
  const sourcePreviewLabel = sourcePreviewQuality
    ? getSourceTrustLabel(sourcePreviewQuality.score, sourcePreviewQuality.label)
    : null;
  const submitDisabled =
    titleOverLimit ||
    descriptionOverLimit ||
    Boolean(descriptionMentionLimitError) ||
    videoUrlInvalid ||
    !claimQuality.canSubmit ||
    isSubmitting;

  const titleCounterStyle = useMemo(
    () => [styles.counterText, titleOverLimit && styles.counterTextError],
    [styles, titleOverLimit],
  );
  const descriptionCounterStyle = useMemo(
    () => [styles.counterText, descriptionOverLimit && styles.counterTextError],
    [descriptionOverLimit, styles],
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

    if (field === "politicianTag") {
      setPoliticianTag(value);
    }

    if (errors[field] || errors.general) {
      setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined, general: undefined }));
    }
  };

  // PHASE 5 election positioning UI
  useEffect(() => {
    if (category !== "Politics") {
      setSubCategory("");
      setPoliticianTag("");
      return;
    }

    if (subCategory !== "Politician") {
      setPoliticianTag("");
    }
  }, [category, subCategory]);

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

    // PHASE 4 STEP 11 REVISED
    if (!claimQuality.canSubmit) {
      nextErrors.general = claimQuality.warnings.join("\n") || "This content cannot be posted.";
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

    if (descriptionMentionLimitError) {
      nextErrors.description = descriptionMentionLimitError;
    }

    return nextErrors;
  };

  // PHASE 5 STEP 6
  const handlePickImageFromSource = async (source: "camera" | "library") => {
    setImageError("");

    try {
      const image = source === "camera" ? await pickImageFromCamera() : await pickImageFromLibrary();

      if (image) {
        setSelectedImage(image);
      }
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not select this image right now.");
    }
  };

  // PHASE 5 STEP 6
  const handlePickImage = () => {
    Alert.alert("Add image", "Choose a source for this claim image.", [
      {
        text: "Camera",
        onPress: () => {
          void handlePickImageFromSource("camera");
        },
      },
      {
        text: "Photo Library",
        onPress: () => {
          void handlePickImageFromSource("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submitClaim = async () => {
    try {
      setIsSubmitting(true);

      console.log("[url] normalized source url:", normalizedSourceUrl);
      console.log("[create submit] current authenticated user:", {
        userId: currentUser?.id ?? null,
        isAuthenticated,
        isVerified,
      });
      console.log("[create submit] profile exists:", Boolean(profile), {
        profileId: profile?.id ?? null,
      });
      console.log("[create submit] image selected:", Boolean(selectedImage), {
        fileName: selectedImage?.fileName ?? null,
        fileSize: selectedImage?.fileSize ?? null,
        mimeType: selectedImage?.mimeType ?? null,
      });

      const createdClaim = await createClaim({
        title,
        description,
        sourceUrl: normalizedSourceUrl,
        videoUrl: trimmedVideoUrl ? normalizedVideoUrl : "",
        imageAsset: selectedImage,
        category,
        // PHASE 5 election positioning UI
        subCategory,
        politicianTag,
      });

      setTitle("");
      setDescription("");
      setSourceUrl("");
      setVideoUrl("");
      setCategory("");
      setSubCategory("");
      setPoliticianTag("");
      setSelectedImage(null);
      setImageError("");
      setErrors({});
      router.replace(`/claim/${createdClaim.id}`);
    } catch (error) {
      console.log("[create submit] final thrown error:", error);
      setErrors({
        // PHASE 4 STEP 24
        // PHASE 5 STEP 6
        general: cleanUserError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // PHASE 4 STEP 11
  // PHASE 4 STEP 11 REVISED
  const handleSubmit = async () => {
    if (submitDisabled) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        title: titleOverLimit ? "Title must be 160 characters or fewer." : currentErrors.title,
        description: descriptionOverLimit
          ? "Description must be 1000 characters or fewer."
          : descriptionMentionLimitError || currentErrors.description,
        videoUrl: videoUrlInvalid ? "Enter a valid video URL." : currentErrors.videoUrl,
        general: !claimQuality.canSubmit ? claimQuality.warnings.join("\n") : currentErrors.general,
      }));
      return;
    }

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await submitClaim();
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

  // PHASE 3 STEP 28
  useEffect(() => {
    if (loading || !isAuthenticated || !isVerified || profile || profileAutoFixAttempted.current) {
      return;
    }

    profileAutoFixAttempted.current = true;
    void handleFixProfile();
  }, [isAuthenticated, isVerified, loading, profile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Claim" subtitle="Draft a new news claim" />
        <View style={styles.content}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>Checking account...</Text>
            <Text style={styles.gateText}>Please wait while Verifact checks your login session.</Text>
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
                : "Verifact requires a verified account before posting a news claim."}
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

  if (profile.is_suspended) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Create Claim" subtitle="Draft a new news claim" />
        <View style={styles.content}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>Posting is locked.</Text>
            <Text style={styles.gateText}>
              {profile.suspension_reason || "This account is suspended from posting claims."}
            </Text>
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
      <ScrollView contentContainerStyle={contentContainerStyle} keyboardShouldPersistTaps="handled">
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
              Verifact blocks nude, porn, sexually explicit, abusive, and harmful content. Images/videos may be
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
              placeholderTextColor={appTheme.colors.muted}
              editable={!isSubmitting}
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
            <MentionTextInput
              value={description}
              onChangeText={(value) => updateField("description", value)}
              placeholder="Add context, what was said, and why it matters."
              inputStyle={[styles.input, styles.textArea, (errors.description || descriptionOverLimit) && styles.inputError]}
              placeholderTextColor={appTheme.colors.muted}
              editable={!isSubmitting}
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

          {showClaimQualityBox ? (
            <ClaimQualityBox
              analysis={claimQuality}
              onUseSuggestedTitle={(rewrittenTitle) => updateField("title", rewrittenTitle)}
            />
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Main Source URL</Text>
            <TextInput
              value={sourceUrl}
              onChangeText={(value) => updateField("sourceUrl", value)}
              placeholder="apple.com/news"
              style={[styles.input, errors.sourceUrl && styles.inputError]}
              placeholderTextColor={appTheme.colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
            {errors.sourceUrl ? <Text style={styles.errorText}>{errors.sourceUrl}</Text> : null}
            {sourcePreviewDomain && sourcePreviewQuality && sourcePreviewLabel ? (
              <View style={styles.sourcePreviewRow}>
                <Text style={styles.sourcePreviewDomain}>{sourcePreviewDomain}</Text>
                <Text style={styles.sourcePreviewPill}>
                  {sourcePreviewLabel} {"\u00B7"} {sourcePreviewQuality.score}/100
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Video URL (Optional)</Text>
            <TextInput
              value={videoUrl}
              onChangeText={(value) => updateField("videoUrl", value)}
              placeholder="youtube.com/watch, tiktok.com, x.com, or video link"
              style={[styles.input, errors.videoUrl && styles.inputError]}
              placeholderTextColor={appTheme.colors.muted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryGrid}>
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
            </ScrollView>
            {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
          </View>

          {/* PHASE 5 election positioning UI */}
          {category === "Politics" ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Politics focus</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryGrid}>
                {politicsSubCategories.map((option) => {
                  const selected = subCategory === option;

                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.categoryButton, selected && styles.categoryButtonSelected]}
                      activeOpacity={0.8}
                      onPress={() => setSubCategory((currentValue) => (currentValue === option ? "" : option))}
                    >
                      <Text style={[styles.categoryButtonText, selected && styles.categoryButtonTextSelected]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* PHASE 5 election positioning UI */}
          {category === "Politics" && subCategory === "Politician" ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Politician name</Text>
              <TextInput
                value={politicianTag}
                onChangeText={(value) => updateField("politicianTag", value)}
                placeholder="Politician name"
                style={[styles.input, errors.politicianTag && styles.inputError]}
                placeholderTextColor={appTheme.colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isSubmitting}
              />
              {errors.politicianTag ? <Text style={styles.errorText}>{errors.politicianTag}</Text> : null}
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Image / Screenshot</Text>
            {selectedImage ? (
              <View style={styles.imagePreviewPanel}>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                <Text style={styles.helperText}>
                  {formatImageSize(selectedImage.fileSize)}
                  {selectedImage.warning ? `  •  ${selectedImage.warning}` : ""}
                </Text>
                <TouchableOpacity
                  style={styles.removeImageButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedImage(null);
                    setImageError("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached image"
                  accessibilityHint="Detach the selected image from this claim"
                >
                  <Text style={styles.removeImageButtonText}>Remove image</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.imageButton, isSubmitting && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handlePickImage}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Add image or screenshot"
              accessibilityHint="Open the image picker to attach a photo to your claim"
            >
              <Text style={styles.imageButtonText}>Add Image / Screenshot</Text>
            </TouchableOpacity>
            {imageError ? <Text style={styles.errorText}>{imageError}</Text> : null}
            <Text style={styles.helperText}>Images are compressed to JPEG and thumbnails are generated before upload.</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, submitDisabled && styles.buttonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={submitDisabled}
            accessibilityRole="button"
            accessibilityLabel={isSubmitting ? "Uploading claim" : "Post claim"}
            accessibilityHint="Submit your claim for verification"
            accessibilityState={{ disabled: submitDisabled, busy: isSubmitting }}
          >
            <Text style={styles.buttonText}>{isSubmitting ? "Uploading..." : "Post Claim"}</Text>
            {isSubmitting ? <ActivityIndicator size="small" color={appTheme.colors.background} /> : null}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  content: {
    padding: 10,
  },
  gateCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.lightBorder,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: 14,
    ...theme.shadows.light,
  },
  gateTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.title.fontSize,
    fontWeight: "500",
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
    padding: 14,
    ...theme.shadows.light,
  },
  accountRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.phaseBg,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: "500",
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
    fontWeight: "500",
  },
  accountMeta: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
  },
  accountScore: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginTop: theme.spacing.xs,
  },
  verifiedBadge: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  warningPanel: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warningBorder,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  warningText: {
    color: theme.colors.warningText,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  generalError: {
    color: theme.colors.danger,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  titleInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 24,
    minHeight: 76,
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
    minHeight: 112,
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
    fontWeight: "500",
  },
  errorText: {
    color: theme.colors.danger,
    flex: 1,
    fontSize: theme.typography.small.fontSize,
  },
  categoryGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  sourcePreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  sourcePreviewDomain: {
    color: theme.colors.link,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  sourcePreviewPill: {
    backgroundColor: theme.colors.sourceBg,
    borderRadius: 999,
    color: theme.colors.sourceText,
    fontSize: 11,
    fontWeight: "500",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryButton: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  categoryButtonSelected: {
    backgroundColor: theme.colors.phaseBg,
    borderColor: theme.colors.primary,
  },
  categoryButtonText: {
    color: theme.colors.subtext,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
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
    fontWeight: "500",
  },
  imageButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
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
    fontWeight: "500",
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
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    marginTop: theme.spacing.sm,
    minHeight: 48,
    paddingVertical: theme.spacing.md,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabledBg,
  },
  buttonText: {
    color: theme.colors.chipActiveText,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.small.fontSize,
    fontWeight: "500",
  },
  });
}
