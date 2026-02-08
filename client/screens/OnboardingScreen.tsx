import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AppColors } from "@/constants/colors";
import { Spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { setIsOnboarded } = useAuth();

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOnboarded(true);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: AppColors.background,
          paddingTop: insets.top + Spacing["4xl"],
          paddingBottom: insets.bottom + Spacing["4xl"],
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: AppColors.primary + "20" },
          ]}
        >
          <Feather name="check-circle" size={64} color={AppColors.primary} />
        </View>

        <ThemedText style={styles.title}>Welcome to Appergy!</ThemedText>

        <ThemedText
          style={[styles.description, { color: AppColors.secondaryText }]}
        >
          You&apos;re all set! Start scanning food labels and menus to check for
          allergens. Your safety is our priority.
        </ThemedText>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Feather name="camera" size={24} color={AppColors.primary} />
            <ThemedText style={styles.featureText}>
              Scan food labels instantly
            </ThemedText>
          </View>
          <View style={styles.featureItem}>
            <Feather name="shield" size={24} color={AppColors.primary} />
            <ThemedText style={styles.featureText}>
              Track your allergies & preferences
            </ThemedText>
          </View>
          <View style={styles.featureItem}>
            <Feather name="users" size={24} color={AppColors.primary} />
            <ThemedText style={styles.featureText}>
              Add family members
            </ThemedText>
          </View>
        </View>
      </View>

      <Button onPress={handleGetStarted} style={styles.button}>
        Get Started
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing["3xl"],
    paddingHorizontal: Spacing.md,
  },
  features: {
    alignSelf: "stretch",
    gap: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
    gap: Spacing.md,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  button: {
    backgroundColor: AppColors.primaryDark,
  },
});
