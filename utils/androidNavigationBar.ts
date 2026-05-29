// PHASE 3 STEP 23
import { Platform } from "react-native";
import { NavigationBar, setVisibilityAsync } from "expo-navigation-bar";

export function setupAndroidNavigationBar() {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    // Light navigation bar style means dark system buttons on a light surface.
    NavigationBar.setStyle("light");
    NavigationBar.setHidden(true);
  } catch (error) {
    console.log("[android-navigation-bar] setup failed:", error);
  }

  setVisibilityAsync("hidden").catch((error) => {
    console.log("[android-navigation-bar] hide failed:", error);
  });
}
