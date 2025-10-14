import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated } from "react-native";
import { BottomTabBar } from "@react-navigation/bottom-tabs"; // Replace Tabs.Bar
import React, { useRef } from "react";

export default function TabsLayout() {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animatedStyle = {
    opacity: fadeAnim,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#000000FF",
        tabBarInactiveTintColor: "#E6E6E6FF",
        tabBarStyle: { backgroundColor: "#42A5F5" },
      }}
      tabBar={(props) => (
        <Animated.View style={[animatedStyle]}>
          <BottomTabBar {...props} />
        </Animated.View>
      )}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Homepage",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
