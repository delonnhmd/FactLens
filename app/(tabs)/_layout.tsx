// PHASE 3 STEP 14
// Fixed FactLens bottom tabs with explicit labels
// PHASE 3 STEP 29

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconName =
  | 'home-outline'
  | 'search-outline'
  | 'add-circle-outline'
  | 'flame-outline'
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
  const tabBarBottomPadding = Math.max(insets.bottom, 20);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          height: 76 + tabBarBottomPadding,
          paddingBottom: tabBarBottomPadding,
          paddingTop: 8,
          borderTopColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
          marginBottom: Platform.OS === 'android' ? 8 : 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
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
