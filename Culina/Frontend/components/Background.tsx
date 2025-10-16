import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default Background;
