// PHASE 1 STEP 1
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

// PHASE 2 STEP 8
const tabIcons: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  index: "home-outline",
  search: "search-outline",
  create: "add-circle-outline",
  trending: "flame-outline",
  profile: "person-outline",
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#E5E7EB" },
        tabBarIcon: ({ color, size }) => {
          const iconName = tabIcons[route.name] || "ellipse-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="create" options={{ title: "Create" }} />
      <Tabs.Screen name="trending" options={{ title: "Trending" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
