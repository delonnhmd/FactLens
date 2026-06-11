// PHASE 3 STEP 14
// Fixed Verifact bottom tabs with explicit labels
// PHASE 3 STEP 29
// PHASE 5 STEP 6

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarVisibilityProvider, useScrollAwareTabBar } from '../../context/TabBarVisibilityContext';
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
  size,
}: {
  name: IoniconName;
  color: ColorValue;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
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
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const { showTabBar, tabBarAnimatedStyle } = useScrollAwareTabBar();
  const tabBarBottomInset = Platform.OS === 'ios' ? insets.bottom : 0;
  const tabBarBaseStyle = {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 54 + tabBarBottomInset,
    paddingBottom: tabBarBottomInset,
    paddingTop: 4,
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
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "search" : "search-outline"} color={color} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "add-circle" : "add-circle-outline"} color={color} size={28} />
          ),
        }}
      />

      <Tabs.Screen
        name="trending"
        options={{
          title: 'Trending',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "flame" : "flame-outline"} color={color} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "trophy" : "trophy-outline"} color={color} size={25} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} color={color} size={25} />
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
