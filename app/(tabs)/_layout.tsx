// PHASE 3 STEP 14
// Fixed FactLens bottom tabs with explicit labels
// PHASE 3 STEP 29
// PHASE 5 STEP 6

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // PHASE 3 STEP 20
  // PHASE 3 STEP 21
  // PHASE 3 STEP 23
  const insets = useSafeAreaInsets();
  const tabBarBottomInset = Platform.OS === 'ios' ? insets.bottom : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          height: 56 + tabBarBottomInset,
          paddingBottom: Math.max(tabBarBottomInset, 8),
          paddingTop: 4,
          borderTopWidth: 0.5,
          borderTopColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginBottom: 2,
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
          tabBarLabel: 'Leaderboard',
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
    </Tabs>
  );
}
