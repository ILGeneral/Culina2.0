import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

type Props = {
  label: string;
  errorMessage?: string;
} & TextInputProps;

export default function FormInput({ label, errorMessage, ...textInputProps }: Props) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-600 mb-1">{label}</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
        placeholderTextColor="#9ca3af"
        {...textInputProps}
      />
      {errorMessage ? (
        <Text className="text-xs text-red-500 mt-1">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
