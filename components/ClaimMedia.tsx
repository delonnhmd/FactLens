// Shared claim media block — used by the feed card (ClaimCard) and the claim
// detail screen so both render media identically.
//
// Rules (see resolveClaimMedia for the resolution order):
//   - Uploaded image  -> full-width 16:9 image, resizeMode "cover".
//   - YouTube video   -> 16:9 YouTube thumbnail + centered play overlay.
//   - Other video URL -> compact link chip (no native video/webview deps).
//   - No media        -> renders nothing (no empty box, no gap).
//
// Loading shows a subtle placeholder; an image load error hides the block
// entirely rather than showing a broken-image icon. Uses the plain RN <Image>
// (the same caching/component pattern already used across the app) — no new
// libraries, so this ships as a JS-only eas update.
import { memo, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClaimMedia as ClaimMediaData } from "../types/claim";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import { resolveClaimMedia } from "../utils/claimMedia";

interface ClaimMediaProps {
  media: ClaimMediaData | null | undefined;
  // Tapping the media runs this (feed: open the claim; detail: open the source).
  onPress?: () => void;
  // Detail passes true to use the full-resolution image instead of the thumbnail.
  fullResolution?: boolean;
  // Corner radius for the media frame. Feed uses 0 (full-bleed, square); detail
  // rounds to match its cards.
  borderRadius?: number;
}

function ClaimMediaComponent({ media, onPress, fullResolution = false, borderRadius }: ClaimMediaProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolved = useMemo(() => resolveClaimMedia(media), [media]);

  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Reset load/error state whenever the source changes (FlatList recycles cards).
  const sourceKey =
    resolved.kind === "image"
      ? fullResolution
        ? resolved.fullUri
        : resolved.uri
      : resolved.kind === "youtube"
        ? resolved.thumbnailUrl
        : resolved.kind;

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [sourceKey]);

  if (resolved.kind === "none") {
    return null;
  }

  const radius = borderRadius ?? theme.radius.sm;

  // Image + YouTube both render a 16:9 thumbnail. An uploaded image that fails
  // to load hides the whole block; a YouTube thumbnail that fails falls through
  // to the link chip below so there is still a tappable affordance.
  const showAsImage =
    resolved.kind === "image" || (resolved.kind === "youtube" && !errored);

  if (showAsImage) {
    if (resolved.kind === "image" && errored) {
      return null;
    }

    const uri =
      resolved.kind === "image"
        ? fullResolution
          ? resolved.fullUri
          : resolved.uri
        : (resolved as { thumbnailUrl: string }).thumbnailUrl;

    const content = (
      <View style={[styles.frame, { borderRadius }]}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
        {!loaded ? (
          <View style={[styles.placeholder, { borderRadius }]}>
            <ActivityIndicator size="small" color={theme.colors.subtext} />
          </View>
        ) : null}
        {resolved.kind === "youtube" && loaded ? (
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={26} color={theme.colors.chipActiveText} />
          </View>
        ) : null}
      </View>
    );

    if (!onPress) {
      return <View style={{ borderRadius: radius }}>{content}</View>;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={resolved.kind === "youtube" ? "Open video" : "Open claim media"}
      >
        {content}
      </TouchableOpacity>
    );
  }

  // Non-YouTube video (TikTok / X / other) or a YouTube thumbnail that errored:
  // compact link chip instead of a broken image.
  const chipUrl = resolved.kind === "link" ? resolved.url : (resolved as { url: string }).url;
  const chipPlatform = resolved.kind === "link" ? resolved.platform : "Video";

  return (
    <TouchableOpacity
      style={[styles.linkChip, { borderRadius: radius }]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${chipPlatform} link`}
    >
      <Ionicons name="link-outline" size={15} color={theme.colors.link} />
      <Text style={styles.linkChipText} numberOfLines={1}>
        {chipPlatform} {"·"} {chipUrl}
      </Text>
      <Ionicons name="open-outline" size={14} color={theme.colors.subtext} />
    </TouchableOpacity>
  );
}

export const ClaimMedia = memo(ClaimMediaComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    frame: {
      aspectRatio: 16 / 9,
      backgroundColor: theme.colors.card,
      overflow: "hidden",
      width: "100%",
    },
    image: {
      bottom: 0,
      height: "100%",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      width: "100%",
    },
    placeholder: {
      alignItems: "center",
      backgroundColor: theme.colors.card,
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    playOverlay: {
      alignItems: "center",
      backgroundColor: "rgba(15, 23, 42, 0.72)",
      borderRadius: 26,
      height: 52,
      justifyContent: "center",
      left: "50%",
      marginLeft: -26,
      marginTop: -26,
      position: "absolute",
      top: "50%",
      width: 52,
    },
    linkChip: {
      alignItems: "center",
      backgroundColor: theme.colors.secondarySurface,
      borderColor: theme.colors.lightBorder,
      borderWidth: theme.borderWidth,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    linkChipText: {
      color: theme.colors.link,
      flex: 1,
      fontSize: theme.typography.small.fontSize,
      fontWeight: "500",
    },
  });
}
