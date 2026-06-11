// PHASE 1 STEP 1
import { useContext } from "react";
import { DisplaySettingsContext } from "../context/DisplaySettingsContext";

export function useTheme() {
  const { appTheme } = useContext(DisplaySettingsContext);

  return appTheme;
}

export function useAppTheme() {
  return useTheme();
}

export function useDisplaySettings() {
  return useContext(DisplaySettingsContext);
}

export function useTextScale() {
  const { textScale } = useContext(DisplaySettingsContext);

  return textScale;
}
