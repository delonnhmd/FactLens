// PHASE 1 STEP 1
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

const routeIcons: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  Home: "home",
  Create: "add-circle",
  Trending: "trending-up",
  Notifications: "notifications-outline",
  Profile: "person-outline",
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
          const iconName = routeIcons[route.name] || "circle";

          if (route.name === "Trending") {
            return <MaterialCommunityIcons name="trending-up" size={size} color={color} />;
          }
          if (route.name === "Notifications") {
            return <Ionicons name="notifications-outline" size={size} color={color} />;
          }
          if (route.name === "Profile") {
            return <MaterialCommunityIcons name="account-circle-outline" size={size} color={color} />;
          }
          if (route.name === "Create") {
            return <FontAwesome5 name="plus-circle" size={size} color={color} />;
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    />
  );
}
