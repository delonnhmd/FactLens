// PHASE 1 STEP 1
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

type TabIconName = ComponentProps<typeof Ionicons>["name"];

function tabOptions(title: string, iconName: TabIconName, activeIconName: TabIconName = iconName) {
  return {
    title,
    tabBarLabel: title,
    tabBarIcon: ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => {
      const icon = focused ? activeIconName : iconName;
      return <Ionicons name={icon} size={size} color={String(color)} />;
    },
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
      {/* PHASE 3 STEP 14 */}
      <Tabs.Screen name="index" options={tabOptions("Home", "home-outline", "home")} />
      <Tabs.Screen name="search" options={tabOptions("Search", "search-outline", "search")} />
      <Tabs.Screen name="create" options={tabOptions("Create", "add-circle-outline", "add-circle")} />
      <Tabs.Screen name="trending" options={tabOptions("Trending", "flame-outline", "flame")} />
      <Tabs.Screen name="profile" options={tabOptions("Profile", "person-outline", "person")} />
    </Tabs>
  );
}
