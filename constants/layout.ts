// iPad full-screen support: shared responsive layout helper.
//
// The app is single-column. On a phone the content already fills the width;
// on an iPad (portrait ~834pt) a full-bleed column stretches too wide to read.
// `centeredContentStyle` caps the readable column and centers it on wide
// screens while staying full-width on phones — `maxWidth` only bites once the
// screen is wider than CONTENT_MAX_WIDTH, and `alignSelf: "center"` is a no-op
// when the column already fills the row.
//
// Merge it into a screen's scroll/list `contentContainerStyle` (the padded
// `content` style each screen already defines). The SafeAreaView `container`
// keeps its background, so the background still fills the whole screen.
import type { ViewStyle } from "react-native";

export const CONTENT_MAX_WIDTH = 640;

export const centeredContentStyle: ViewStyle = {
  width: "100%",
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: "center",
};
