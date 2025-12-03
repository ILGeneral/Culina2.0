import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "@/styles/components/backgroundStyles";

export type BackgroundProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

const Background: React.FC<BackgroundProps> = ({ children, style }) => {
  return (
    <View style={[styles.container, style]}
    >
      <LinearGradient
        colors={["#80d0ff", "#ffffff"]}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
};

export default Background;