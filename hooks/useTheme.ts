// PHASE 1 STEP 1
import { useMemo } from "react";
import { colors } from "../constants/colors";

export function useTheme() {
  return useMemo(
    () => ({
      colors,
    }),
    []
  );
}
