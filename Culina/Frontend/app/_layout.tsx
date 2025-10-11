import React from "react";
import { Tabs } from "expo-router";
import { Home, Box, Bookmark, User } from "lucide-react-native";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  const colorScheme = useColorScheme();

  const activeColor = colorScheme === "dark" ? "#4ADE80" : "#16a34a"; // green-500
  const inactiveColor = "#9CA3AF"; // gray-400

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: colorScheme === "dark" ? "#1E293B" : "#ffffff",
          borderTopWidth: 0.5,
          borderTopColor: "#e5e7eb",
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => <Box color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, size }) => <Bookmark color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
