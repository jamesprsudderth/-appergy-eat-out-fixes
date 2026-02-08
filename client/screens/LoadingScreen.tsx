import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { AppColors } from "@/constants/colors";
import { Spacing } from "@/constants/theme";

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={AppColors.primary} />
      <ThemedText style={styles.text}>Loading...</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    marginTop: Spacing.lg,
    fontSize: 16,
    color: AppColors.secondaryText,
  },
});
