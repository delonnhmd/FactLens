// PHASE 1 STEP 1
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

type TabIconName = ComponentProps<typeof Ionicons>["name"];

function tabOptions(title: string, iconName: TabIconName) {
  return {
    title,
    tabBarLabel: title,
    tabBarIcon: ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
      <Ionicons name={iconName} size={size} color={String(color)} />
    ),
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#6B7280",
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E7EB",
        },
      }}
    >
      <Tabs.Screen name="index" options={tabOptions("Home", "home-outline")} />
      <Tabs.Screen name="search" options={tabOptions("Search", "search-outline")} />
      <Tabs.Screen name="create" options={tabOptions("Create", "add-circle-outline")} />
      <Tabs.Screen name="trending" options={tabOptions("Trending", "flame-outline")} />
      <Tabs.Screen name="profile" options={tabOptions("Profile", "person-outline")} />
    </Tabs>
  );
}
