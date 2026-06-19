import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDisplaySettings } from "../hooks/useTheme";

type TabBarVisibilityContextValue = {
  contentBottomPadding: number;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  isTabBarVisible: boolean;
  showTabBar: () => void;
  tabBarAnimatedStyle: {
    opacity: Animated.Value;
    transform: Array<{ translateY: Animated.AnimatedInterpolation<string | number> }>;
  };
};

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);
const SCROLL_THRESHOLD = 10;
export const TAB_BAR_HEIGHT = 58;
const TAB_BAR_HIDDEN_TRANSLATE_Y = TAB_BAR_HEIGHT + 10;
const DEFAULT_CONTENT_BOTTOM_PADDING = 12;

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const { reduceMotionEnabled } = useDisplaySettings();
  const visibility = useRef(new Animated.Value(1)).current;
  const visibleRef = useRef(true);
  const lastOffsetRef = useRef(0);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const animateVisibility = useCallback(
    (visible: boolean) => {
      if (visibleRef.current === visible) {
        return;
      }

      visibleRef.current = visible;
      setIsTabBarVisible(visible);

      if (reduceMotionEnabled) {
        visibility.setValue(visible ? 1 : 0);
        return;
      }

      Animated.timing(visibility, {
        duration: 170,
        toValue: visible ? 1 : 0,
        useNativeDriver: true,
      }).start();
    },
    [reduceMotionEnabled, visibility],
  );

  const showTabBar = useCallback(() => {
    animateVisibility(true);
  }, [animateVisibility]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const delta = offsetY - lastOffsetRef.current;

      if (offsetY <= 0) {
        animateVisibility(true);
        lastOffsetRef.current = 0;
        return;
      }

      if (Math.abs(delta) < SCROLL_THRESHOLD) {
        return;
      }

      animateVisibility(delta < 0);
      lastOffsetRef.current = offsetY;
    },
    [animateVisibility],
  );

  useEffect(() => {
    visibility.setValue(visibleRef.current ? 1 : 0);
  }, [reduceMotionEnabled, visibility]);

  const tabBarAnimatedStyle = useMemo(
    () => ({
      opacity: visibility,
      transform: [
        {
          translateY: visibility.interpolate({
            inputRange: [0, 1],
            outputRange: [TAB_BAR_HIDDEN_TRANSLATE_Y, 0],
          }),
        },
      ],
    }),
    [visibility],
  );

  const contentBottomPadding = isTabBarVisible ? TAB_BAR_HEIGHT : DEFAULT_CONTENT_BOTTOM_PADDING;

  const value = useMemo(
    () => ({
      contentBottomPadding,
      handleScroll,
      isTabBarVisible,
      showTabBar,
      tabBarAnimatedStyle,
    }),
    [contentBottomPadding, handleScroll, isTabBarVisible, showTabBar, tabBarAnimatedStyle],
  );

  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useScrollAwareTabBar(): TabBarVisibilityContextValue {
  const context = useContext(TabBarVisibilityContext);

  if (!context) {
    const visibility = new Animated.Value(1);

    return {
      contentBottomPadding: TAB_BAR_HEIGHT,
      handleScroll: () => undefined,
      isTabBarVisible: true,
      showTabBar: () => undefined,
      tabBarAnimatedStyle: {
        opacity: visibility,
        transform: [
          {
            translateY: visibility.interpolate({
              inputRange: [0, 1],
              outputRange: [TAB_BAR_HIDDEN_TRANSLATE_Y, 0],
            }),
          },
        ],
      },
    };
  }

  return context;
}
