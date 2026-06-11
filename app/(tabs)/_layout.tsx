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
  | 'search-outline'
  | 'add-circle-outline'
  | 'flame-outline'
  | 'trophy-outline'
  | 'person-outline';

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
    height: 56 + tabBarBottomInset,
    paddingBottom: Math.max(tabBarBottomInset, 6),
    paddingTop: 5,
    borderTopWidth: appTheme.borderWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginBottom: 1,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarLabel: 'Search',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="search-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarLabel: 'Create',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="add-circle-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="trending"
        options={{
          title: 'Trending',
          tabBarLabel: 'Trending',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="flame-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarLabel: 'Ranks',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="trophy-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-outline" color={color} size={size} />
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
