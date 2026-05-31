// PHASE 3 STEP 23
// PHASE 3 STEP 29
import { Platform } from "react-native";
import { NavigationBar, setVisibilityAsync } from "expo-navigation-bar";

export function setupAndroidNavigationBar() {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    // Dark navigation bar style means dark system buttons on the app's white bottom surface.
    NavigationBar.setStyle("dark");
    NavigationBar.setHidden(true);
  } catch (error) {
    console.log("[android-navigation-bar] setup failed:", error);
  }

  setVisibilityAsync("hidden").catch((error) => {
    console.log("[android-navigation-bar] hide failed:", error);
  });
}
