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
  type ReactNode,
} from "react";
import { useDisplaySettings } from "../hooks/useTheme";

type TabBarVisibilityContextValue = {
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  showTabBar: () => void;
  tabBarAnimatedStyle: {
    opacity: Animated.Value;
    transform: Array<{ translateY: Animated.AnimatedInterpolation<string | number> }>;
  };
};

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);
const SCROLL_THRESHOLD = 10;

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const { reduceMotionEnabled } = useDisplaySettings();
  const visibility = useRef(new Animated.Value(1)).current;
  const visibleRef = useRef(true);
  const lastOffsetRef = useRef(0);

  const animateVisibility = useCallback(
    (visible: boolean) => {
      if (visibleRef.current === visible) {
        return;
      }

      visibleRef.current = visible;

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
            outputRange: [96, 0],
          }),
        },
      ],
    }),
    [visibility],
  );

  const value = useMemo(
    () => ({
      handleScroll,
      showTabBar,
      tabBarAnimatedStyle,
    }),
    [handleScroll, showTabBar, tabBarAnimatedStyle],
  );

  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useScrollAwareTabBar(): TabBarVisibilityContextValue {
  const context = useContext(TabBarVisibilityContext);

  if (!context) {
    const visibility = new Animated.Value(1);

    return {
      handleScroll: () => undefined,
      showTabBar: () => undefined,
      tabBarAnimatedStyle: {
        opacity: visibility,
        transform: [
          {
            translateY: visibility.interpolate({
              inputRange: [0, 1],
              outputRange: [96, 0],
            }),
          },
        ],
      },
    };
  }

  return context;
}
