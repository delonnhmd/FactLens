// PHASE 3 STEP 14
// Fixed Verifact bottom tabs with explicit labels
// PHASE 3 STEP 29
// PHASE 5 STEP 6

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, type ColorValue } from 'react-native';
import { TAB_BAR_HEIGHT, TabBarVisibilityProvider, useScrollAwareTabBar } from '../../context/TabBarVisibilityContext';
import { useAppTheme } from '../../hooks/useTheme';

type IoniconName =
  | 'home-outline'
  | 'home'
  | 'search-outline'
  | 'search'
  | 'add-circle-outline'
  | 'add-circle'
  | 'flame-outline'
  | 'flame'
  | 'trophy-outline'
  | 'trophy'
  | 'person-outline'
  | 'person';

function TabIcon({
  name,
  color,
  focused = false,
  activeBackgroundColor = 'transparent',
  prominent = false,
  size,
}: {
  name: IoniconName;
  color: ColorValue;
  focused?: boolean;
  activeBackgroundColor?: ColorValue;
  prominent?: boolean;
  size: number;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: focused && prominent ? activeBackgroundColor : 'transparent',
        borderRadius: 999,
        height: prominent ? 48 : 44,
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        width: prominent ? 48 : 44,
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <TabBarVisibilityProvider>
      <VisibleTabs />
    </TabBarVisibilityProvider>
  );
}

function VisibleTabs() {
  // PHASE 3 STEP 20
  // PHASE 3 STEP 21
  // PHASE 3 STEP 23
  const appTheme = useAppTheme();
  const { showTabBar, tabBarAnimatedStyle } = useScrollAwareTabBar();
  const tabBarBaseStyle = {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
    paddingBottom: 0,
    paddingTop: 0,
    borderTopWidth: appTheme.borderWidth,
    borderTopColor: appTheme.colors.lightBorder,
    backgroundColor: appTheme.colors.tabBar,
    elevation: 0,
    shadowOpacity: 0,
  };

  return (
    <Tabs
      screenListeners={{
        focus: showTabBar,
        tabPress: showTabBar,
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appTheme.colors.primary,
        tabBarInactiveTintColor: appTheme.colors.tabInactive,
        tabBarStyle: [tabBarBaseStyle, tabBarAnimatedStyle] as any,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: {
          alignItems: 'center',
          height: 44,
          justifyContent: 'center',
          marginTop: 0,
          width: 44,
        },
        tabBarItemStyle: {
          alignItems: 'center',
          height: TAB_BAR_HEIGHT,
          justifyContent: 'center',
          paddingVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "search" : "search-outline"} color={color} focused={focused} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarAccessibilityLabel: 'Create claim',
          tabBarButton: ({ href, ref, style, ...props }) => (
            <Pressable
              {...props}
              accessibilityLabel="Create claim"
              accessibilityRole="button"
              hitSlop={6}
              style={({ pressed }) => [
                style,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                },
                pressed && { opacity: 0.74 },
              ]}
            />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "add-circle" : "add-circle-outline"}
              color={color}
              focused={focused}
              activeBackgroundColor={appTheme.colors.phaseBg}
              prominent
              size={32}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="trending"
        options={{
          title: 'Trending',
          tabBarAccessibilityLabel: 'Trending',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "flame" : "flame-outline"} color={color} focused={focused} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarAccessibilityLabel: 'Leaderboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "trophy" : "trophy-outline"} color={color} focused={focused} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} color={color} focused={focused} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="claim/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
